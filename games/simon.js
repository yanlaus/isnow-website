/* 咒文連鎖：水晶按次序閃光，照住點返；連鎖夠長勇者放必殺技 */
import { THREE, Scheduler, centerOnRect, fitCameraDistance, pickNearest, toScreen, randInt } from './engine.js';
import { gradientTexture, Sparks, Embers, starField, makeGlow, blobShadow } from './fx.js';
import { createHero, createGolem, createTorch } from './models.js';
import { fmtTime } from './store.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';

const FOV = 38;
const PITCH = THREE.MathUtils.degToRad(24);
const MAX_CHAIN = 20;
const ULT_AT = [5, 8, 11, 14, 17, 20];
const ULT_NAMES = ['流星斬', '雷光劍', '天空斬', '極光爆裂', '星河一閃', '勇者之光'];
/* 寶石：顏色之外，輪廓都唔同（色弱都分得出） */
const lathe = (pts, seg) => {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals();
  return g;
};
function emeraldCut() {
  // 長方階梯切割（八角形板）
  const w = 0.24, h = 0.32, c = 0.08;
  const sh = new THREE.Shape();
  sh.moveTo(-w + c, -h);
  sh.lineTo(w - c, -h); sh.lineTo(w, -h + c); sh.lineTo(w, h - c); sh.lineTo(w - c, h);
  sh.lineTo(-w + c, h); sh.lineTo(-w, h - c); sh.lineTo(-w, -h + c); sh.lineTo(-w + c, -h);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 1 });
  g.translate(0, 0, -0.06);
  return g;
}
const CRYSTALS = [
  { name: '紅寶石', color: 0xc8243c, geo: () => { const g = new THREE.OctahedronGeometry(0.36); g.scale(1, 1.2, 1); return g; } },
  { name: '藍寶石', color: 0x2a5fd0, geo: () => new THREE.ConeGeometry(0.34, 0.7, 3) },
  { name: '黃玉', color: 0xe0a826, geo: () => new THREE.DodecahedronGeometry(0.34) },
  { name: '祖母綠', color: 0x17a063, geo: emeraldCut },
  { name: '紫晶', color: 0x8a4cc8, geo: () => lathe([[0, -0.4], [0.22, -0.2], [0.22, 0.2], [0, 0.46]], 6) },
  { name: '鑽石', color: 0xd8ecff, geo: () => lathe([[0, -0.36], [0.4, 0.06], [0.4, 0.1], [0.24, 0.26], [0, 0.26]], 8) },
];
const GOLEMS = [
  { rock: 0x5c6656, crystal: 0x6fd39a },
  { rock: 0x6a7a92, crystal: 0x7fd0f0 },
  { rock: 0x3e3230, crystal: 0xff7a2a },
  { rock: 0x241e30, crystal: 0xb05cff, boss: true },
];

