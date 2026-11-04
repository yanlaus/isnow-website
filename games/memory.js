/* 寶箱記憶：開局寶箱打開幾秒，記住寶物，再逐對揭開配對 */
import { THREE, Scheduler, centerOnRect, fitCameraDistance, pickNearest, toScreen, shuffle } from './engine.js';
import { gradientTexture, Sparks, Embers, blobShadow, makeGlow } from './fx.js';
import { createChest, createTorch } from './models.js';
import { createItem, ITEM_KINDS } from './items.js';
import { Sound, buzz } from './sound.js';

const FOV = 40;
const PITCH = THREE.MathUtils.degToRad(54);
const SP = 1.3;           // 寶箱間距
const ITEM_NAMES = {
  sword: '勇者之劍', shield: '勇者之盾', potion: '回復藥水', crown: '黃金皇冠', key: '黃金鎖匙',
  scroll: '魔法卷軸', ring: '水晶戒指', helmet: '騎士頭盔', boot: '疾風之靴',
};

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const cols = ['#3a2a4e', '#43305a'];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = cols[(x + y) % 2];
    g.fillRect(x * 128, y * 128, 128, 128);
  }
  g.strokeStyle = 'rgba(0,0,0,.45)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, 256, 256);
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  t.anisotropy = 4;
  return t;
}

function coinPile(n = 14) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xf5c842, metalness: 0.75, roughness: 0.3, emissive: 0x3a2800, flatShading: true });
  const geo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(geo, m);
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
    c.position.set(Math.cos(a) * r, 0.02 + Math.random() * 0.25 * (1 - r), Math.sin(a) * r);
    c.rotation.set(Math.random() * 0.6, 0, Math.random() * 0.6);
    g.add(c);
  }
  return g;
}

