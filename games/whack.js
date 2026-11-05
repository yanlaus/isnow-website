/* 打怪不打村民：60 秒內打窗口嘅魔物，唔好打中村民（抑制控制） */
import { THREE, Scheduler, centerOnRect, fitCameraDistance, pickNearest, toScreen, pick } from './engine.js';
import { gradientTexture, Sparks } from './fx.js';
import { createVillager, createMonster } from './models.js';
import { Sound, buzz } from './sound.js';

const FOV = 36;
const SX = 1.8, SY = 1.8;          // 窗口間距
const WW = 1.24, WH = 1.3;         // 窗口開口
const LIMIT = 60;
const UP_T = 0.18;
const SHIRTS = [0x3f7fd0, 0x3fa35a, 0xd0703f, 0xc04f7a];
const HATS = [0x8a5a2b, 0x2f5a3a, 0x7a2a2a, 0x3a3a6a];

const lerp = (a, b, k) => a + (b - a) * k;

/* 複製材質並加上窗台裁切面（角色由窗台下面升起） */
function clipModel(group, plane) {
  group.traverse(o => {
    if (o.material) {
      o.material = o.material.clone();
      o.material.clippingPlanes = [plane];
    }
  });
}

export class WhackView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#2b2a6b', '#7a4a8a', '#e88a5a', '#f6c37a']);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xffe8d0, 0x4a3050, 1.5));
    const sun = new THREE.DirectionalLight(0xffe0b8, 2.4);
    sun.position.set(-6, 8, 10);
    this.scene.add(sun);

    this.house = new THREE.Group();
    this.scene.add(this.house);
    this.windows = [];
    this.sparks = new Sparks(this.scene, { cap: 500, size: 0.35 });
    this.v = new THREE.Vector3();
    this.camBase = new THREE.Vector3();
    this.W = 1;
    this.H = 1;
    this.winPx = 100;
    this.active = false;
  }

  hud() {
    return {
      mode: 'board',
      counter: '得分 <b>0</b>',
      intro: '魔物入侵村莊！',
      prep: '紫色紅眼＝魔物（要打）；戴帽笑臉＝村民（唔好打）',
      startMsg: '魔物出現就即刻點佢！',
      timeLimit: LIMIT,
    };
  }

  buildHouse(n, cols) {
    this.house.clear();
    this.windows = [];
    this.cols = cols;
    const COLS = cols;
    const rows = n / COLS;
    const gw = COLS * SX, gh = rows * SY;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1e2c4, roughness: 0.95 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.4, gh + 0.6, 0.3), wallMat);
    wall.position.set(0, 0, -0.15);
    this.house.add(wall);
    // 木樑
    for (let k = 0; k <= rows; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.6, 0.14, 0.16), beamMat);
      b.position.set(0, -gh / 2 - 0.3 + k * ((gh + 0.6) / rows), 0.02);
      this.house.add(b);
    }
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, gh + 0.7, 0.16), beamMat);
      b.position.set(s * (gw / 2 + 0.2), 0, 0.02);
      this.house.add(b);
    }
    // 屋頂
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, gw + 0.9, 3, 1), new THREE.MeshStandardMaterial({ color: 0xb2452f, roughness: 0.7, flatShading: true }));
    roof.rotation.z = Math.PI / 2;
    roof.rotation.x = -Math.PI / 2;   // 三角尖向上
    roof.position.set(0, gh / 2 + 0.3 + 0.42, -0.1);
    this.house.add(roof);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x7a5a4a, roughness: 0.9 }));
    chimney.position.set(gw / 2 - 0.6, gh / 2 + 1.2, -0.3);
    this.house.add(chimney);
    // 草地
    const grass = new THREE.Mesh(new THREE.BoxGeometry(gw + 6, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x5aa04a, roughness: 1 }));
    grass.position.set(0, -gh / 2 - 0.45, 0.6);
    this.house.add(grass);
    this.bounds = { w: gw + 1.0, top: gh / 2 + 1.25, bottom: -gh / 2 - 0.45 };

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.7 });
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x3f7a5a, roughness: 0.7 });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x241a2e });
    for (let i = 0; i < n; i++) {
      const cx = (i % COLS - (COLS - 1) / 2) * SX;
      const cy = ((rows - 1) / 2 - Math.floor(i / COLS)) * SY;
      const win = new THREE.Group();
      win.position.set(cx, cy, 0);
      this.house.add(win);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), darkMat);
      inner.position.z = 0.01;
      win.add(inner);
      const t = 0.12;
      [[0, WH / 2 + t / 2, WW + t * 2, t], [-WW / 2 - t / 2, 0, t, WH], [WW / 2 + t / 2, 0, t, WH]].forEach(([x, y, w, h]) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), frameMat);
        bar.position.set(x, y, 0.55);
        win.add(bar);
      });
      const sill = new THREE.Mesh(new THREE.BoxGeometry(WW + 0.5, 0.16, 0.5), frameMat);
      sill.position.set(0, -WH / 2 - 0.02, 0.5);
      win.add(sill);
      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.2, WH, 0.05), shutterMat);
        sh.position.set(s * (WW / 2 + 0.2), 0, 0.4);
        sh.rotation.y = s * 0.5;
        win.add(sh);
      }
      // 角色（每個窗各自一套，帶窗台裁切）
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const kinds = {
        monster: createMonster().group,
        villager: createVillager({ shirt: pick(SHIRTS), hat: pick(HATS) }).group,
        disguise: createVillager({ shirt: pick(SHIRTS), hat: pick(HATS), disguise: true }).group,
      };
      Object.values(kinds).forEach(g => {
        clipModel(g, plane);
        g.visible = false;
        g.position.z = 0.28;
        win.add(g);
      });
      this.windows.push({ i, win, plane, kinds, cur: null, phase: 'idle', t: 0, y: 0, stay: 1, spawnAt: 0, hitT: 0 });
    }
  }

  /* 直向畫面：六個窗排兩欄，窗口大啲 */
  colsFor(n) {
    const portrait = this.rect && this.rect.width / this.rect.height < 0.85;
    return portrait && n === 6 ? 2 : 3;
  }

  showDemo() {
    // 開場示範：一隻魔物、一個村民
    this.show(this.windows[0], 'monster', 99);
    if (this.windows[1]) this.show(this.windows[1], 'villager', 99);
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    this.buildHouse(level.windows, this.colsFor(level.windows));
    this.score = 0;
    this.hits = 0;
    this.villagerHits = 0;
    this.escaped = 0;
    this.spawned = 0;
    this.reactions = [];
    this.combo = 0;
    this.playT = 0;
    this.spawnT = 0.8;
    this.ended = false;
    this.active = false;
    this.showDemo();
    this.layout();
  }

  begin() {
    this.active = true;
    this.windows.forEach(w => { if (w.phase !== 'idle') this.hide(w); });
  }

  abort() {
    this.active = false;
    this.ended = true;
    this.sched.clear();
  }

  show(w, kind, stay) {
    Object.entries(w.kinds).forEach(([k, g]) => { g.visible = k === kind; g.scale.set(1, 1, 1); g.rotation.set(0, 0, 0); });
    w.cur = kind;
    w.phase = 'up';
    w.t = 0;
    w.stay = stay;
    w.spawnAt = this.playT;
  }

  hide(w) {
    if (w.phase === 'idle') return;
    w.phase = 'down';
    w.t = 0;
  }

  spawn() {
    const free = this.windows.filter(w => w.phase === 'idle');
    const up = this.windows.length - free.length;
    if (!free.length || up >= this.level.maxUp) return;
    const w = pick(free);
    const lv = this.level;
    let kind = 'monster';
    if (Math.random() < lv.villager) kind = 'villager';
    else if (lv.disguise && Math.random() < lv.disguise) kind = 'disguise';
    if (kind !== 'villager') this.spawned += 1;
    const k = Math.min(1, this.playT / LIMIT);
    this.show(w, kind, lerp(lv.stay[0], lv.stay[1], k));
    Sound.pop();
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
    if (!r || !this.bounds) return;
    const cols = this.colsFor(this.level.windows);
    if (cols !== this.cols) {
      this.buildHouse(this.level.windows, cols);
      if (!this.active) this.showDemo();
    }
    centerOnRect(this.camera, r, this.W, this.H);
    const { w, top, bottom } = this.bounds;
    const pts = [];
    for (const x of [-w / 2, w / 2]) for (const y of [top, bottom]) pts.push(new THREE.Vector3(x, y, 0.3));
    const target = new THREE.Vector3(0, (top + bottom) / 2, 0);
    const dir = new THREE.Vector3(0, 0.12, 1).normalize();
    fitCameraDistance(this.camera, target, dir, pts, r, this.W, this.H, 4);
    this.camBase.copy(this.camera.position);
    this.house.updateMatrixWorld(true);
    // 窗台裁切面（世界座標）
    this.windows.forEach(win => {
      win.win.localToWorld(this.v.set(0, -WH / 2 + 0.06, 0));
      win.plane.constant = -this.v.y;
    });
    const a = toScreen(this.windows[0].win, this.camera, this.W, this.H, {});
    const b = toScreen(this.windows[1].win, this.camera, this.W, this.H, {});
    this.winPx = Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* ---------- 觸控 ---------- */
  pointerDown(x, y) {
    if (!this.active || this.ended) return;
    const w = pickNearest(this.windows, ww => ww.win, x, y, this.camera, this.W, this.H, this.winPx * 0.62);
    if (!w || (w.phase !== 'up' && w.phase !== 'stay')) return;
    const s = toScreen(w.win, this.camera, this.W, this.H, {});
    if (w.cur === 'villager') {
      this.villagerHits += 1;
      this.combo = 0;
      this.score = Math.max(0, this.score - 5);
      w.phase = 'bow';
      w.t = 0;
      Sound.oops();
      buzz([20, 40, 20]);
      this.hooks.popup('唔緊要！', s.x, s.y - this.winPx * 0.35, 'combo');
      this.hooks.popup('-5', s.x, s.y, '');
      this.hooks.toast('打中村民喇！佢話唔緊要（-5 分）');
    } else {
      const react = this.playT - w.spawnAt;
      this.reactions.push(react);
      this.hits += 1;
      this.combo += 1;
      const pts = 10 + (react < 0.7 ? 5 : 0);
      this.score += pts;
      w.phase = 'hit';
      w.t = 0;
      Sound.whack();
      buzz(18);
      w.win.localToWorld(this.v.set(0, 0, 0.6));
      this.sparks.spawn(this.v, { count: 26, color: 0xffd56a, speed: 4, life: 0.6, gravity: 4 });
      this.hooks.popup(`+${pts}`, s.x, s.y, pts > 10 ? 'crit' : '');
      if (this.combo >= 5 && this.combo % 5 === 0) this.hooks.toast(`${this.combo} 連擊！村民多謝你！`);
      else if (w.cur === 'disguise') this.hooks.toast('識破咗！係扮村民嘅魔物！');
    }
    this.hooks.counter(`得分 <b>${this.score}</b>`);
  }

  timeUp() {
    if (this.ended) return;
    this.ended = true;
    this.windows.forEach(w => { if (w.phase === 'up' || w.phase === 'stay') this.hide(w); });
    this.hooks.toast('時間到！');
    this.sched.after(1.0, () => this.finish());
  }

  finish() {
    this.active = false;
    const time = this.hooks.complete();
    const total = Math.max(1, this.spawned);
    const rate = this.hits / total;
    const stars = rate >= 0.75 && this.villagerHits <= 2 ? 3 : rate >= 0.5 ? 2 : 1;
    const avg = this.reactions.length ? this.reactions.reduce((a, b) => a + b, 0) / this.reactions.length : 0;
    this.hooks.finish({
      score: this.score, time, stars,
      lines: [['打中魔物', `${this.hits}/${this.spawned}`], ['誤打村民', this.villagerHits], ['平均反應', avg ? `${avg.toFixed(2)} 秒` : '—']],
      bonus: this.villagerHits === 0 ? 10 : 0,
      kicker: 'VILLAGE SAVED',
      title: stars === 3 ? '村莊守護神！' : stars === 2 ? '成功擊退魔物！' : '村莊得救了！',
    });
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    if (this.active && !this.ended) {
      this.playT += dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        const k = Math.min(1, this.playT / LIMIT);
        this.spawnT = lerp(this.level.interval[0], this.level.interval[1], k) * (0.75 + Math.random() * 0.5);
      }
    }
    for (const w of this.windows) {
      if (w.phase === 'idle') continue;
      const g = w.kinds[w.cur];
      w.t += dt;
      if (w.phase === 'up') {
        const k = Math.min(1, w.t / UP_T);
        w.y = -1.25 * (1 - k);
        if (k >= 1) { w.phase = 'stay'; w.t = 0; }
      } else if (w.phase === 'stay') {
        w.y = Math.sin(t * 6 + w.i) * 0.03;
        if (w.t >= w.stay && this.active) {
          if (w.cur !== 'villager') this.escaped += 1;
          this.hide(w);
        }
      } else if (w.phase === 'down') {
        const k = Math.min(1, w.t / UP_T);
        w.y = -1.25 * k;
        if (k >= 1) { w.phase = 'idle'; g.visible = false; }
      } else if (w.phase === 'hit') {
        const k = Math.min(1, w.t / 0.35);
        g.scale.set(1 + k * 0.4, 1 - k * 0.6, 1);
        w.y = -1.25 * k * k;
        if (k >= 1) { w.phase = 'idle'; g.visible = false; g.scale.set(1, 1, 1); }
      } else if (w.phase === 'bow') {
        g.rotation.x = Math.sin(Math.min(1, w.t / 0.6) * Math.PI) * 0.5;
        if (w.t >= 0.7) { g.rotation.x = 0; this.hide(w); }
      }
      g.position.y = w.y;
    }
  }
}
