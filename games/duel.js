/* 對決擂台：iPad 面對面，兩邊同時鬥快。
   畫面：兩邊各一半（CSS 轉向對住玩家）＋ 中間一條 3D 擂台（同一個場景畫兩次，兩個方向）。
   流程：介紹 → 兩邊撳「準備好」→ 3-2-1 → 回合 → 勝方斬擊 → 下一煲 → 完場 */
import { THREE, Scheduler } from './engine.js';
import { gradientTexture, Sparks, starField, makeGlow } from './fx.js';
import { createHero, createTorch } from './models.js';
import { ROUNDS, MIX_ORDER } from './duel-rounds.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';

export const DUEL_SIDES = [
  { name: '藍騎士', cls: 'blue', color: 0x2a5fd0 },
  { name: '紅騎士', cls: 'red', color: 0xc8243c },
];
const GEAR = [
  { tunic: 0x1f3a7a, cape: { color: 0x1f3a7a, trim: 0xc9a24a }, shield: { shape: 'heater', face: 0x1f3a7a, emblem: 'moon', metal: 0xd4dae4, rim: true }, helm: { plume: 0x2a7fd0 } },
  { tunic: 0x5a1a22, cape: { color: 0x7a1f27, trim: 0xc9a24a }, shield: { shape: 'kite', face: 0x6a1a22, emblem: 'crown', rim: true }, helm: { plume: 0xc8243c } },
];
const BASE_X = [-1.0, 1.0];
const ROUND_LIMIT = 45;
const FOV = 34;

const $ = (s, r = document) => r.querySelector(s);

function createBanner(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }));
  pole.position.y = 1.1;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.95), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
  flag.position.set(0, 1.62, 0);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.3 }));
  tip.position.y = 2.25;
  g.add(tip);
  return g;
}

