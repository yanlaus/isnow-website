/* 地下迷宮：斜俯視 3D 地城，鏡頭跟住勇者，北方永遠喺畫面上方 */
import { THREE, shuffle, pick } from './engine.js';
import { gradientTexture, makeGlow } from './fx.js';
import { createChest, createGem, createTorch } from './models.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';
import { GridWorld, DIRS, N, E, S, W } from './grid-world.js';

const WALL_H = 0.42;
const WALL_T = 0.15;
const LIGHT_R = 2.3;

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

export class MazeView extends GridWorld {
  constructor(hooks) {
    super(hooks);
    this.bgDark = gradientTexture(['#06050c', '#030307']);
    this.torch = new THREE.PointLight(0xffa64d, 0, 6, 1.6);
    this.torch.position.set(0, 1.1, 0.2);
    this.hero.group.add(this.torch);
    this.torchGlow = makeGlow(0xff9a3c, 1.4, 0);
    this.torchGlow.position.set(-0.3, 0.95, 0.15);
    this.hero.group.add(this.torchGlow);

    this.chest = createChest();
    this.scene.add(this.chest.group);
    this.mtx = new THREE.Matrix4();
    this.col = new THREE.Color();
    this.disposables = [];
    this.gems = [];
    this.decor = [];
  }

  hud(level) {
    return {
      mode: 'grid',
      counter: `${icon('gem')}<b>0/${this.gemTotal}</b>`,
      intro: level.fog ? '點起火把，進入黑暗迷宮' : '進入地下迷宮',
      prep: level.fog ? '四周一片黑暗……寶箱在遠處發光！' : '找出通往寶箱的路！',
      startMsg: '用方向掣、滑動或點擊地面前進',
    };
  }

  /* ---------- 建立一局 ---------- */
  setup(level) {
    this.level = level;
    this.n = level.size;
    this.minCell = level.fog ? 62 : 50;
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
    this.gems.forEach(g => this.world.remove(g.group));
    this.decor.forEach(d => this.world.remove(d.group));

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
    this.walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), segs.length);
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    segs.forEach((s, k) => {
      sc.set(s.h ? 1 + WALL_T : WALL_T, WALL_H, s.h ? WALL_T : 1 + WALL_T);
      this.mtx.compose(this.tmp.set(s.x, WALL_H / 2, s.z), q, sc);
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
    this.resetHero(0, 0);
    this.finished = false;
    this.seen = new Uint8Array(n * n);
    this.visited = new Uint8Array(n * n);
    this.visited[0] = 1;
    this.bright = new Float32Array(n * n).fill(fog ? 0 : 1);
    this.reveal();
    this.paint(1);
    this.layout();
  }

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

  /* ---------- 移動規則 ---------- */
  canStep(d) {
    return !(this.cells[this.idx(this.hx, this.hy)] & d.bit);
  }

  onStep(d, from, to) {
    // 行入終點格時停喺寶箱前面，唔好企入寶箱
    if (to === this.goal) this.goalStop = { x: -d.dx * 0.34, y: -d.dy * 0.34 };
    this.visited[to] = 1;
    this.reveal();
    Sound.step();
  }

  onArrive() {
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
      this.hooks.counter(`${icon('gem')}<b>${this.collected}/${this.gemTotal}</b>`);
      this.hooks.toast(this.collected === this.gemTotal ? '寶石全部到手！向寶箱進發！' : `得到了寶石！（${this.collected}/${this.gemTotal}）`);
    }
    if (j === this.goal) this.finish();
  }

  finish() {
    this.active = false;
    this.finished = true;
    this.queued = null;
    const time = this.hooks.complete();
    this.chest.open();
    this.hero.celebrate();
    Sound.chest();
    buzz([40, 60, 80]);
    this.tmp.set(this.hx, 0.6, this.hy);
    this.sparks.spawn(this.tmp, { count: 90, color: 0xffd56a, speed: 5, life: 1, gravity: 4, up: 3 });
    this.hooks.toast('打開寶箱！迷宮攻略成功！');

    const lv = this.level;
    const fogMul = lv.fog ? 1.35 : 1;
    const par3 = (this.shortest * 0.6 + 5) * fogMul;
    const par2 = (this.shortest * 1.25 + 12) * fogMul;
    const stars = time <= par3 ? 3 : time <= par2 ? 2 : 1;
    const { steps, shortest, collected, gemTotal } = this;
    this.sched.after(1.4, () => this.hooks.finish({
      time, stars,
      lines: [['步數', steps], ['最短路線', shortest], ['寶石', `${collected}/${gemTotal}`]],
      bonus: collected * 5 + (collected === gemTotal && gemTotal ? 10 : 0),
      kicker: 'DUNGEON CLEAR',
      title: stars === 3 ? '完美攻略！' : stars === 2 ? '迷宮攻略成功！' : '成功脫出迷宮！',
    }));
  }

  tick(dt, t) {
    this.chest.update(dt, t);
    this.gems.forEach(g => g.update(dt, t));
    this.decor.forEach(d => d.update(dt, t));
    if (this.level.fog) {
      const f = 0.9 + 0.1 * Math.sin(t * 11) * Math.sin(t * 6.3);
      this.torch.intensity = 9 * f;
      this.torchGlow.material.opacity = 0.75 * f;
    }
    this.paint(Math.min(1, dt * 7));
  }
}
