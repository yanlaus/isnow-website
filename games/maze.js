/* 地下迷宮：斜俯視 3D 地城，鏡頭跟住勇者，北方永遠喺畫面上方 */
import { THREE, clamp } from './engine.js';
import { gradientTexture, Sparks, makeGlow } from './fx.js';
import { createHero, createChest, createGem, createTorch } from './models.js';
import { Sound, buzz } from './sound.js';

const N = 1, E = 2, S = 4, W = 8;
export const DIRS = {
  up:    { dx: 0,  dy: -1, bit: N, opp: S, face: Math.PI },
  right: { dx: 1,  dy: 0,  bit: E, opp: W, face: Math.PI / 2 },
  down:  { dx: 0,  dy: 1,  bit: S, opp: N, face: 0 },
  left:  { dx: -1, dy: 0,  bit: W, opp: E, face: -Math.PI / 2 },
};
const FOV = 42;
const PITCH = THREE.MathUtils.degToRad(57);
const WALL_H = 0.42;
const WALL_T = 0.15;
const MOVE_T = 0.15;
const LIGHT_R = 2.3;

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* 遞迴回溯生成迷宮 + 少量環路（減少死路挫敗感） */
function generate(size, loops) {
  const cells = new Uint8Array(size * size).fill(N | E | S | W);
  const seen = new Uint8Array(size * size);
  const stack = [[0, 0]];
  seen[0] = 1;
  const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = Object.values(DIRS).filter(d => inside(x + d.dx, y + d.dy) && !seen[(y + d.dy) * size + x + d.dx]);
    if (!opts.length) { stack.pop(); continue; }
    const d = pick(opts);
    const nx = x + d.dx, ny = y + d.dy;
    cells[y * size + x] &= ~d.bit;
    cells[ny * size + nx] &= ~d.opp;
    seen[ny * size + nx] = 1;
    stack.push([nx, ny]);
  }
  const deadEnds = () => {
    const out = [];
    for (let i = 1; i < cells.length; i++) {
      if ([N, E, S, W].filter(b => cells[i] & b).length === 3) out.push(i);
    }
    return out;
  };
  for (const i of shuffle(deadEnds()).slice(0, loops)) {
    const x = i % size, y = Math.floor(i / size);
    const walls = Object.values(DIRS).filter(d => (cells[i] & d.bit) && inside(x + d.dx, y + d.dy));
    if (!walls.length) continue;
    const d = pick(walls);
    cells[i] &= ~d.bit;
    cells[(y + d.dy) * size + x + d.dx] &= ~d.opp;
  }
  return { cells, deadEnds: deadEnds() };
}

function bfs(cells, size, start) {
  const dist = new Int32Array(size * size).fill(-1);
  dist[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % size, y = Math.floor(i / size);
    for (const d of Object.values(DIRS)) {
      if (cells[i] & d.bit) continue;
      const j = (y + d.dy) * size + x + d.dx;
      if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
    }
  }
  return dist;
}

const FLOOR_A = new THREE.Color(0x2e2850);
const FLOOR_B = new THREE.Color(0x372f5e);
const FLOOR_VISIT = new THREE.Color(0x6b5a3a);
const WALL_COL = new THREE.Color(0xe0cfa6);