export class SimonView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#121a3c', '#0b1028', '#05060f']);
    this.scene.fog = new THREE.Fog(0x0b1028, 16, 46);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);

    this.scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x2a1d3d, 1.4));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
    key.position.set(-5, 8, 8);
    this.scene.add(key);
    this.flashLight = new THREE.PointLight(0xffffff, 0, 6, 2);
    this.scene.add(this.flashLight);
    const stars = starField(500, 90);
    stars.material.fog = false;
    this.scene.add(stars);

    // 祭壇地台
    const altar = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x34323e, roughness: 0.95, flatShading: true }),
    );
    altar.position.set(0, -0.2, -0.6);
    this.scene.add(altar);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.75, 64), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.01, -0.6);
    this.scene.add(ring);
    this.torches = [-1, 1].map(s => {
      const t = createTorch({ light: false, height: 1.4 });
      t.group.position.set(3.9 * s, 0, -2.6);
      this.scene.add(t.group);
      return t;
    });

    this.hero = createHero();
    this.hero.group.scale.setScalar(1.35);
    this.heroBase = new THREE.Vector3(-1.9, 0, -2.3);
    this.hero.group.position.copy(this.heroBase);
    this.hero.group.rotation.y = 0.85;
    this.scene.add(this.hero.group);

    this.golemBase = new THREE.Vector3(1.8, 0, -3.1);
    this.golem = null;

    // 必殺技光柱
    this.pillarMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 14, 20, 1, true), this.pillarMat);
    this.pillar.position.copy(this.golemBase).setY(6);
    this.scene.add(this.pillar);

    this.stoneMat = new THREE.MeshStandardMaterial({ color: 0x57535f, roughness: 0.9, flatShading: true });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.75, roughness: 0.3 });
    this.crystalGroup = new THREE.Group();
    this.scene.add(this.crystalGroup);
    this.crystals = [];
    this.sparks = new Sparks(this.scene, { cap: 700, size: 0.4 });
    this.embers = new Embers(this.scene, { count: 50, box: [14, 8, 8], center: [0, 2, -2], color: 0xe8c98a, size: 0.1, speed: 0.4 });

    this.v = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.camBase = new THREE.Vector3();
    this.shake = 0;
    this.W = 1;
    this.H = 1;
    this.crystalPx = 90;
    this.active = false;
  }

  hud(level) {
    return {
      mode: 'board',
      counter: this.counterHtml(),
      intro: level.reverse ? '倒轉咒文：要倒轉次序點返' : '詠唱咒文，召喚必殺技',
      prep: '水晶會按次序閃光同發聲，記住佢！',
    };
  }

  counterHtml() {
    const hearts = icon('heart', 'fill').repeat(Math.max(0, this.lives)) + icon('heart').repeat(Math.max(0, 2 - this.lives));
    return `連鎖 <b>${this.best}</b><span class="lives">${hearts}</span>`;
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    this.crystals.forEach(c => this.crystalGroup.remove(c.group));
    this.crystals = CRYSTALS.slice(0, level.crystals).map((spec, idx) => {
      const group = new THREE.Group();
      // 雕石底座 + 金邊 + 一圈符文光
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8), this.stoneMat);
      ped.position.y = 0.3;
      group.add(ped);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.1, 8), this.stoneMat);
      foot.position.y = 0.05;
      group.add(foot);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.1, 8), this.stoneMat);
      top.position.y = 0.6;
      group.add(top);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 4, 8), this.goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.rotation.z = Math.PI / 8;
      rim.position.y = 0.655;
      group.add(rim);
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24),
        new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.657;
      group.add(rune);
      group.add(blobShadow(1.1, 0.4));
      const mat = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.3, roughness: 0.12, metalness: 0.2, flatShading: true });
      const mesh = new THREE.Mesh(spec.geo(), mat);
      mesh.position.y = 1.05;
      group.add(mesh);
      const glow = makeGlow(spec.color, 1.4, 0.35);
      glow.position.y = 1.05;
      group.add(glow);
      this.crystalGroup.add(group);
      return { idx, group, mesh, mat, glow, rune: rune.material, color: spec.color, flash: 0, hold: 0, shake: 0, seed: Math.random() * 6 };
    });
    this.seq = [];
    this.best = 0;
    this.lives = 2;
    this.mistakes = 0;
    this.ultimates = 0;
    this.golemIdx = 0;
    this.phase = 'idle';
    this.inputIdx = 0;
    this.active = false;
    this.heroJump = -1;
    this.pillarT = -1;
    this.spawnGolem(true);
    this.layout();
  }

  spawnGolem(instant = false) {
    if (this.golem) this.scene.remove(this.golem.group);
    const spec = GOLEMS[this.golemIdx % GOLEMS.length];
    this.golem = createGolem(spec);
    this.golem.group.scale.setScalar(0.72);
    this.golem.group.position.copy(this.golemBase);
    this.golem.group.rotation.y = -0.7;
    this.scene.add(this.golem.group);
    this.golemRise = instant ? 1 : 0;
    if (!instant) Sound.rumble();
  }

  begin() {
    this.active = true;
    this.seq = [randInt(0, this.crystals.length - 1)];
    this.addStep();
    this.sched.after(0.3, () => this.playback());
  }

  abort() {
    this.active = false;
    this.phase = 'idle';
    this.sched.clear();
  }

  addStep() {
    const n = this.crystals.length;
    let c;
    do { c = randInt(0, n - 1); }
    while (this.seq.length >= 2 && c === this.seq[this.seq.length - 1] && c === this.seq[this.seq.length - 2]);
    this.seq.push(c);
  }

  playback() {
    if (!this.active) return;
    this.phase = 'watch';
    this.inputIdx = 0;
    const len = this.seq.length;
    this.hooks.toast(`留心看！咒文長 ${len} 個`);
    const step = this.level.speed;
    this.seq.forEach((ci, k) => this.sched.after(0.6 + k * step, () => this.flashCrystal(ci, step * 0.72)));
    this.sched.after(0.6 + len * step, () => {
      if (!this.active) return;
      this.phase = 'input';
      this.hooks.toast(this.level.reverse ? '到你！倒轉次序點返水晶' : '到你！照次序點返水晶');
    });
  }

  flashCrystal(i, dur) {
    const c = this.crystals[i];
    c.flash = 1;
    c.hold = dur;
    this.flashLight.color.set(c.color);
    this.flashLight.position.copy(c.group.position).setY(1.6);
    Sound.note(i, Math.max(0.25, dur));
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
    if (!r || !this.crystals.length) return;
    const n = this.crystals.length;
    // 直向分兩行，打橫排一行弧形
    const twoRows = r.width / r.height < 1.05 && n > 3;
    const gap = 1.3;
    if (twoRows) {
      // 兩行交錯排，前排唔會遮住後排
      const back = Math.floor(n / 2), front = n - back;
      const stagger = back === front ? gap * 0.55 : 0;
      this.crystals.forEach((c, i) => {
        const inFront = i >= back;
        const row = inFront ? front : back;
        const k = inFront ? i - back : i;
        const x = (k - (row - 1) / 2) * gap * 1.35 + (inFront ? stagger / 2 : -stagger / 2);
        c.group.position.set(x, 0, inFront ? 2.2 : 0.5);
      });
    } else {
      this.crystals.forEach((c, i) => {
        const x = (i - (n - 1) / 2) * gap;
        c.group.position.set(x, 0, 1.3 - Math.abs(x) * 0.18);
      });
    }
    centerOnRect(this.camera, r, this.W, this.H);
    const pts = [];
    this.crystals.forEach(c => {
      for (const dx of [-0.5, 0.5]) {
        pts.push(this.v.copy(c.group.position).add(new THREE.Vector3(dx, 0, 0.4)).clone());
        pts.push(this.v.copy(c.group.position).add(new THREE.Vector3(dx, 1.5, 0)).clone());
      }
    });
    pts.push(new THREE.Vector3(this.heroBase.x - 0.5, 1.6, this.heroBase.z));
    pts.push(new THREE.Vector3(this.golemBase.x + 1.2, 2.9, this.golemBase.z));
    pts.push(new THREE.Vector3(this.golemBase.x - 1.0, 2.9, this.golemBase.z));
    const target = new THREE.Vector3(0, 1.0, -0.5);
    const pitch = twoRows ? THREE.MathUtils.degToRad(40) : PITCH;
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    fitCameraDistance(this.camera, target, dir, pts, r, this.W, this.H, 8);
    this.camBase.copy(this.camera.position);
    const a = toScreen(this.crystals[0].mesh, this.camera, this.W, this.H, {});
    const b = toScreen(this.crystals[1].mesh, this.camera, this.W, this.H, {});
    this.crystalPx = Math.max(70, Math.hypot(a.x - b.x, a.y - b.y));
  }

  /* ---------- 觸控 ---------- */
  pointerDown(x, y) {
    if (!this.active || this.phase !== 'input') return;
    const c = pickNearest(this.crystals, cc => cc.mesh, x, y, this.camera, this.W, this.H, this.crystalPx * 0.6);
    if (c) this.press(c);
  }

  press(c) {
    this.flashCrystal(c.idx, 0.22);
    const len = this.seq.length;
    const expect = this.level.reverse ? this.seq[len - 1 - this.inputIdx] : this.seq[this.inputIdx];
    if (c.idx !== expect) { this.wrong(c); return; }
    this.inputIdx += 1;
    buzz(10);
    c.mesh.getWorldPosition(this.v);
    this.sparks.spawn(this.v, { count: 10, color: c.color, speed: 2, life: 0.5, gravity: 1 });
    if (this.inputIdx === len) this.roundClear();
  }

  roundClear() {
    this.phase = 'wait';
    const len = this.seq.length;
    this.best = Math.max(this.best, len);
    this.hooks.counter(this.counterHtml());
    // 每次成功都攻擊魔像
    this.golem.hit(false);
    Sound.impact(false);
    this.golem.corePos(this.v);
    this.sparks.spawn(this.v, { count: 24, color: 0xffd56a, speed: 4, life: 0.6, gravity: 3 });
    const s = toScreen(this.v.clone().setY(this.v.y + 1.2), this.camera, this.W, this.H, {});
    this.hooks.popup(`-${len * 10}`, s.x + (Math.random() - 0.5) * 60, s.y, '');
    if (len >= MAX_CHAIN) {
      this.ultimate();
      this.sched.after(2.4, () => this.gameOver(true));
      return;
    }
    if (ULT_AT.includes(len)) {
      this.ultimate();
      this.sched.after(3.0, () => { this.addStep(); this.playback(); });
    } else {
      this.hooks.toast(`咒文成功！連鎖 ${len}`);
      this.sched.after(1.0, () => { this.addStep(); this.playback(); });
    }
  }

  wrong(c) {
    this.phase = 'wait';
    c.shake = 0.45;
    this.mistakes += 1;
    this.lives -= 1;
    Sound.miss();
    buzz([25, 40, 25]);
    this.hooks.counter(this.counterHtml());
    if (this.lives < 0) {
      this.hooks.toast('咒文失敗……勇者暫時撤退');
      this.sched.after(1.2, () => this.gameOver(false));
      return;
    }
    this.hooks.toast(`唔緊要！再睇一次（重試剩 ${this.lives} 次）`);
    this.sched.after(1.4, () => this.playback());
  }

  ultimate() {
    this.ultimates += 1;
    const name = ULT_NAMES[(this.ultimates - 1) % ULT_NAMES.length];
    this.hooks.cutin('勇者', `必殺・${name}！`);
    this.hooks.toast(`必殺技「${name}」！`);
    Sound.ultimate();
    buzz([60, 40, 120]);
    this.heroJump = 0;
    this.sched.after(0.75, () => {
      this.pillarT = 0;
      this.shake = 0.35;
      this.golem.corePos(this.v);
      this.golem.defeat();
      Sound.explode();
      this.sparks.spawn(this.v, { count: 160, color: 0xffe08a, speed: 9, life: 1.1, gravity: 3, up: 2 });
      this.sparks.spawn(this.v, { count: 60, color: 0xffffff, speed: 6, life: 0.8, gravity: 2 });
    });
    this.sched.after(2.2, () => { this.golemIdx += 1; this.spawnGolem(); });
  }

  gameOver(complete) {
    this.active = false;
    this.phase = 'over';
    const time = this.hooks.complete();
    const lv = this.level;
    const score = this.best;
    const stars = score >= lv.stars[0] ? 3 : score >= lv.stars[1] ? 2 : 1;
    this.hooks.finish({
      score, time, stars,
      lines: [['最長連鎖', score], ['必殺技', `${this.ultimates} 次`], ['用時', fmtTime(time)]],
      bonus: this.ultimates * 5,
      kicker: 'SPELL CHAIN',
      title: complete ? '咒文大師！' : stars === 3 ? '記憶超群！' : stars === 2 ? '咒文詠唱成功！' : '修行完成！',
    });
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    this.embers.update(dt, t);
    this.torches.forEach(tc => tc.update(dt, t));
    this.ringMat.opacity = 0.3 + 0.15 * Math.sin(t * 2);

    let flashMax = 0;
    for (const c of this.crystals) {
      if (c.hold > 0) c.hold -= dt; else c.flash = Math.max(0, c.flash - dt * 4);
      const f = c.flash;
      flashMax = Math.max(flashMax, f);
      c.mesh.position.y = 1.05 + f * 0.28 + Math.sin(t * 1.6 + c.seed) * 0.04;
      c.mesh.rotation.y = t * 0.6 + c.seed;
      c.mat.emissiveIntensity = 0.35 + f * 2.2;
      c.glow.position.y = c.mesh.position.y;
      c.glow.material.opacity = 0.3 + f * 0.7;
      c.rune.opacity = 0.45 + f * 0.55;
      c.glow.scale.setScalar(1.3 + f * 1.8);
      c.shake = Math.max(0, c.shake - dt);
      c.mesh.position.x = c.shake > 0 ? Math.sin(t * 70) * 0.09 * (c.shake / 0.45) : 0;
    }
    this.flashLight.intensity = flashMax * 14;

    // 魔像
    if (this.golem) {
      if (this.golemRise < 1) {
        this.golemRise = Math.min(1, this.golemRise + dt / 1.4);
        const k = 1 - Math.pow(1 - this.golemRise, 3);
        this.golem.group.position.y = -4 * (1 - k);
      }
      this.golem.update(dt, t, 1);
    }

    // 勇者：必殺技跳斬
    let hop = 0;
    if (this.heroJump >= 0) {
      this.heroJump += dt;
      const j = this.heroJump;
      const strike = this.v2.copy(this.golemBase).add(new THREE.Vector3(-1.1, 0, 0.5));
      if (j < 0.6) {
        const k = j / 0.6;
        this.hero.group.position.lerpVectors(this.heroBase, strike, k);
        hop = Math.sin(k * Math.PI) * 1.4;
        if (j > 0.45 && !this.heroSwung) { this.hero.celebrate(); this.heroSwung = true; }
      } else if (j < 1.3) {
        this.hero.group.position.copy(strike);
      } else if (j < 1.8) {
        const k = (j - 1.3) / 0.5;
        this.hero.group.position.lerpVectors(strike, this.heroBase, k);
        hop = Math.sin(k * Math.PI) * 0.6;
      } else {
        this.hero.group.position.copy(this.heroBase);
        this.heroJump = -1;
        this.heroSwung = false;
      }
    }
    this.hero.update(dt, t, hop);

    // 光柱
    if (this.pillarT >= 0) {
      this.pillarT += dt;
      const k = this.pillarT;
      this.pillarMat.opacity = k < 0.15 ? k / 0.15 * 0.85 : Math.max(0, 0.85 - (k - 0.15) * 0.8);
      this.pillar.scale.set(1 + k * 0.6, 1, 1 + k * 0.6);
      if (k > 1.2) { this.pillarT = -1; this.pillarMat.opacity = 0; }
    }

    // 鏡頭震
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.6;
      this.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * s,
        this.camBase.y + (Math.random() - 0.5) * s,
        this.camBase.z,
      );
    } else if (this.camBase.lengthSq()) {
      this.camera.position.copy(this.camBase);
    }
  }
}
