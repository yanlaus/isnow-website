/* 格仔世界基底：斜俯視鏡頭、北方永遠向上、勇者逐格行、方向掣／滑動／點地面
   地下迷宮同一筆畫地城共用 */
import { THREE, clamp, Scheduler, centerOnRect } from './engine.js';
import { gradientTexture, Sparks } from './fx.js';
import { createHero } from './models.js';
import { Sound, buzz } from './sound.js';

export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = {
  up:    { name: 'up',    dx: 0,  dy: -1, bit: N, opp: S, face: Math.PI },
  right: { name: 'right', dx: 1,  dy: 0,  bit: E, opp: W, face: Math.PI / 2 },
  down:  { name: 'down',  dx: 0,  dy: 1,  bit: S, opp: N, face: 0 },
  left:  { name: 'left',  dx: -1, dy: 0,  bit: W, opp: E, face: -Math.PI / 2 },
};
const FOV = 42;
export const PITCH = THREE.MathUtils.degToRad(57);
const MOVE_T = 0.15;

export class GridWorld {
  constructor(hooks, { bg = ['#1a1838', '#100e24', '#07060f'] } = {}) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.bgNormal = gradientTexture(bg);
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
    this.sparks = new Sparks(this.scene, { cap: 400, size: 0.32 });

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ndc = new THREE.Vector2();
    this.hit = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.W = 1;
    this.H = 1;
    this.camDist = 10;
    this.level = null;
    this.n = 0;
    this.active = false;
    this.minCell = 50;
    this.wallH = 0.42;
    this.alwaysFull = false;
  }

  idx(x, y) { return y * this.n + x; }

  /* 子類喺 setup() 入面叫：勇者返去起點 */
  resetHero(x, y) {
    this.sched.clear();
    this.hx = x;
    this.hy = y;
    this.pos = new THREE.Vector2(x, y);
    this.anim = null;
    this.queued = null;
    this.bump = null;
    this.goalStop = null;
    this.facing = 0;
    this.steps = 0;
    this.drag = null;
    this.active = false;
    this.locked = false;
    this.hero.group.position.set(x, 0, y);
    this.hero.group.rotation.y = 0;
    this.introT = 0;
    this.camTarget = null;
  }

  begin() { this.active = true; }
  abort() { this.active = false; this.queued = null; this.sched.clear(); }

  /* ---------- 子類覆寫 ---------- */
  canStep() { return true; }
  onStep() {}
  onArrive() {}
  tick() {}

  /* ---------- 移動 ---------- */
  move(dirName) {
    if (!this.active || this.locked) return false;
    if (this.anim) { this.queued = dirName; return true; }
    const d = DIRS[dirName];
    this.facing = d.face;
    const nx = this.hx + d.dx, ny = this.hy + d.dy;
    const ok = this.canStep(d, nx, ny);
    if (!ok) {
      this.bump = { dx: d.dx, dy: d.dy, t: 0 };
      Sound.bump();
      buzz(15);
      return false;
    }
    const from = this.idx(this.hx, this.hy);
    this.anim = { fx: this.hx, fy: this.hy, t: 0 };
    this.hx = nx;
    this.hy = ny;
    this.goalStop = null;
    this.steps += 1;
    this.onStep(d, from, this.idx(nx, ny));
    return true;
  }

  /* ---------- 版面同鏡頭 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRects({ play }) {
    this.playRect = play;
    this.layout();
  }

  layout() {
    if (!this.playRect || !this.n) return;
    const r = this.playRect;
    const n = this.n;
    centerOnRect(this.camera, r, this.W, this.H);
    const room = Math.min(r.width, r.height / Math.sin(PITCH));
    let extent = Math.max(5, Math.floor(room / this.minCell));
    if (extent >= n || this.alwaysFull) extent = n;
    this.extent = extent;
    this.follow = extent < n;
    this.camDist = this.fitDistance(extent, r);
    this.cellPx = room / (extent + 1);
  }

  /* 二分法搵鏡頭距離：可見範圍嘅角落（連牆高同勇者高度）全部投影入遊戲區 */
  fitDistance(extent, r) {
    const h = extent / 2 + 0.45;
    const wh = this.wallH;
    const pts = [[-h, 0, -h], [h, 0, -h], [-h, wh, h], [h, wh, h], [-h, 0, h], [h, 0, h], [-h, 1, -h], [h, 1, -h]];
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
    this.sched.update(dt);
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
        this.onArrive();
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
    this.sparks.update(dt);
    this.tick(dt, t);

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