export class DuelView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#0b1030', '#1c1c46', '#3d2a52', '#6a3a4a']);
    this.scene.fog = new THREE.Fog(0x1c1c46, 9, 26);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);   // engine 要有，實際用 cams
    this.cams = [new THREE.PerspectiveCamera(FOV, 1, 0.1, 100), new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)];

    this.scene.add(new THREE.HemisphereLight(0xb8c4e8, 0x2a1a20, 1.3));
    const key = new THREE.DirectionalLight(0xffe2c0, 2.0);
    key.position.set(0, 6, 4);
    this.scene.add(key);
    const back = new THREE.DirectionalLight(0x9aa8e0, 1.0);
    back.position.set(0, 4, -5);
    this.scene.add(back);
    const stars = starField(260, 40, 0.3);
    stars.material.fog = false;
    this.scene.add(stars);

    // 擂台
    const stone = new THREE.MeshStandardMaterial({ color: 0x46424e, roughness: 0.95, flatShading: true });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.0, 0.32, 14), stone);
    plat.position.y = -0.16;
    this.scene.add(plat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.4, 48), new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(ring);
    [[-2.35, 0x1f3a7a], [2.35, 0x7a1f27]].forEach(([x, c]) => {
      const b = createBanner(c);
      b.position.set(x, 0, 0);
      this.scene.add(b);
    });
    // 火把喺兩側（唔會擋住兩邊鏡頭）
    this.torches = [-1, 1].map(s => {
      const t = createTorch({ light: false, height: 1.25 });
      t.group.position.set(2.0 * s, 0, 0.55 * s);
      this.scene.add(t.group);
      return t;
    });

    this.heroes = GEAR.map((gear, side) => {
      const h = createHero(gear);
      h.group.position.set(BASE_X[side], 0, 0);
      h.group.rotation.y = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(h.group);
      return h;
    });
    this.sparks = new Sparks(this.scene, { cap: 300, size: 0.3 });
    this.flash = [0, 0];
    this.lunge = [0, 0];
    this.knock = [0, 0];
    this.v = new THREE.Vector3();

    this.root = $('.duel-mode');
    this.halves = [0, 1].map(side => {
      const el = $(`.duel-half[data-side="${side}"]`, this.root);
      return {
        el,
        inner: $('.dh-inner', el),
        name: $('.dh-name', el),
        pips: $('.dh-pips', el),
        foe: $('.dh-foe', el),
        prompt: $('.dh-prompt', el),
        pad: $('.dh-pad', el),
        msg: $('.dh-msg', el),
      };
    });
    this.halves.forEach((h, side) => { h.name.textContent = DUEL_SIDES[side].name; });
    this.W = 1;
    this.H = 1;
    this.views = [null, null];
    this.active = false;
    this.paused = false;
    this.clock = 0;
    this.phase = 'idle';
  }

  hud() { return { mode: 'duel', manualClock: true }; }

  /* ---------- 版面 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
  }

  setRects(regions) {
    this.views = [regions.view0 || null, regions.view1 || null];
    this.landscape = this.W > this.H;
    this.halves.forEach((h, side) => {
      const r = h.el.getBoundingClientRect();
      const rot = this.landscape ? (side === 1 ? 90 : -90) : (side === 1 ? 180 : 0);
      const iw = this.landscape ? r.height : r.width;
      const ih = this.landscape ? r.width : r.height;
      h.inner.style.width = `${iw}px`;
      h.inner.style.height = `${ih}px`;
      h.inner.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      h.rot = rot;
    });
    this.layoutCams();
  }

  /* 每個玩家嘅鏡頭：自己騎士喺左邊；按半邊轉向打側 */
  layoutCams() {
    const target = new THREE.Vector3(0, 0.55, 0);
    const halfW = 1.55, halfH = 0.7;
    this.cams.forEach((cam, side) => {
      const r = this.views[side];
      if (!r) return;
      cam.aspect = r.width / Math.max(1, r.height);
      cam.updateProjectionMatrix();
      const rolled = this.halves[side].rot % 180 !== 0;
      const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const th = tv * cam.aspect;
      // 打側時，玩家眼中嘅「闊」係螢幕嘅「高」
      const fitW = rolled ? tv : th, fitH = rolled ? th : tv;
      const d = Math.max(halfW / fitW, halfH / fitH) + 0.3;
      const z = side === 0 ? 1 : -1;
      cam.position.set(0, target.y + d * 0.16, z * d);
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.rotateZ(THREE.MathUtils.degToRad(this.halves[side].rot));
    });
  }

  render(r, W, H) {
    const prev = r.getClearColor(new THREE.Color());
    const prevA = r.getClearAlpha();
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.setClearColor(0x070912, 1);
    r.clear();
    r.setScissorTest(true);
    this.cams.forEach((cam, side) => {
      const v = this.views[side];
      if (!v || v.width < 2 || v.height < 2) return;
      const y = H - v.top - v.height;
      r.setViewport(v.left, y, v.width, v.height);
      r.setScissor(v.left, y, v.width, v.height);
      r.render(this.scene, cam);
    });
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.setClearColor(prev, prevA);
  }

  /* ---------- 對決設定 ---------- */
  setup(cfg) {
    this.cfg = { game: 'mix', speed: 'easy', need: 3, ...cfg };
    this.sched.clear();
    this.wins = [0, 0];
    this.roundNo = 0;
    this.results = [];
    this.mixQueue = [];
    this.round = null;
    this.token = 0;
    this.phase = 'idle';
    this.lockUntil = [0, 0];
    this.heroes.forEach((h, side) => {
      h.group.position.set(BASE_X[side], 0, 0);
      h.group.rotation.set(0, side === 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    });
    this.root.classList.remove('final');
    this.halves.forEach(h => { h.el.classList.remove('locked', 'won', 'lost'); h.msg.textContent = ''; });
    this.renderPips();
  }

  begin() {
    this.active = true;
    this.nextRound();
  }

  abort() {
    this.active = false;
    this.sched.clear();
    if (this.round && this.round.destroy) this.round.destroy();
    this.round = null;
    this.phase = 'idle';
  }

  pickGame() {
    if (this.cfg.game !== 'mix') return this.cfg.game;
    if (!this.mixQueue.length) {
      const ids = MIX_ORDER.filter(id => ROUNDS[id]);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      // 唔好連續兩煲同一款
      if (ids.length > 1 && this.lastGame && ids[0] === this.lastGame) ids.push(ids.shift());
      this.mixQueue = ids;
    }
    return this.mixQueue.shift();
  }

  /* ---------- 兩邊畫面工具 ---------- */
  sidesOf(side) { return side === 'both' ? [0, 1] : [side]; }
  setPrompt(side, html) { this.sidesOf(side).forEach(s => { this.halves[s].prompt.innerHTML = html; }); }
  setPad(side, html) { this.sidesOf(side).forEach(s => { this.halves[s].pad.innerHTML = html; }); }
  setMsg(side, text, cls = '') {
    this.sidesOf(side).forEach(s => {
      const m = this.halves[s].msg;
      m.textContent = text;
      m.className = `dh-msg ${cls}`;
    });
  }
  renderPips() {
    const need = this.cfg ? this.cfg.need : 3;
    const pips = n => Array.from({ length: need }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    this.halves.forEach((h, side) => {
      h.pips.innerHTML = pips(this.wins ? this.wins[side] : 0);
      h.foe.innerHTML = `${DUEL_SIDES[1 - side].name}<span class="dh-pips small">${pips(this.wins ? this.wins[1 - side] : 0)}</span>`;
    });
  }

  makeCtx(token) {
    const live = () => this.token === token && this.phase === 'play';
    return {
      speed: this.cfg.speed,
      names: DUEL_SIDES.map(s => s.name),
      prompt: (side, html) => { if (live()) this.setPrompt(side, html); },
      pad: (side, html) => { if (live()) this.setPad(side, html); },
      padEl: side => this.halves[side].pad,
      msg: (side, text, cls) => { if (live()) this.setMsg(side, text, cls); },
      after: (sec, fn) => this.sched.after(sec, () => { if (live()) fn(); }),
      now: () => this.clock,
      lock: (side, sec) => {
        this.lockUntil[side] = this.clock + sec;
        const el = this.halves[side].el;
        el.classList.add('locked');
        this.sched.after(sec, () => { if (this.clock >= this.lockUntil[side] - 0.001) el.classList.remove('locked'); });
      },
      locked: side => this.clock < this.lockUntil[side],
      win: (side, note) => { if (live()) this.roundOver(side, note); },
      draw: note => { if (live()) this.roundOver(-1, note); },
      sound: Sound,
      buzz,
    };
  }

  /* ---------- 回合流程 ---------- */
  nextRound() {
    if (!this.active) return;
    this.roundNo += 1;
    const id = this.pickGame();
    this.lastGame = id;
    const def = ROUNDS[id];
    this.current = { id, def };
    this.ready = [false, false];
    this.phase = 'intro';
    this.halves.forEach(h => h.el.classList.remove('locked', 'won', 'lost'));
    this.setPrompt('both', `<div class="dp-round">第 ${this.roundNo} 煲</div><div class="dp-game">${icon(def.icon)}${def.name}</div>`);
    this.setPad('both', `<p class="dp-rule">${def.rule(this.cfg.speed)}</p>
      <button class="duel-btn ready" data-duel="ready">${icon('check')}準備好</button>`);
    this.setMsg('both', '兩位都撳「準備好」就開始');
  }

  press(side, value, ts, el) {
    if (!this.active || this.paused) return;
    if (this.phase === 'intro' && value === 'ready') {
      if (this.ready[side]) return;
      this.ready[side] = true;
      Sound.flip();
      this.setPad(side, `<p class="dp-rule">${this.current.def.rule(this.cfg.speed)}</p><div class="dp-wait">${icon('check')}已準備，等緊對手……</div>`);
      this.setMsg(side, '');
      if (this.ready[0] && this.ready[1]) this.countdown();
      return;
    }
    if (this.phase !== 'play' || !this.round) return;
    if (this.clock < this.lockUntil[side]) return;
    this.round.press(side, value, ts, el);
  }

  countdown() {
    this.phase = 'count';
    this.setPad('both', '');
    this.setMsg('both', '');
    const steps = ['3', '2', '1'];
    steps.forEach((s, i) => this.sched.after(0.25 + i * 0.7, () => {
      this.setPrompt('both', `<div class="dp-count">${s}</div>`);
      Sound.tick();
    }));
    this.sched.after(0.25 + steps.length * 0.7, () => this.startRound());
  }

  startRound() {
    if (!this.active) return;
    this.token += 1;
    this.phase = 'play';
    this.setPrompt('both', '');
    this.setPad('both', '');
    this.setMsg('both', '');
    this.roundStart = this.clock;
    this.round = this.current.def.create(this.makeCtx(this.token));
    this.round.start();
    const limit = this.current.def.limit || ROUND_LIMIT;
    const token = this.token;
    this.sched.after(limit, () => {
      if (this.token !== token || this.phase !== 'play') return;
      if (this.round && this.round.timeout) this.round.timeout();
      else this.roundOver(-1, '夠鐘喇');
    });
  }

  roundOver(side, note = '') {
    if (this.phase !== 'play') return;
    this.phase = 'strike';
    this.token += 1;
    if (this.round && this.round.destroy) this.round.destroy();
    this.round = null;
    this.results.push({ no: this.roundNo, game: this.current.def.name, winner: side, note });
    this.lockUntil = [0, 0];
    this.halves.forEach(h => h.el.classList.remove('locked'));
    if (side >= 0) {
      this.wins[side] += 1;
      this.halves[side].el.classList.add('won');
      this.halves[1 - side].el.classList.add('lost');
      this.setPrompt(side, `<div class="dp-win">贏咗呢煲！</div>`);
      this.setPrompt(1 - side, `<div class="dp-lose">${DUEL_SIDES[side].name}贏咗呢煲</div>`);
      this.setMsg('both', note);
      this.strike(side);
    } else {
      this.setPrompt('both', '<div class="dp-lose">平手！</div>');
      this.setMsg('both', note || '呢煲冇人贏，再嚟過');
      Sound.oops();
    }
    this.setPad('both', '');
    this.renderPips();
    const done = side >= 0 && this.wins[side] >= this.cfg.need;
    this.sched.after(done ? 2.0 : 2.4, () => (done ? this.finish(side) : this.nextRound()));
  }

  strike(side) {
    this.lunge[side] = 0.001;
    this.heroes[side].celebrate();
    this.sched.after(0.32, () => {
      const foe = 1 - side;
      this.flash[foe] = 1;
      this.knock[foe] = 1;
      this.heroes[foe].group.getWorldPosition(this.v);
      this.v.y += 0.6;
      this.sparks.spawn(this.v, { count: 40, color: 0xffd56a, speed: 3.5, life: 0.6, gravity: 4 });
      Sound.impact(true);
      buzz(40);
    });
  }

  finish(side) {
    this.phase = 'final';
    this.active = false;
    this.root.classList.add('final');
    const reward = this.hooks.duelFinish ? this.hooks.duelFinish({ winner: side, wins: this.wins.slice(), results: this.results.slice(), cfg: this.cfg }) : null;
    const score = s => `${this.wins[s]} : ${this.wins[1 - s]}`;
    const list = this.results.map(r => `<li><span>第 ${r.no} 煲・${r.game}</span><b class="${r.winner < 0 ? '' : DUEL_SIDES[r.winner].cls}">${r.winner < 0 ? '平手' : DUEL_SIDES[r.winner].name}</b></li>`).join('');
    [0, 1].forEach(s => {
      const won = s === side;
      this.halves[s].el.classList.toggle('won', won);
      this.halves[s].el.classList.toggle('lost', !won);
      this.setPrompt(s, won
        ? `<div class="dp-final win">${icon('trophy')}勝利！</div><div class="dp-score">${score(s)}</div>`
        : `<div class="dp-final">惜敗</div><div class="dp-score">${score(s)}</div>`);
      this.setPad(s, `<ul class="dp-list">${list}</ul>
        <div class="dp-actions">
          <button class="cta" data-action="duel-again">${icon('play')}再戰</button>
          <button class="ghost-btn" data-action="duel-setup">換遊戲</button>
          <button class="ghost-btn" data-action="home">返回據點</button>
        </div>`);
      this.setMsg(s, reward && reward.text ? reward.text : '');
    });
    this.heroes[1 - side].group.rotation.x = 0;
    this.kneel = 1 - side;
    this.cheer = side;
    this.cheerT = 0;
    Sound.victory();
  }

  /* ---------- 每格 ---------- */
  update(dt, t) {
    this.clock += dt;
    this.sched.update(dt);
    this.sparks.update(dt);
    this.torches.forEach(tc => tc.update(dt, t));
    if (this.phase === 'play' && this.round && this.round.update) this.round.update(dt);
    this.heroes.forEach((h, side) => {
      const dir = side === 0 ? 1 : -1;
      let x = BASE_X[side];
      if (this.lunge[side] > 0) {
        this.lunge[side] += dt;
        const k = this.lunge[side];
        const out = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.6) / 0.5);
        x += dir * 0.62 * Math.min(1, out);
        if (k > 1.2) this.lunge[side] = 0;
      }
      if (this.knock[side] > 0) {
        this.knock[side] = Math.max(0, this.knock[side] - dt * 2);
        x -= dir * 0.25 * Math.sin(this.knock[side] * Math.PI);
      }
      h.group.position.x = x;
      if (this.phase === 'final' && side === this.kneel) {
        h.group.rotation.x += ((side === 0 ? -0.35 : -0.35) - h.group.rotation.x) * Math.min(1, dt * 4);
        h.group.position.y = -0.08;
      } else {
        h.group.position.y = 0;
      }
      if (this.phase === 'final' && side === this.cheer) {
        this.cheerT += dt;
        if (this.cheerT > 1.6) { this.cheerT = 0; h.celebrate(); }
      }
      h.update(dt, t, 0);
      // 中招閃紅
      if (this.flash[side] > 0) {
        this.flash[side] = Math.max(0, this.flash[side] - dt * 3);
        h.group.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setRGB(this.flash[side] * 0.6, 0, 0); });
      }
    });
  }
}
