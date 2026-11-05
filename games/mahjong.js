/* 麻雀連連看：兩隻相同嘅牌，連線轉彎唔多過兩次就消除 */
import { THREE, Scheduler, clamp, shuffle } from './engine.js';
import { gradientTexture, Sparks, makeGlow } from './fx.js';
import { MJ_TYPES, mahjongTexture, ensureMahjongFonts } from './textures.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';

const FOV = 36;
const CAM_Z = 18;
const TW = 0.76, TH = 1.0;           // 牌身
const CW = 0.82, CH = 1.06;          // 格距
const POOLS = {
  easy: [...Array(9).keys(), 27, 28, 29, 30, 31, 32, 33],                  // 萬子 + 字牌
  normal: [...Array(18).keys(), 27, 28, 29, 30, 31, 32, 33],               // + 筒子
  all: [...Array(34).keys()],
};
const DIRS4 = [[-1, 0], [0, 1], [1, 0], [0, -1]];

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

export class MahjongView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#3a2414', '#24160c', '#120a05']);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
    this.camera.position.set(0, 0, CAM_Z);

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2010, 1.5));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(-4, 6, 10);
    this.scene.add(key);

    this.board = new THREE.Group();
    this.scene.add(this.board);
    // 綠色枱布 + 木框
    this.felt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x1f6b45 }));
    this.felt.position.z = -0.42;
    this.board.add(this.felt);
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.6 });
    this.frame = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.4), this.frameMat);
      this.board.add(m);
      return m;
    });

    this.tileGroup = new THREE.Group();
    this.board.add(this.tileGroup);
    this.bodyGeo = new THREE.ExtrudeGeometry(roundedRect(TW, TH, 0.1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 5 });
    this.bodyGeo.translate(0, 0, -0.19);
    this.backGeo = new THREE.ExtrudeGeometry(roundedRect(TW, TH, 0.1), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 5 });
    this.backGeo.translate(0, 0, -0.33);
    this.faceGeo = new THREE.PlaneGeometry(TW * 0.92, TH * 0.92);
    this.backMat = new THREE.MeshStandardMaterial({ color: 0x1f8a52, roughness: 0.4 });

    this.lineGroup = new THREE.Group();
    this.board.add(this.lineGroup);
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sparks = new Sparks(this.scene, { cap: 500, size: 0.35 });

    this.tiles = [];
    this.W = 1;
    this.H = 1;
    this.active = false;
    this.v = new THREE.Vector3();
  }

  hud(level) {
    return {
      mode: 'board',
      counter: `剩餘 <b>${level.rows * level.cols}</b>`,
      intro: '開枱！麻雀連連看',
      prep: '揀兩隻相同嘅牌，連線轉彎唔多過兩次就消除',
      startMsg: '點一隻牌，再點另一隻相同嘅牌',
      tools: [
        { id: 'hint', label: `${icon('lamp')}提示 <b>3</b>` },
        { id: 'shuffle', label: `${icon('shuffle')}洗牌 <b>+5秒</b>` },
      ],
    };
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    this.R = level.rows;
    this.C = level.cols;
    const R = this.R, C = this.C;
    ensureMahjongFonts();
    const types = shuffle(POOLS[level.pool].slice()).slice(0, level.types);
    const pairs = R * C / 2;
    const deal = [];
    for (let k = 0; k < pairs; k++) { const t = types[k % types.length]; deal.push(t, t); }
    this.grid = new Int16Array(R * C);
    do { shuffle(deal); deal.forEach((t, i) => { this.grid[i] = t; }); } while (!this.findAnyPair());

    this.tiles.forEach(t => { if (t) { this.tileGroup.remove(t.mesh); t.faceMat.dispose(); t.mat.dispose(); } });
    this.tiles = Array.from({ length: R * C }, (_, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xfbf3dc, roughness: 0.35 });
      const mesh = new THREE.Mesh(this.bodyGeo, mat);
      mesh.add(new THREE.Mesh(this.backGeo, this.backMat));
      const faceMat = new THREE.MeshBasicMaterial({ map: mahjongTexture(this.grid[i]), toneMapped: false });
      const face = new THREE.Mesh(this.faceGeo, faceMat);
      face.position.z = 0.012;
      mesh.add(face);
      this.tileGroup.add(mesh);
      return { i, mesh, mat, faceMat, z: 0, lift: 0, flash: 0, shake: 0, gone: -1, hint: false, appear: 0.2 + Math.random() * 0.4 };
    });
    this.sel = -1;
    this.left = R * C;
    this.misses = 0;
    this.hintsLeft = 3;
    this.hintsUsed = 0;
    this.shuffles = 0;
    this.age = 0;
    this.active = false;
    this.lineGroup.clear();
    this.layout();
  }

  begin() { this.active = true; }
  abort() { this.active = false; this.sched.clear(); }

  /* ---------- 連線（0-1 BFS，轉彎 ≤ 2，可以經外圍空位） ---------- */
  findPath(a, b) {
    const R = this.R, C = this.C, PC = C + 2, PR = R + 2;
    const pr = i => Math.floor(i / C) + 1, pc = i => (i % C) + 1;
    const empty = (r, c) => {
      if (r < 0 || c < 0 || r >= PR || c >= PC) return false;
      if (r === 0 || c === 0 || r === PR - 1 || c === PC - 1) return true;
      return this.grid[(r - 1) * C + (c - 1)] < 0;
    };
    const ar = pr(a), ac = pc(a), br = pr(b), bc = pc(b);
    const best = new Int8Array(PR * PC * 4).fill(9);
    const parent = new Int32Array(PR * PC * 4).fill(-1);
    const dq = [];
    const key = (r, c, d) => (r * PC + c) * 4 + d;
    for (let d = 0; d < 4; d++) {
      const r = ar + DIRS4[d][0], c = ac + DIRS4[d][1];
      if (r === br && c === bc) return [[ar, ac], [br, bc]];
      if (empty(r, c)) { best[key(r, c, d)] = 0; parent[key(r, c, d)] = -2; dq.push([r, c, d, 0]); }
    }
    while (dq.length) {
      const [r, c, d, turns] = dq.shift();
      if (turns > best[key(r, c, d)]) continue;
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue;
        const cost = turns + (nd === d ? 0 : 1);
        if (cost > 2) continue;
        const nr = r + DIRS4[nd][0], nc = c + DIRS4[nd][1];
        if (nr === br && nc === bc) {
          // 還原路徑
          const cells = [[br, bc], [r, c]];
          let k = key(r, c, d);
          while (parent[k] >= 0) { k = parent[k]; const kk = Math.floor(k / 4); cells.push([Math.floor(kk / PC), kk % PC]); }
          cells.push([ar, ac]);
          return cells.reverse();
        }
        if (!empty(nr, nc)) continue;
        const k2 = key(nr, nc, nd);
        if (cost < best[k2]) {
          best[k2] = cost;
          parent[k2] = key(r, c, d);
          if (nd === d) dq.unshift([nr, nc, nd, cost]); else dq.push([nr, nc, nd, cost]);
        }
      }
    }
    return null;
  }

  findAnyPair() {
    const byType = new Map();
    this.grid.forEach((t, i) => { if (t >= 0) { if (!byType.has(t)) byType.set(t, []); byType.get(t).push(i); } });
    for (const list of byType.values()) {
      for (let x = 0; x < list.length; x++) {
        for (let y = x + 1; y < list.length; y++) {
          if (this.findPath(list[x], list[y])) return [list[x], list[y]];
        }
      }
    }
    return null;
  }

  /* ---------- 版面（必要時打橫擺） ---------- */
  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.layout();
  }

  setRects({ play }) {
    this.rect = play;
    this.layout();
  }

  /* 邏輯格 → 畫面格（轉置時行列對調） */
  disp(r, c) { return this.transposed ? [c, r] : [r, c]; }
  cellPos(r, c) {
    // r, c 係補邊座標（0 ＝ 外圍）
    const [dr, dc] = this.disp(r, c);
    return [(dc - (this.DC + 1) / 2) * CW, ((this.DR + 1) / 2 - dr) * CH];
  }

  layout() {
    const r = this.rect;
    if (!r || !this.tiles.length) return;
    const R = this.R, C = this.C;
    const rectTall = r.height > r.width;
    this.transposed = (rectTall && C > R) || (!rectTall && R > C);
    this.DR = this.transposed ? C : R;
    this.DC = this.transposed ? R : C;
    // 枱布要包住外圍一圈（連線可以經外圍）
    const bw = (this.DC + 1.7) * CW, bh = (this.DR + 1.7) * CH;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const ppu0 = this.H / (2 * CAM_Z * tanHalf);
    const s = Math.min(r.width / bw, r.height / bh) / ppu0;
    this.board.scale.setScalar(s);
    this.board.position.set((r.cx - this.W / 2) / ppu0, -(r.cy - this.H / 2) / ppu0, 0);
    this.scale = s;
    this.ppu = ppu0 * s;

    this.felt.scale.set(bw, bh, 1);
    const ft = 0.22;
    [[0, bh / 2 + ft / 2, bw + ft * 2, ft], [0, -bh / 2 - ft / 2, bw + ft * 2, ft], [-bw / 2 - ft / 2, 0, ft, bh], [bw / 2 + ft / 2, 0, ft, bh]]
      .forEach(([x, y, w, h], k) => { this.frame[k].position.set(x, y, -0.15); this.frame[k].scale.set(w, h, 1); });
    this.tiles.forEach(t => {
      const [x, y] = this.cellPos(Math.floor(t.i / C) + 1, (t.i % C) + 1);
      t.mesh.position.x = x;
      t.mesh.position.y = y;
    });
  }

  /* ---------- 觸控 ---------- */
  pointerDown(x, y) {
    if (!this.active) return;
    const lx = (x - (this.W / 2 + this.board.position.x * (this.ppu / this.scale))) / this.ppu;
    const ly = -(y - (this.H / 2 - this.board.position.y * (this.ppu / this.scale))) / this.ppu;
    const dc = Math.round(lx / CW + (this.DC + 1) / 2);
    const dr = Math.round((this.DR + 1) / 2 - ly / CH);
    if (dr < 1 || dc < 1 || dr > this.DR || dc > this.DC) return;
    const [r, c] = this.transposed ? [dc, dr] : [dr, dc];
    const i = (r - 1) * this.C + (c - 1);
    if (this.grid[i] < 0) return;
    this.tap(i);
  }

  tap(i) {
    this.clearHint();
    if (this.sel < 0) { this.select(i); return; }
    if (this.sel === i) { this.tiles[i].lift = 0; this.sel = -1; Sound.close(); return; }
    const a = this.sel;
    if (this.grid[a] !== this.grid[i]) { this.select(i); return; }
    const path = this.findPath(a, i);
    if (!path) {
      this.misses += 1;
      this.tiles[i].shake = 0.4;
      Sound.miss();
      buzz([20, 30, 20]);
      this.hooks.toast('呢對牌連唔到：轉彎太多，或者被其他牌擋住');
      this.select(i);
      return;
    }
    this.match(a, i, path);
  }

  select(i) {
    if (this.sel >= 0) this.tiles[this.sel].lift = 0;
    this.sel = i;
    this.tiles[i].lift = 1;
    Sound.flip();
    this.hooks.toast(`揀咗「${MJ_TYPES[this.grid[i]].name}」，再揀一隻相同嘅牌`);
  }

  match(a, b, path) {
    const name = MJ_TYPES[this.grid[a]].name;
    this.grid[a] = -1;
    this.grid[b] = -1;
    this.sel = -1;
    this.left -= 2;
    this.drawPath(path);
    Sound.gem();
    buzz(15);
    [a, b].forEach(i => {
      const t = this.tiles[i];
      t.gone = 0;
      t.mesh.getWorldPosition(this.v);
      this.sparks.spawn(this.v, { count: 18, color: 0xffd56a, speed: 3, life: 0.6, gravity: 2 });
    });
    this.hooks.counter(`剩餘 <b>${this.left}</b>`);
    this.hooks.toast(`消除「${name}」！`);
    this.sched.after(0.45, () => this.lineGroup.clear());
    if (this.left === 0) { this.finish(); return; }
    if (!this.findAnyPair()) {
      this.sched.after(0.6, () => { this.reshuffle(); this.hooks.toast('冇牌可以連喇，自動洗牌！'); });
    }
  }

  drawPath(cells) {
    this.lineGroup.clear();
    const pts = cells.map(([r, c]) => this.cellPos(r, c));
    for (let k = 1; k < pts.length; k++) {
      const [x1, y1] = pts[k - 1], [x2, y2] = pts[k];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 1e-3) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.1, 0.05), this.lineMat);
      seg.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.45);
      seg.rotation.z = Math.atan2(y2 - y1, x2 - x1);
      this.lineGroup.add(seg);
    }
    [pts[0], pts[pts.length - 1]].forEach(([x, y]) => {
      const g = makeGlow(0xffd56a, 1.2, 0.9);
      g.position.set(x, y, 0.5);
      this.lineGroup.add(g);
    });
  }

  reshuffle() {
    const live = [];
    this.grid.forEach((t, i) => { if (t >= 0) live.push(i); });
    const vals = live.map(i => this.grid[i]);
    let tries = 0;
    do { shuffle(vals); live.forEach((i, k) => { this.grid[i] = vals[k]; }); tries += 1; } while (!this.findAnyPair() && tries < 80);
    live.forEach(i => {
      const t = this.tiles[i];
      t.faceMat.map = mahjongTexture(this.grid[i]);
      t.faceMat.needsUpdate = true;
      t.flash = 1;
    });
    if (this.sel >= 0) { this.tiles[this.sel].lift = 0; this.sel = -1; }
    Sound.shuffle();
  }

  clearHint() {
    this.tiles.forEach(t => { t.hint = false; });
  }

  tool(id) {
    if (!this.active) return;
    if (id === 'hint') {
      if (this.hintsLeft <= 0) { this.hooks.toast('提示用晒喇'); return; }
      const pair = this.findAnyPair();
      if (!pair) return;
      this.hintsLeft -= 1;
      this.hintsUsed += 1;
      this.clearHint();
      pair.forEach(i => { this.tiles[i].hint = true; });
      this.hooks.setTool('hint', `${icon('lamp')}提示 <b>${this.hintsLeft}</b>`, this.hintsLeft <= 0);
      this.hooks.toast(`提示：留意發光嘅兩隻「${MJ_TYPES[this.grid[pair[0]]].name}」`);
    } else if (id === 'shuffle') {
      this.shuffles += 1;
      this.hooks.penalty(5);
      this.reshuffle();
      this.hooks.toast('洗牌！（+5 秒）');
    }
  }

  finish() {
    this.active = false;
    const time = this.hooks.complete();
    this.hooks.toast('清枱！食糊！');
    const lv = this.level;
    const stars = time <= lv.stars[0] ? 3 : time <= lv.stars[1] ? 2 : 1;
    const { misses, hintsUsed, shuffles } = this;
    this.sched.after(0.8, () => {
      Sound.chest();
      this.v.set(this.board.position.x, this.board.position.y, 1);
      this.sparks.spawn(this.v, { count: 140, color: 0xffd56a, speed: 7, life: 1.1, gravity: 4, up: 2 });
    });
    this.sched.after(1.8, () => this.hooks.finish({
      time, stars,
      lines: [['連唔到', misses], ['提示', hintsUsed], ['洗牌', shuffles]],
      bonus: hintsUsed === 0 && shuffles === 0 ? 10 : 0,
      kicker: 'ALL CLEAR',
      title: stars === 3 ? '雀神降臨！' : stars === 2 ? '清枱成功！' : '全部消除！',
    }));
  }

  /* ---------- 每格更新 ---------- */
  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    this.age += dt;
    for (const tile of this.tiles) {
      const m = tile.mesh;
      if (tile.gone >= 0) {
        tile.gone = Math.min(1, tile.gone + dt / 0.45);
        m.scale.setScalar(Math.max(0.001, 1 - tile.gone));
        m.rotation.z = tile.gone * 2;
        m.position.z = tile.gone * 1.2;
        if (tile.gone >= 1) m.visible = false;
        continue;
      }
      const a = clamp((this.age - tile.appear) / 0.35, 0, 1);
      m.scale.setScalar(Math.max(0.001, a));
      tile.z += (tile.lift * 0.35 - tile.z) * Math.min(1, dt * 14);
      m.position.z = tile.z;
      m.rotation.z = tile.shake > 0 ? Math.sin(t * 60) * 0.08 * (tile.shake / 0.4) : 0;
      tile.shake = Math.max(0, tile.shake - dt);
      const em = tile.mat.emissive;
      const fc = tile.faceMat.color;
      em.setRGB(0, 0, 0);
      fc.setRGB(1, 1, 1);
      if (tile.lift > 0) { em.setRGB(0.55, 0.4, 0.05); fc.setRGB(1, 0.86, 0.45); }
      if (tile.hint) {
        const k = 0.5 + 0.5 * Math.sin(t * 7);
        em.setRGB(0.1 * k, 0.6 * k, 0.8 * k);
        fc.setRGB(1 - 0.45 * k, 1, 1);
      }
      if (tile.flash > 0) { em.r += tile.flash * 0.5; em.g += tile.flash * 0.5; em.b += tile.flash * 0.3; tile.flash = Math.max(0, tile.flash - dt * 2); }
    }
  }
}
