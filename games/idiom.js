/* 成語石碑：補全成語缺字，解開封印（語言、語意記憶） */
import { THREE, Scheduler, centerOnRect, fitCameraDistance, shuffle } from './engine.js';
import { gradientTexture, Sparks, Embers, makeGlow } from './fx.js';
import { createTorch } from './models.js';
import { IDIOMS } from './idioms.js';
import { Sound, buzz } from './sound.js';

const SERIF = '"Noto Serif TC", "Noto Sans TC", "PingFang HK", serif';
const TEX_W = 1024, TEX_H = 340;
const ALL = Object.values(IDIOMS).flat();
const BANK = new Set(ALL.map(([w]) => w));
const MEANING = new Map(ALL);

/* 石碑正面（CanvasTexture），刻字效果 */
class TabletFace {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_W;
    this.canvas.height = TEX_H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    // 石紋（固定）
    this.speckle = Array.from({ length: 260 }, () => [Math.random() * TEX_W, Math.random() * TEX_H, Math.random() * 3 + 1, Math.random()]);
  }

  draw(text, hidden, active, gold) {
    const g = this.g;
    const grad = g.createLinearGradient(0, 0, 0, TEX_H);
    grad.addColorStop(0, '#9a9ea8');
    grad.addColorStop(1, '#6a6e79');
    g.fillStyle = grad;
    g.fillRect(0, 0, TEX_W, TEX_H);
    this.speckle.forEach(([x, y, r, a]) => {
      g.fillStyle = a > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });
    // 刻邊
    g.strokeStyle = 'rgba(40,42,50,.75)';
    g.lineWidth = 8;
    g.strokeRect(22, 22, TEX_W - 44, TEX_H - 44);
    g.strokeStyle = 'rgba(220,224,232,.35)';
    g.lineWidth = 3;
    g.strokeRect(30, 30, TEX_W - 60, TEX_H - 60);

    const cell = (TEX_W - 80) / 4;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 190px ${SERIF}`;
    [...text].forEach((ch, i) => {
      const cx = 40 + cell * (i + 0.5), cy = TEX_H / 2 + 8;
      if (hidden.includes(i)) {
        const on = i === active;
        g.save();
        g.setLineDash([18, 12]);
        g.lineWidth = on ? 9 : 6;
        g.strokeStyle = on ? '#ffd56a' : 'rgba(255,213,106,.55)';
        g.shadowColor = '#ffb020';
        g.shadowBlur = on ? 28 : 0;
        g.strokeRect(cx - 98, cy - 112, 196, 212);
        g.restore();
        g.fillStyle = on ? '#ffe08a' : 'rgba(255,224,138,.6)';
        g.font = `900 150px ${SERIF}`;
        g.fillText('？', cx, cy);
        g.font = `900 190px ${SERIF}`;
        return;
      }
      if (gold.includes(i)) {
        g.save();
        g.shadowColor = '#ffb020';
        g.shadowBlur = 30;
        g.fillStyle = '#ffd56a';
        g.fillText(ch, cx, cy);
        g.restore();
        return;
      }
      // 刻字：下右淺色邊 + 深色字
      g.fillStyle = 'rgba(225,228,236,.55)';
      g.fillText(ch, cx + 4, cy + 4);
      g.fillStyle = '#23262e';
      g.fillText(ch, cx, cy);
    });
    this.tex.needsUpdate = true;
  }
}

export class IdiomView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#12303a', '#0b1f26', '#050c10']);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x1a2a30, 1.4));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.0);
    key.position.set(-3, 6, 8);
    this.scene.add(key);

    const stone = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.3, 12), stone(0x3d4650));
    floor.position.y = -0.15;
    this.scene.add(floor);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 10), stone(0x6a727e));
      pillar.position.set(s * 3.4, 2.1, -1.2);
      this.scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 0.95), stone(0x7a828e));
      cap.position.set(s * 3.4, 4.25, -1.2);
      this.scene.add(cap);
    }
    this.torches = [-1, 1].map(s => {
      const t = createTorch({ light: false, height: 1.3 });
      t.group.position.set(s * 2.6, 0, 0.6);
      this.scene.add(t.group);
      return t;
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.45, 0.9), stone(0x55606c));
    base.position.set(0, 0.22, 0);
    this.scene.add(base);

    // 石碑
    this.face = new TabletFace();
    const side = stone(0x7d828e);
    const front = new THREE.MeshBasicMaterial({ map: this.face.tex, toneMapped: false });
    this.tablet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.46, 0.36), [side, side, side, side, front, side]);
    this.tabletY = 0.45 + 0.73;
    this.tablet.position.set(0, this.tabletY, 0);
    this.scene.add(this.tablet);
    this.halo = makeGlow(0xffd56a, 6, 0);
    this.halo.position.set(0, this.tabletY, -0.3);
    this.scene.add(this.halo);
    this.pillarMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 14, 24, 1, true), this.pillarMat);
    this.pillar.position.set(0, 7, 0);
    this.scene.add(this.pillar);

    this.sparks = new Sparks(this.scene, { cap: 400, size: 0.35 });
    this.embers = new Embers(this.scene, { count: 40, box: [10, 5, 4], center: [0, 2, -0.5], color: 0x9ff3ff, size: 0.1, speed: 0.3 });
    this.v = new THREE.Vector3();
    this.W = 1;
    this.H = 1;
    this.active = false;
  }

  hud(level) {
    return {
      mode: 'panel',
      counter: `石碑 <b>1/${level.count}</b>`,
      intro: '🏛️ 古廟石碑封印咗……',
      prep: '石碑上嘅成語缺咗字，揀返正確嘅字',
    };
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    const pool = level.tiers.flatMap(t => IDIOMS[t]);
    const charPool = [...new Set([...IDIOMS[1], ...pool].flatMap(([w]) => [...w]))];
    this.questions = shuffle(pool.slice()).slice(0, level.count).map(([text]) => {
      const blanks = shuffle([0, 1, 2, 3]).slice(0, level.blanks).sort((a, b) => a - b);
      return { text, blanks, options: blanks.map(pos => this.optionsFor(text, pos, charPool)) };
    });
    this.idx = 0;
    this.misses = 0;
    this.firstTry = 0;
    this.phase = 'idle';
    this.active = false;
    this.anim = null;
    this.shake = 0;
    this.glow = 0;
    this.pillarT = -1;
    this.face.draw('　　　　', [], -1, []);
    this.tablet.position.y = -1.6;
    this.hooks.panel().innerHTML = '<p class="panel-wait">石碑升起中……</p>';
    this.layout();
  }

  optionsFor(text, pos, charPool) {
    const ans = text[pos];
    const wrong = shuffle(charPool.slice()).filter(ch => ch !== ans && !text.includes(ch)
      && !BANK.has(text.slice(0, pos) + ch + text.slice(pos + 1))).slice(0, 3);
    return shuffle([ans, ...wrong]);
  }

  begin() {
    this.active = true;
    this.showTablet();
  }

  abort() {
    this.active = false;
    this.sched.clear();
  }

  get q() { return this.questions[this.idx]; }

  redraw() {
    const q = this.q;
    this.face.draw(q.text, this.hidden, this.hidden[0], this.gold);
  }

  showTablet() {
    if (!this.active) return;
    const q = this.q;
    this.hidden = q.blanks.slice();
    this.gold = [];
    this.blankNo = 0;
    this.wrongThis = 0;
    this.redraw();
    // 字型按需要下載，下載完重畫
    if (document.fonts) document.fonts.load(`900 180px ${SERIF}`, q.text + '？').then(() => this.redraw()).catch(() => {});
    this.anim = { from: -1.6, to: this.tabletY, t: 0, dur: 0.7 };
    Sound.rumble();
    this.phase = 'ask';
    this.hooks.counter(`石碑 <b>${this.idx + 1}/${this.level.count}</b>`);
    this.renderPanel();
    this.hooks.toast(this.level.blanks > 1 ? `第 ${this.idx + 1} 塊石碑：缺咗兩個字` : `第 ${this.idx + 1} 塊石碑`);
  }

  renderPanel(meaning = '') {
    const q = this.q;
    const el = this.hooks.panel();
    const prompt = this.level.blanks > 1 ? `揀返第 ${this.blankNo + 1} 個缺字` : '揀返缺咗嘅字';
    const opts = this.phase === 'ask' ? q.options[this.blankNo] : [];
    el.innerHTML = `
      <p class="idiom-progress">第 <b>${this.idx + 1}</b> / ${this.level.count} 塊石碑</p>
      ${this.phase === 'ask' ? `<p class="step-title"><span class="step-no">？</span>${prompt}</p>
      <div class="stones">${opts.map(ch => `<button class="stone-btn" data-ans="${ch}">${ch}</button>`).join('')}</div>` : ''}
      ${meaning ? `<div class="meaning"><b>${q.text}</b>${meaning}</div>` : ''}`;
  }

  panelClick(e) {
    const btn = e.target.closest('[data-ans]');
    if (!btn || btn.disabled || !this.active || this.phase !== 'ask') return;
    const q = this.q;
    const pos = q.blanks[this.blankNo];
    if (btn.dataset.ans !== q.text[pos]) {
      this.misses += 1;
      this.wrongThis += 1;
      btn.disabled = true;
      btn.classList.add('wrong');
      this.shake = 0.45;
      Sound.miss();
      buzz([25, 40, 25]);
      this.hooks.toast('唔係呢個字，再揀過');
      return;
    }
    btn.classList.add('right');
    this.hidden = this.hidden.filter(p => p !== pos);
    this.gold.push(pos);
    this.redraw();
    Sound.gem();
    buzz(15);
    this.blankNo += 1;
    if (this.blankNo < q.blanks.length) {
      this.hooks.toast('啱咗！仲有一個字');
      this.sched.after(0.35, () => this.renderPanel());
      return;
    }
    this.solved();
  }

  solved() {
    this.phase = 'solved';
    if (this.wrongThis === 0) this.firstTry += 1;
    const q = this.q;
    const meaning = MEANING.get(q.text);
    this.renderPanel(meaning);
    this.hooks.toast(`封印解除！「${q.text}」`);
    this.glow = 1;
    this.pillarT = 0;
    Sound.chest();
    this.v.set(0, this.tabletY + 0.4, 0.4);
    this.sparks.spawn(this.v, { count: 70, color: 0xffd56a, speed: 5, life: 1, gravity: 2, up: 2 });
    this.sched.after(2.2, () => { this.anim = { from: this.tabletY, to: -1.8, t: 0, dur: 0.6 }; });
    this.sched.after(2.9, () => {
      this.idx += 1;
      if (this.idx >= this.level.count) this.finish();
      else this.showTablet();
    });
  }

  finish() {
    this.active = false;
    const time = this.hooks.complete();
    const lv = this.level;
    const eff = time + this.misses * 5;
    const stars = eff <= lv.stars[0] ? 3 : eff <= lv.stars[1] ? 2 : 1;
    this.hooks.panel().innerHTML = '<div class="meaning"><b>全部封印解除！</b>古廟大門打開了</div>';
    this.hooks.finish({
      time, stars,
      lines: [['石碑', `${lv.count} 塊`], ['一次答啱', this.firstTry], ['揀錯', this.misses]],
      bonus: this.misses === 0 ? 10 : 0,
      kicker: 'SEAL BROKEN',
      title: stars === 3 ? '博學多才！' : stars === 2 ? '學識淵博！' : '封印全部解除！',
    });
  }

  /* ---------- 版面 ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRects({ stage }) {
    this.rect = stage;
    this.layout();
  }

  layout() {
    const r = this.rect;
    if (!r) return;
    centerOnRect(this.camera, r, this.W, this.H);
    // 以石碑為主體：盡量放大
    const y = this.tabletY;
    const pts = [
      new THREE.Vector3(-2.35, y + 0.8, 0.2), new THREE.Vector3(2.35, y + 0.8, 0.2),
      new THREE.Vector3(-2.5, 0, 0.5), new THREE.Vector3(2.5, 0, 0.5),
    ];
    const target = new THREE.Vector3(0, y * 0.75, 0);
    const dir = new THREE.Vector3(0, 0.18, 1).normalize();
    fitCameraDistance(this.camera, target, dir, pts, r, this.W, this.H, 4);
  }

  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    this.embers.update(dt, t);
    this.torches.forEach(tc => tc.update(dt, t));
    if (this.anim) {
      this.anim.t += dt;
      const k = Math.min(1, this.anim.t / this.anim.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.tablet.position.y = this.anim.from + (this.anim.to - this.anim.from) * e;
      if (k >= 1) this.anim = null;
    }
    this.tablet.position.x = this.shake > 0 ? Math.sin(t * 60) * 0.06 * (this.shake / 0.45) : 0;
    this.shake = Math.max(0, this.shake - dt);
    this.glow = Math.max(0, this.glow - dt * 0.6);
    this.halo.material.opacity = this.glow * 0.9;
    this.halo.position.y = this.tablet.position.y;
    if (this.pillarT >= 0) {
      this.pillarT += dt;
      const k = this.pillarT;
      this.pillarMat.opacity = k < 0.2 ? k / 0.2 * 0.45 : Math.max(0, 0.45 - (k - 0.2) * 0.35);
      if (k > 1.6) { this.pillarT = -1; this.pillarMat.opacity = 0; }
    }
  }
}