export class MazeView {
  constructor(hooks) {
    this.hooks = hooks;
    this.scene = new THREE.Scene();
    this.bgNormal = gradientTexture(['#1a1838', '#100e24', '#07060f']);
    this.bgDark = gradientTexture(['#06050c', '#030307']);
    this.scene.background = this.bgNormal;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

    this.hemi = new THREE.HemisphereLight(0xc9d2ff, 0x2b2140, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.sun.position.set(-4, 10, 6);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.hero = createHero();
    this.hero.group.scale.setScalar(0.92);
    this.scene.add(this.hero.group);
    this.torch = new THREE.PointLight(0xffa64d, 0, 6, 1.6);
    this.torch.position.set(0, 1.1, 0.2);
    this.hero.group.add(this.torch);
    this.torchGlow = makeGlow(0xff9a3c, 1.4, 0);
    this.torchGlow.position.set(-0.3, 0.95, 0.15);
    this.hero.group.add(this.torchGlow);

    this.chest = createChest();
    this.scene.add(this.chest.group);
    this.sparks = new Sparks(this.scene, { cap: 400, size: 0.32 });

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ndc = new THREE.Vector2();
    this.hit = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.mtx = new THREE.Matrix4();
    this.col = new THREE.Color();
    this.W = 1;
    this.H = 1;
    this.camDist = 10;
    this.level = null;
    this.active = false;
    this.disposables = [];
  }

  idx(x, y) { return y * this.n + x; }

  /* ---------- 建立一局 ---------- */
  setup(level) {
    this.level = level;
    this.n = level.size;
    const n = this.n;
    const { cells, deadEnds } = generate(n, level.loops);
    this.cells = cells;
    const dist = bfs(cells, n, 0);
    let far = 0;
    dist.forEach((d, i) => { if (d > dist[far]) far = i; });
    this.goal = far;
    this.shortest = dist[far];

    // 清走上一局
    this.disposables.forEach(o => { this.world.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.disposables = [];
    (this.gems || []).forEach(g => this.world.remove(g.group));
    (this.decor || []).forEach(d => this.world.remove(d.group));

    // 地面底板（磚縫）
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(n + 2, n + 2),
      new THREE.MeshLambertMaterial({ color: level.fog ? 0x020203 : 0x15122a }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set((n - 1) / 2, -0.01, (n - 1) / 2);
    this.world.add(base);
    this.disposables.push(base);

    // 地磚（instanced，每格可以獨立變色）
    const floorGeo = new THREE.PlaneGeometry(0.94, 0.94);
    floorGeo.rotateX(-Math.PI / 2);
    this.floor = new THREE.InstancedMesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n * n);
    for (let i = 0; i < n * n; i++) {
      this.mtx.makeTranslation(i % n, 0, Math.floor(i / n));
      this.floor.setMatrixAt(i, this.mtx);
      this.floor.setColorAt(i, FLOOR_A);
    }
    this.world.add(this.floor);
    this.disposables.push(this.floor);

    // 牆（instanced）
    const segs = [];
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = Math.floor(i / n), c = cells[i];
      if (c & N) segs.push({ x, z: y - 0.5, h: true, a: i, b: y > 0 ? i - n : -1 });
      if (c & W) segs.push({ x: x - 0.5, z: y, h: false, a: i, b: x > 0 ? i - 1 : -1 });
      if (x === n - 1 && (c & E)) segs.push({ x: x + 0.5, z: y, h: false, a: i, b: -1 });
      if (y === n - 1 && (c & S)) segs.push({ x, z: y + 0.5, h: true, a: i, b: -1 });
    }
    this.segs = segs;
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    this.walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), segs.length);
    const q = new THREE.Quaternion();
    segs.forEach((s, k) => {
      this.mtx.compose(
        this.tmp.set(s.x, WALL_H / 2, s.z), q,
        new THREE.Vector3(s.h ? 1 + WALL_T : WALL_T, WALL_H, s.h ? WALL_T : 1 + WALL_T),
      );
      this.walls.setMatrixAt(k, this.mtx);
      this.walls.setColorAt(k, WALL_COL);
    });
    this.world.add(this.walls);
    this.disposables.push(this.walls);

    // 寶石
    const candidates = shuffle(deadEnds.filter(i => i !== 0 && i !== far));
    const extra = shuffle(Array.from(cells.keys()).filter(i => i !== 0 && i !== far && dist[i] > 2));
    this.gems = [];
    const used = new Set();
    for (const i of candidates.concat(extra)) {
      if (this.gems.length >= level.gems) break;
      if (used.has(i)) continue;
      used.add(i);
      const g = createGem([0x5ee7ff, 0xff6bd6, 0x7dff9a, 0xffe066][this.gems.length % 4]);
      g.group.position.set(i % n, 0, Math.floor(i / n));
      g.cell = i;
      this.world.add(g.group);
      this.gems.push(g);
    }
    this.gemTotal = this.gems.length;
    this.collected = 0;

    // 寶箱（終點）
    this.scene.remove(this.chest.group);
    this.chest = createChest();
    this.chest.group.position.set(far % n, 0, Math.floor(far / n));
    this.chest.group.scale.setScalar(0.85);
    this.scene.add(this.chest.group);

    // 四角火把（只係光暈，唔加燈，慳效能）
    this.decor = [];
    if (!level.fog) {
      [[-0.9, -0.9], [n - 0.1, -0.9], [-0.9, n - 0.1], [n - 0.1, n - 0.1]].forEach(([x, z]) => {
        const tch = createTorch({ light: false, height: 0.9 });
        tch.group.position.set(x, 0, z);
        this.world.add(tch.group);
        this.decor.push(tch);
      });
    }

    // 燈光
    const fog = level.fog;
    this.scene.background = fog ? this.bgDark : this.bgNormal;
    this.hemi.intensity = fog ? 0.35 : 1.5;
    this.sun.intensity = fog ? 0.35 : 2.2;
    this.torch.intensity = fog ? 9 : 0;
    this.torchGlow.material.opacity = fog ? 0.8 : 0;

    // 狀態
    this.hx = 0;
    this.hy = 0;
    this.pos = new THREE.Vector2(0, 0);
    this.anim = null;
    this.queued = null;
    this.bump = null;
    this.goalStop = null;
    this.facing = 0;
    this.steps = 0;
    this.seen = new Uint8Array(n * n);
    this.visited = new Uint8Array(n * n);
    this.visited[0] = 1;
    this.bright = new Float32Array(n * n).fill(fog ? 0 : 1);
    this.active = false;
    this.finished = false;
    this.hero.group.position.set(0, 0, 0);
    this.hero.group.rotation.y = 0;
    this.reveal();
    this.paint(1);
    this.introT = 0;
    this.layout();
    this.camTarget = null;
  }

