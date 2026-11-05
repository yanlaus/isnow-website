/* 數觸之戰：3D 符文石磚 + 魔像 Boss */
import { THREE, easeOutBack, clamp, Scheduler } from './engine.js';
import { numberTexture } from './textures.js';
import { gradientTexture, makeGlow, Sparks, starField, Embers } from './fx.js';
import { createGolem, createTorch } from './models.js';
import { Sound, buzz } from './sound.js';

const FOV = 36;
const CAM_Z = 16;
const ARENA_Z = -4;
const TILE = 0.8;          // 石磚邊長（未計倒角）
const COLOR_IDLE = new THREE.Color(0x2a5fb8);
const COLOR_DONE = new THREE.Color(0x0e1528);
const GOLD = new THREE.Color(0xf5c842);
const RED = new THREE.Color(0xff3b3b);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export class SchulteView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#241650', '#120d33', '#070816', '#04050c']);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
    this.camera.position.set(0, 0, CAM_Z);

    this.scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x2a1d3d, 1.5));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(-5, 7, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8a7bff, 1.4);
    rim.position.set(6, 3, -6);
    this.scene.add(rim);

    this.scene.add(starField(500, 90));
    this.embers = new Embers(this.scene, { count: 70, box: [26, 18, 6], center: [0, 0, -9], color: 0xff9a4d, size: 0.16, speed: 0.6 });

    // 擂台（魔像 + 平台 + 火把）
    this.arena = new THREE.Group();
    this.arena.position.z = ARENA_Z;
    this.scene.add(this.arena);
    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.75, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3450, roughness: 0.95, flatShading: true }),
    );
    plat.position.y = -0.28;
    this.arena.add(plat);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.15, 48), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    this.arena.add(ring);
    this.torches = [-1, 1].map(s => {
      const tch = createTorch({ light: true, height: 1.5 });
      tch.group.position.set(3.25 * s, -0.5, -0.3);
      this.arena.add(tch.group);
      return tch;
    });
    this.golem = null;

    // 數字石磚
    this.grid = new THREE.Group();
    this.scene.add(this.grid);
    this.tileGeo = new THREE.ExtrudeGeometry(roundedRect(TILE, TILE, 0.15), {
      depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 6,
    });
    this.tileGeo.translate(0, 0, -0.27); // 正面貼正 z = 0，令觸控位置準確
    this.faceGeo = new THREE.PlaneGeometry(TILE * 1.02, TILE * 1.02);
    this.tiles = [];

    this.sparks = new Sparks(this.scene, { cap: 700, size: 0.42 });
    this.orbs = [];
    this.v1 = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.W = 1;
    this.H = 1;
    this.gridPx = { left: 0, top: 0, size: 1 };
    this.level = null;
    this.active = false;
  }

  /* ---------- 建立一局 ---------- */
  hud(level) {
    return {
      mode: 'schulte',
      counter: '失誤 <b>0</b>',
      intro: `${level.enemyName}出現了！`,
      startMsg: '由「1」開始，順序點擊石磚！',
    };
  }

  /* 魔像名牌、HP 條、「下一個」 */
  renderProgress() {
    const nn = document.getElementById('nextNum');
    nn.textContent = this.next > this.total ? '完' : String(this.next);
    nn.classList.remove('pop'); void nn.offsetWidth; nn.classList.add('pop');
    const ratio = Math.max(0, (this.total - this.next + 1) / this.total);
    const hp = document.getElementById('hpFill');
    hp.style.width = `${ratio * 100}%`;
    hp.classList.toggle('mid', ratio <= 0.5 && ratio > 0.2);
    hp.classList.toggle('low', ratio <= 0.2);
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    document.getElementById('enemyName').textContent = level.enemyName;
    this.n = level.size;
    this.total = this.n * this.n;
    this.next = 1;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.crits = 0;
    this.lastHit = 0;
    this.idle = 0;
    this.active = false;
    this.finished = false;
    this.defeated = false;
    this.orbs.forEach(o => this.scene.remove(o.sprite));
    this.orbs = [];

    // 石磚
    this.tiles.forEach(t => { this.grid.remove(t.mesh); t.mat.dispose(); t.faceMat.dispose(); });
    this.tiles = [];
    const nums = Array.from({ length: this.total }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const half = (this.n - 1) / 2;
    nums.forEach((v, idx) => {
      const r = Math.floor(idx / this.n), c = idx % this.n;
      const mat = new THREE.MeshStandardMaterial({ color: COLOR_IDLE.clone(), roughness: 0.42, metalness: 0.25 });
      const mesh = new THREE.Mesh(this.tileGeo, mat);
      const faceMat = new THREE.MeshBasicMaterial({ map: numberTexture(v), transparent: true, depthWrite: false });
      const face = new THREE.Mesh(this.faceGeo, faceMat);
      face.position.z = 0.006;
      mesh.add(face);
      mesh.position.set(c - half, half - r, 0);
      mesh.scale.setScalar(0.001);
      this.grid.add(mesh);
      this.tiles.push({
        v, mesh, mat, faceMat, r, c, cleared: false,
        z: 0, appear: 0.35 + (r + c) * 0.045, flash: 0, wrong: 0, hint: false,
      });
    });

    // 魔像
    if (this.golem) this.arena.remove(this.golem.group);
    this.golem = createGolem({ rock: level.rock, crystal: level.crystal, boss: !!level.boss });
    this.arena.add(this.golem.group);
    this.ringMat.color.set(level.crystal);
    this.riseT = 0;
    this.age = 0;
    this.renderProgress();
    this.layout();
    Sound.rumble();
  }

  begin() {
    this.active = true;
    this.idle = 0;
  }

  abort() {
    this.active = false;
    this.sched.clear();
  }

  /* ---------- 版面：按 HTML 區域擺放 3D 物件 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.layout();
  }

  setRects({ play, enemy }) {
    this.playRect = play;
    this.enemyRect = enemy;
    this.layout();
  }

  layout() {
    if (!this.playRect || !this.enemyRect || !this.n) return;
    const { W, H } = this;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const ppu0 = H / (2 * CAM_Z * tanHalf);
    const p = this.playRect;
    const sizePx = Math.min(p.width, p.height) * 0.98;
    this.grid.scale.setScalar(sizePx / ppu0 / this.n);
    this.grid.position.set((p.cx - W / 2) / ppu0, -(p.cy - H / 2) / ppu0, 0);
    this.gridPx = { left: p.cx - sizePx / 2, top: p.cy - sizePx / 2, size: sizePx };

    const e = this.enemyRect;
    const ppuA = H / (2 * (CAM_Z - ARENA_Z) * tanHalf);
    // 擂台高約 4.3（平台底 -0.55 至頭頂 3.7），闊約 7.2（連火把）
    const s = Math.min((e.height / ppuA) / 4.3, (e.width / ppuA) / 7.4);
    this.arena.scale.setScalar(s);
    this.arena.position.set((e.cx - W / 2) / ppuA, -(e.cy - H / 2) / ppuA - 1.55 * s, ARENA_Z);
  }

  /* ---------- 觸控 ---------- */
  pointerDown(x, y) {
    if (!this.active) return;
    const { left, top, size } = this.gridPx;
    const fx = (x - left) / size, fy = (y - top) / size;
    if (fx < -0.02 || fy < -0.02 || fx > 1.02 || fy > 1.02) return;
    const c = clamp(Math.floor(fx * this.n), 0, this.n - 1);
    const r = clamp(Math.floor(fy * this.n), 0, this.n - 1);
    const tile = this.tiles.find(t => t.r === r && t.c === c);
    if (!tile || tile.cleared) return;
    if (tile.v === this.next) this.correct(tile);
    else this.wrong(tile);
  }

  correct(tile) {
    const now = performance.now();
    const crit = this.lastHit && now - this.lastHit < 1000;
    this.lastHit = now;
    this.idle = 0;
    tile.cleared = true;
    tile.hint = false;
    tile.flash = 1;
    tile.z = 0.12; // 先彈出少少再沉落
    this.tiles.forEach(t => { t.hint = false; });

    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (crit) this.crits += 1;
    Sound.hit(this.next - 1, crit);
    buzz(12);

    tile.mesh.getWorldPosition(this.v1);
    this.v1.z += 0.3;
    this.sparks.spawn(this.v1, { count: crit ? 30 : 18, color: crit ? 0xbff6ff : 0xffd56a, speed: 4, life: 0.55, gravity: 5, up: 1 });

    // 光彈飛向魔像
    const orb = makeGlow(crit ? 0xbff6ff : 0xffd56a, crit ? 2.2 : 1.6, 1);
    orb.position.copy(this.v1);
    this.scene.add(orb);
    const dmg = crit ? rand(22, 32) : rand(8, 15);
    this.orbs.push({ sprite: orb, from: this.v1.clone(), t: 0, crit, dmg });

    this.hooks.toast(crit ? `會心一擊！造成 ${dmg} 點傷害` : `命中！造成 ${dmg} 點傷害`);
    if (this.combo >= 5 && this.combo % 5 === 0) {
      const r = this.enemyRect;
      this.hooks.popup(`${this.combo} 連擊！`, r.cx + r.width * 0.28, r.top + r.height * 0.25, 'combo');
    }

    this.next += 1;
    this.renderProgress();
    if (this.next > this.total) {
      this.active = false;
      this.finished = true;
      this.time = this.hooks.complete();
    }
  }

  wrong(tile) {
    this.misses += 1;
    this.combo = 0;
    tile.wrong = 0.45;
    Sound.miss();
    buzz([25, 40, 25]);
    this.hooks.counter(`失誤 <b>${this.misses}</b>`);
    this.hooks.toast(`這是「${tile.v}」，請找「${this.next}」`);
  }

  orbArrive(orb) {
    this.golem.hit(orb.crit);
    Sound.impact(orb.crit);
    this.golem.corePos(this.v2);
    this.sparks.spawn(this.v2, { count: orb.crit ? 40 : 22, color: this.level.crystal, speed: 5, life: 0.6, gravity: 4 });
    this.golem.headPos(this.v1);
    this.v1.y += 0.9 * this.arena.scale.x;
    this.v1.project(this.camera);
    // 少少隨機位移，連續攻擊時數字唔會疊埋一齊
    this.hooks.popup(`-${orb.dmg}`, (this.v1.x + 1) / 2 * this.W + (Math.random() - 0.5) * 110,
      (1 - this.v1.y) / 2 * this.H + (Math.random() - 0.5) * 36, orb.crit ? 'crit' : '');
    if (this.finished && this.orbs.length === 0 && !this.defeated) this.defeat();
  }

  defeat() {
    this.defeated = true;
    this.golem.corePos(this.v2);
    this.golem.defeat();
    Sound.explode();
    buzz([40, 60, 80]);
    this.sparks.spawn(this.v2, { count: 140, color: this.level.crystal, speed: 9, life: 1.1, gravity: 3, up: 2 });
    this.sparks.spawn(this.v2, { count: 60, color: 0xffffff, speed: 6, life: 0.8, gravity: 2 });
    this.hooks.toast(`${this.level.enemyName}被打倒了！`);
    const lv = this.level;
    const time = this.time;
    const stars = time <= lv.stars[0] ? 3 : time <= lv.stars[1] ? 2 : 1;
    const { misses, maxCombo, crits } = this;
    this.sched.after(1.5, () => this.hooks.finish({
      time, stars,
      lines: [['失誤', misses], ['最高連擊', maxCombo], ['會心一擊', crits]],
      bonus: misses === 0 ? 10 : 0,
      kicker: 'VICTORY',
      title: stars === 3 ? '完美勝利！' : stars === 2 ? '漂亮的勝利！' : '戰鬥勝利！',
    }));
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    this.sched.update(dt);
    this.age += dt;
    this.embers.update(dt, t);
    this.sparks.update(dt);
    this.torches.forEach(tc => tc.update(dt, t));
    this.ringMat.opacity = 0.4 + 0.2 * Math.sin(t * 2);

    if (this.golem) {
      if (this.riseT < 1) {
        this.riseT = Math.min(1, this.riseT + dt / 1.8);
        const k = 1 - Math.pow(1 - this.riseT, 3);
        this.golem.group.position.y = -4.5 * (1 - k);
        if (this.riseT < 1 && Math.random() < 0.5) {
          this.v1.set((Math.random() - 0.5) * 3, 0, 0.5);
          this.arena.localToWorld(this.v1);
          this.sparks.spawn(this.v1, { count: 2, color: 0xb59a7a, speed: 1.5, life: 0.8, gravity: 2, up: 1.5 });
        }
      }
      this.golem.update(dt, t, Math.max(0, (this.total - this.next + 1) / this.total));
    }

    // 光彈
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt / 0.3;
      this.golem.corePos(this.v2);
      const k = Math.min(1, o.t);
      // 二次貝茲曲線：向上拋
      const mx = (o.from.x + this.v2.x) / 2, my = Math.max(o.from.y, this.v2.y) + 2.2, mz = (o.from.z + this.v2.z) / 2 + 1.5;
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      o.sprite.position.set(a * o.from.x + b * mx + c * this.v2.x, a * o.from.y + b * my + c * this.v2.y, a * o.from.z + b * mz + c * this.v2.z);
      if (Math.random() < 0.8) this.sparks.spawn(o.sprite.position, { count: 1, color: o.crit ? 0xbff6ff : 0xffc24a, speed: 0.4, life: 0.35, gravity: 0, up: 0 });
      if (k >= 1) {
        this.scene.remove(o.sprite);
        o.sprite.material.dispose();
        this.orbs.splice(i, 1);
        this.orbArrive(o);
      }
    }

    // 提示：9 秒冇點中，目標石磚發金光
    if (this.active) {
      this.idle += dt;
      if (this.idle > 9) {
        const target = this.tiles.find(tt => tt.v === this.next);
        if (target && !target.hint) {
          target.hint = true;
          this.hooks.toast('勇者的直覺：留意發光的石磚！');
        }
      }
    }

    // 石磚動畫
    for (const tile of this.tiles) {
      const a = clamp((this.age - tile.appear) / 0.4, 0, 1);
      let s = a <= 0 ? 0.001 : easeOutBack(a);
      const targetZ = tile.cleared ? -0.32 : 0;
      tile.z += (targetZ - tile.z) * Math.min(1, dt * (tile.cleared ? 9 : 14));
      if (tile.cleared) s *= 0.94;
      tile.mesh.scale.setScalar(Math.max(0.001, s));
      tile.mesh.position.z = tile.z;
      tile.mesh.position.x = (tile.c - (this.n - 1) / 2) + (tile.wrong > 0 ? Math.sin(t * 70) * 0.06 * (tile.wrong / 0.45) : 0);

      const em = tile.mat.emissive;
      em.setRGB(0, 0, 0);
      if (tile.hint) em.copy(GOLD).multiplyScalar(0.35 + 0.3 * Math.sin(t * 6));
      if (tile.wrong > 0) { em.copy(RED).multiplyScalar(tile.wrong / 0.45 * 0.9); tile.wrong = Math.max(0, tile.wrong - dt); }
      if (tile.flash > 0) { em.r += tile.flash * 0.8; em.g += tile.flash * 0.6; em.b += tile.flash * 0.15; tile.flash = Math.max(0, tile.flash - dt * 5); }
      if (tile.cleared) {
        tile.mat.color.lerp(COLOR_DONE, Math.min(1, dt * 6));
        tile.faceMat.opacity += (0.16 - tile.faceMat.opacity) * Math.min(1, dt * 6);
      }
    }
  }
}