export class MemoryView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#2a1a3a', '#170e26', '#08050f']);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xd8d0ff, 0x2a1a30, 1.3));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.3);
    key.position.set(-4, 9, 7);
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffc070, 8, 14, 1.5);
    warm.position.set(0, 4, 1);
    this.scene.add(warm);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    this.decor = new THREE.Group();
    this.scene.add(this.decor);
    this.torches = [-1, 1].map(s => {
      const t = createTorch({ light: true, height: 1.2 });
      this.decor.add(t.group);
      t.side = s;
      return t;
    });
    this.piles = [-1, 1].map(() => { const p = coinPile(); this.decor.add(p); return p; });

    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.sparks = new Sparks(this.scene, { cap: 500, size: 0.3 });
    this.embers = new Embers(this.scene, { count: 40, box: [12, 4, 10], center: [0, 2, 0], color: 0xffe08a, size: 0.1, speed: 0.3 });

    this.cells = [];
    this.W = 1;
    this.H = 1;
    this.cellPx = 80;
    this.active = false;
    this.v = new THREE.Vector3();
  }

  hud(level) {
    return {
      mode: 'board',
      counter: `配對 <b>0/${level.pairs}</b>`,
      intro: '🎁 寶物庫大門打開了！',
      prep: '開局寶箱會打開幾秒，記住入面嘅寶物！',
      manualClock: true,
    };
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    this.cells.forEach(c => this.board.remove(c.group));
    const kinds = shuffle(ITEM_KINDS.slice()).slice(0, level.pairs);
    const list = shuffle([
      ...kinds.map(k => ({ kind: k })), ...kinds.map(k => ({ kind: k })),
      ...Array.from({ length: level.traps }, () => ({ trap: true })),
    ]);
    this.cells = list.map((spec, i) => {
      const group = new THREE.Group();
      const chest = createChest({ beacon: false, light: false, mimic: !!spec.trap });
      group.add(chest.group);
      group.add(blobShadow(1.0, 0.45));
      let item = null;
      if (!spec.trap) {
        item = createItem(spec.kind);
        item.scale.setScalar(0.001);
        item.visible = false;
        group.add(item);
      }
      this.board.add(group);
      return {
        i, group, chest, item, kind: spec.kind, trap: !!spec.trap,
        state: 'closed', lift: 0, liftTarget: 0, fly: -1, sink: -1, seed: Math.random() * 6,
      };
    });
    this.found = 0;
    this.misses = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.trapHits = 0;
    this.first = null;
    this.pending = null;
    this.active = false;
    this.locked = true;
    this.layout();
  }

  begin() {
    this.active = true;
    this.locked = true;
    const sec = this.level.preview;
    this.cells.forEach(c => this.openCell(c, false));
    Sound.flip();
    this.hooks.toast(`記住寶物位置！還有 ${sec} 秒`);
    for (let i = 1; i < sec; i++) this.sched.after(i, () => this.hooks.toast(`記住寶物位置！還有 ${sec - i} 秒`));
    this.sched.after(sec, () => {
      this.cells.forEach(c => this.closeCell(c));
      Sound.close();
      this.sched.after(0.45, () => {
        this.locked = false;
        this.hooks.clockStart();
        this.hooks.toast(this.level.traps ? '揭開兩個相同嘅寶物！小心假寶箱！' : '揭開兩個相同嘅寶物！');
      });
    });
  }

  abort() {
    this.active = false;
    this.sched.clear();
  }

  openCell(c, sound = true) {
    c.state = 'open';
    c.chest.open(false);
    c.liftTarget = 1;
    if (c.item) c.item.visible = true;
    if (sound) Sound.flip();
  }

  closeCell(c) {
    if (c.state !== 'open') return;
    c.state = 'closed';
    c.liftTarget = 0;
    c.chest.close();
  }

  /* ---------- 版面 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRects({ play }) {
    this.rect = play;
    this.layout();
  }

  layout() {
    const r = this.rect;
    if (!r || !this.cells.length) return;
    const n = this.cells.length;
    // 揀最啱遊戲區比例嘅行列
    const aspect = r.width / r.height;
    let best = null;
    for (let cols = 2; cols <= 7; cols++) {
      if (n % cols) continue;
      const rows = n / cols;
      if (rows < 2 || rows > 7) continue;
      const a = cols / (rows * Math.sin(PITCH) + 0.6);
      const score = Math.abs(Math.log(a / aspect));
      if (!best || score < best.score) best = { cols, rows, score };
    }
    const { cols, rows } = best;
    this.cols = cols;
    this.rows = rows;
    this.cells.forEach((c, i) => {
      const cx = i % cols, cz = Math.floor(i / cols);
      c.group.position.set((cx - (cols - 1) / 2) * SP, c.group.position.y, (cz - (rows - 1) / 2) * SP);
    });
    const hx = (cols - 1) / 2 * SP + 0.5, hz = (rows - 1) / 2 * SP + 0.45;
    this.torches.forEach(t => t.group.position.set(t.side * (hx + 0.6), 0, -hz - 0.2));
    this.piles.forEach((p, i) => p.position.set((i ? 1 : -1) * (hx + 0.7), 0, hz - 0.1));

    centerOnRect(this.camera, r, this.W, this.H);
    const pts = [];
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) for (const y of [0, 1.25]) pts.push(new THREE.Vector3(x, y, z));
    const target = new THREE.Vector3(0, 0.35, 0);
    const dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    fitCameraDistance(this.camera, target, dir, pts, r, this.W, this.H, 6);
    const a = toScreen(new THREE.Vector3(0, 0.3, 0), this.camera, this.W, this.H, {});
    const b = toScreen(new THREE.Vector3(SP, 0.3, 0), this.camera, this.W, this.H, {});
    this.cellPx = Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* ---------- 觸控 ---------- */
  pointerDown(x, y) {
    if (!this.active || this.locked) return;
    const cell = pickNearest(
      this.cells.filter(c => c.state === 'closed'),
      c => this.v.copy(c.group.position).setY(0.3),
      x, y, this.camera, this.W, this.H, this.cellPx * 0.62,
    );
    if (cell) this.tap(cell);
  }

  tap(cell) {
    if (this.pending) this.resolvePending();
    if (cell.trap) { this.trapBite(cell); return; }
    this.openCell(cell);
    if (!this.first) { this.first = cell; return; }
    const a = this.first;
    this.first = null;
    if (a.kind === cell.kind) this.match(a, cell);
    else this.mismatch(a, cell);
  }

  match(a, b) {
    a.state = b.state = 'matched';
    this.found += 1;
    this.streak += 1;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    this.hooks.counter(`配對 <b>${this.found}/${this.level.pairs}</b>`);
    this.hooks.toast(this.streak >= 3 ? `${this.streak} 連續配對！${ITEM_NAMES[a.kind]}到手！` : `配對成功！${ITEM_NAMES[a.kind]}到手！`);
    this.sched.after(0.35, () => {
      Sound.gem();
      buzz(20);
      [a, b].forEach(c => {
        c.fly = 0;
        this.v.copy(c.group.position).setY(1.0);
        this.sparks.spawn(this.v, { count: 26, color: 0xffd56a, speed: 3, life: 0.7, gravity: 2 });
      });
    });
    this.sched.after(0.9, () => { a.sink = 0; b.sink = 0; });
    if (this.found === this.level.pairs) this.finish();
  }

  mismatch(a, b) {
    this.misses += 1;
    this.streak = 0;
    this.hooks.toast(`唔同喎：${ITEM_NAMES[a.kind]}同${ITEM_NAMES[b.kind]}`);
    const pend = [a, b];
    this.pending = pend;
    this.sched.after(1.1, () => { if (this.pending === pend) this.resolvePending(); });
  }

  resolvePending() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.forEach(c => this.closeCell(c));
    Sound.close();
  }

  trapBite(cell) {
    cell.chest.bite();
    Sound.bite();
    buzz([30, 30, 60]);
    this.trapHits += 1;
    this.hooks.penalty(3);
    const s = toScreen(this.v.copy(cell.group.position).setY(0.8), this.camera, this.W, this.H, {});
    this.hooks.popup('+3 秒', s.x, s.y, 'crit');
    this.hooks.toast('係假寶箱！被咬咗一啖（+3 秒）');
  }

  finish() {
    this.active = false;
    this.locked = true;
    const time = this.hooks.complete();
    this.hooks.toast('全部寶物到手！');
    const lv = this.level;
    const stars = time <= lv.stars[0] ? 3 : time <= lv.stars[1] ? 2 : 1;
    const { misses, maxStreak, trapHits } = this;
    this.sched.after(1.0, () => {
      Sound.chest();
      this.v.set(0, 1.2, 0);
      this.sparks.spawn(this.v, { count: 120, color: 0xffd56a, speed: 6, life: 1.1, gravity: 4, up: 3 });
    });
    this.sched.after(2.0, () => this.hooks.finish({
      time, stars,
      lines: [
        ['失誤', misses === 0 ? '0 ✨' : misses],
        ['最長連續配對', maxStreak],
        lv.traps ? ['被假寶箱咬', trapHits] : ['寶物', `${lv.pairs} 對`],
      ],
      bonus: misses === 0 ? 10 : 0,
      kicker: 'TREASURE GET',
      title: stars === 3 ? '過目不忘！' : stars === 2 ? '記性真好！' : '寶物全部到手！',
    }));
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    this.embers.update(dt, t);
    this.torches.forEach(tc => tc.update(dt, t));
    for (const c of this.cells) {
      c.chest.update(dt, t);
      c.lift += (c.liftTarget - c.lift) * Math.min(1, dt * 8);
      if (c.item) {
        if (c.fly >= 0) {
          c.fly = Math.min(1, c.fly + dt / 0.6);
          c.item.position.y = 1.0 + c.fly * 1.6;
          c.item.scale.setScalar(Math.max(0.001, 1.15 * (1 - c.fly)));
          c.item.rotation.y += dt * 10;
          if (c.fly >= 1) c.item.visible = false;
        } else {
          const k = c.lift;
          c.item.visible = k > 0.02;
          c.item.position.y = 0.3 + k * 0.72 + Math.sin(t * 2 + c.seed) * 0.03 * k;
          c.item.scale.setScalar(Math.max(0.001, k * 1.15));
          c.item.rotation.y = Math.sin(t * 1.2 + c.seed) * 0.45;
        }
      }
      if (c.sink >= 0) {
        c.sink = Math.min(1, c.sink + dt / 0.6);
        c.group.position.y = -0.7 * c.sink * c.sink;
        if (c.sink >= 1) c.group.visible = false;
      }
    }
  }
}