  begin() { this.active = true; }
  abort() { this.active = false; this.queued = null; }

  reveal() {
    if (!this.level.fog) return;
    const n = this.n;
    for (let y = this.hy - 3; y <= this.hy + 3; y++) {
      for (let x = this.hx - 3; x <= this.hx + 3; x++) {
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        if ((x - this.hx) ** 2 + (y - this.hy) ** 2 <= LIGHT_R * LIGHT_R) this.seen[this.idx(x, y)] = 1;
      }
    }
  }

  /* 地磚同牆嘅亮度：黑暗關卡＝火把範圍全亮、記得嘅地方淡淡、未見過全黑 */
  paint(k) {
    const n = this.n;
    const fog = this.level.fog;
    for (let i = 0; i < n * n; i++) {
      let target = 1;
      if (fog) {
        const dx = (i % n) - this.pos.x, dy = Math.floor(i / n) - this.pos.y;
        target = dx * dx + dy * dy <= LIGHT_R * LIGHT_R ? 1 : this.seen[i] ? 0.3 : 0;
      }
      this.bright[i] += (target - this.bright[i]) * k;
      const x = i % n, y = Math.floor(i / n);
      this.col.copy((x + y) % 2 ? FLOOR_B : FLOOR_A);
      if (this.visited[i]) this.col.lerp(FLOOR_VISIT, 0.55);
      this.floor.setColorAt(i, this.col.multiplyScalar(this.bright[i]));
    }
    this.segs.forEach((s, k2) => {
      const b = Math.max(this.bright[s.a], s.b >= 0 ? this.bright[s.b] : 0);
      this.walls.setColorAt(k2, this.col.copy(WALL_COL).multiplyScalar(b));
    });
    this.floor.instanceColor.needsUpdate = true;
    this.walls.instanceColor.needsUpdate = true;
    if (fog) this.gems.forEach(g => { if (!g.done) g.group.visible = !!this.seen[g.cell]; });
  }

  /* ---------- 移動 ---------- */
  move(dirName) {
    if (!this.active) return false;
    if (this.anim) { this.queued = dirName; return true; }
    const d = DIRS[dirName];
    this.facing = d.face;
    const i = this.idx(this.hx, this.hy);
    if (this.cells[i] & d.bit) {
      this.bump = { dx: d.dx, dy: d.dy, t: 0 };
      Sound.bump();
      buzz(15);
      return false;
    }
    this.anim = { fx: this.hx, fy: this.hy, t: 0 };
    this.hx += d.dx;
    this.hy += d.dy;
    // 行入終點格時停喺寶箱前面，唔好企入寶箱
    this.goalStop = this.idx(this.hx, this.hy) === this.goal ? { x: -d.dx * 0.34, y: -d.dy * 0.34 } : null;
    this.steps += 1;
    this.visited[this.idx(this.hx, this.hy)] = 1;
    this.reveal();
    Sound.step();
    return true;
  }

  arrive() {
    const j = this.idx(this.hx, this.hy);
    const gem = this.gems.find(g => g.cell === j && !g.done);
    if (gem) {
      gem.done = true;
      gem.collect();
      this.collected += 1;
      Sound.gem();
      buzz(20);
      this.tmp.set(this.hx, 0.6, this.hy);
      this.sparks.spawn(this.tmp, { count: 30, color: 0x9ff3ff, speed: 3, life: 0.7, gravity: 3 });
      this.hooks.onGem(this.collected, this.gemTotal);
    }
    if (j === this.goal) this.finish();
  }

  finish() {
    this.active = false;
    this.finished = true;
    this.queued = null;
    this.hooks.onComplete();
    this.chest.open();
    this.hero.celebrate();
    Sound.chest();
    buzz([40, 60, 80]);
    this.tmp.set(this.hx, 0.6, this.hy);
    this.sparks.spawn(this.tmp, { count: 90, color: 0xffd56a, speed: 5, life: 1, gravity: 4, up: 3 });
    this.hooks.onMessage('打開寶箱！迷宮攻略成功！');
    setTimeout(() => this.hooks.onFinish({
      steps: this.steps, shortest: this.shortest, collected: this.collected, gemTotal: this.gemTotal,
    }), 1400);
  }

  /* ---------- 版面同鏡頭 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRect(play) {
    this.playRect = play;
    this.layout();
  }

  layout() {
    if (!this.playRect || !this.n) return;
    const r = this.playRect;
    const { W, H } = this;
    const n = this.n;
    // 令鏡頭中心對準 HTML 遊戲區中心
    this.camera.setViewOffset(W, H, W / 2 - r.cx, H / 2 - r.cy, W, H);
    this.camera.updateProjectionMatrix();
    // 每格最少幾多 px（黑暗關卡拉近啲，勇者大啲）
    const minCell = this.level.fog ? 62 : 50;
    const room = Math.min(r.width, r.height / Math.sin(PITCH));
    let extent = Math.max(5, Math.floor(room / minCell));
    if (extent >= n) extent = n;
    this.extent = extent;
    this.follow = extent < n;
    this.camDist = this.fitDistance(extent, r);
    this.cellPx = room / (extent + 1);
  }

  /* 二分法搵鏡頭距離：可見範圍嘅角落（連牆高同勇者高度）全部投影入遊戲區 */
  fitDistance(extent, r) {
    const h = extent / 2 + 0.45;
    const pts = [[-h, 0, -h], [h, 0, -h], [-h, WALL_H, h], [h, WALL_H, h], [-h, 0, h], [h, 0, h], [-h, 1, -h], [h, 1, -h]];
    const cam = this.camera;
    const v = new THREE.Vector3();
    const m = 4;
    let lo = 2, hi = 300;
    for (let it = 0; it < 26; it++) {
      const d = (lo + hi) / 2;
      cam.position.set(0, d * Math.sin(PITCH), d * Math.cos(PITCH));
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      let ok = true;
      for (const [x, y, z] of pts) {
        v.set(x, y, z).project(cam);
        const px = (v.x + 1) / 2 * this.W, py = (1 - v.y) / 2 * this.H;
        if (px < r.left + m || px > r.left + r.width - m || py < r.top + m || py > r.top + r.height - m) { ok = false; break; }
      }
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }

  focusPoint(out) {
    const n = this.n;
    if (!this.follow) return out.set((n - 1) / 2, 0, (n - 1) / 2);
    const h = this.extent / 2 - 0.3;
    return out.set(
      clamp(this.pos.x, h - 0.5, n - 0.5 - h),
      0,
      clamp(this.pos.y, h - 0.5, n - 0.5 - h),
    );
  }

  /* ---------- 觸控：滑動／點擊地面 ---------- */
  groundAt(x, y) {
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.ground, this.hit);
  }

  pointerDown(x, y, id) {
    if (!this.active) return;
    this.drag = { id, x, y, sx: x, sy: y, moved: false };
  }

  pointerMove(x, y, id) {
    const d = this.drag;
    if (!d || d.id !== id) return;
    const th = Math.max(24, this.cellPx * 0.7);
    const dx = x - d.x, dy = y - d.y;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    this.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    d.x = x;
    d.y = y;
    d.moved = true;
  }

  pointerUp(x, y, id, cancelled) {
    const d = this.drag;
    if (!d || d.id !== id) return;
    this.drag = null;
    if (cancelled || d.moved || Math.hypot(x - d.sx, y - d.sy) > 12 || !this.active) return;
    // 點擊：向點擊位置嘅方向行一步
    const p = this.groundAt(x, y);
    if (!p) return;
    const tx = p.x - this.pos.x, tz = p.z - this.pos.y;
    if (Math.abs(tx) < 0.5 && Math.abs(tz) < 0.5) return;
    this.move(Math.abs(tx) > Math.abs(tz) ? (tx > 0 ? 'right' : 'left') : (tz > 0 ? 'down' : 'up'));
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    if (!this.level) return;
    let hop = 0;
    let e = 1;
    if (this.anim) {
      this.anim.t += dt / MOVE_T;
      const k = Math.min(1, this.anim.t);
      e = 1 - (1 - k) * (1 - k);
      this.pos.set(this.anim.fx + (this.hx - this.anim.fx) * e, this.anim.fy + (this.hy - this.anim.fy) * e);
      hop = Math.sin(k * Math.PI) * 0.12;
      if (k >= 1) {
        this.anim = null;
        this.pos.set(this.hx, this.hy);
        this.arrive();
        if (this.queued && this.active) { const q = this.queued; this.queued = null; this.move(q); }
      }
    }
    let ox = 0, oz = 0;
    if (this.bump) {
      this.bump.t += dt / 0.18;
      const s = Math.sin(Math.min(1, this.bump.t) * Math.PI) * 0.16;
      ox = this.bump.dx * s;
      oz = this.bump.dy * s;
      if (this.bump.t >= 1) this.bump = null;
    }
    if (this.goalStop) { ox += this.goalStop.x * e; oz += this.goalStop.y * e; }
    this.hero.group.position.set(this.pos.x + ox, 0, this.pos.y + oz);
    let dr = this.facing - this.hero.group.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    this.hero.group.rotation.y += dr * Math.min(1, dt * 14);
    this.hero.update(dt, t, hop);

    this.chest.update(dt, t);
    this.gems.forEach(g => g.update(dt, t));
    this.decor.forEach(d => d.update(dt, t));
    this.sparks.update(dt);
    if (this.level.fog) {
      const f = 0.9 + 0.1 * Math.sin(t * 11) * Math.sin(t * 6.3);
      this.torch.intensity = 9 * f;
      this.torchGlow.material.opacity = 0.75 * f;
    }
    this.paint(Math.min(1, dt * 7));

    // 鏡頭：開場由高處拉近，之後平滑跟住勇者
    this.introT = Math.min(1, this.introT + dt / 1.6);
    const zoom = 1 + 0.9 * Math.pow(1 - this.introT, 3);
    this.focusPoint(this.tmp);
    if (!this.camTarget) this.camTarget = this.tmp.clone();
    this.camTarget.lerp(this.tmp, Math.min(1, dt * 5));
    const dist = this.camDist * zoom;
    this.camera.position.set(
      this.camTarget.x,
      this.camTarget.y + dist * Math.sin(PITCH),
      this.camTarget.z + dist * Math.cos(PITCH),
    );
    this.camera.lookAt(this.camTarget);
    this.sun.target.position.copy(this.camTarget);
    this.sun.position.set(this.camTarget.x - 4, 10, this.camTarget.z + 6);
  }
}
