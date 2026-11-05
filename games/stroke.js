/* 一筆畫地城：每塊地磚行一次，點亮全部符文；行返上一格＝退一步 */
import { THREE, shuffle } from './engine.js';
import { makeGlow } from './fx.js';
import { createChest } from './models.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';
import { GridWorld, DIRS } from './grid-world.js';

const DIR_WORD = { up: '上', down: '下', left: '左', right: '右' };
const FLOOR_A = new THREE.Color(0x3b3366);
const FLOOR_B = new THREE.Color(0x433a72);
const LIT = new THREE.Color(0xc9962c);
const LIT_HEAD = new THREE.Color(0xffd56a);
const PIT = new THREE.Color(0x0c0a16);

/* 漢密頓路徑搜尋（Warnsdorff 排序 + 死路剪枝，有節點上限） */
function solve(n, blocked, visitedInit, pathInit, cap) {
  const visited = Uint8Array.from(visitedInit);
  const path = pathInit.slice();
  let total = 0;
  for (let i = 0; i < n * n; i++) if (!blocked[i]) total += 1;
  const nbrs = i => {
    const x = i % n, y = Math.floor(i / n), out = [];
    if (x > 0) out.push(i - 1);
    if (x < n - 1) out.push(i + 1);
    if (y > 0) out.push(i - n);
    if (y < n - 1) out.push(i + n);
    return out.filter(j => !blocked[j]);
  };
  const N = Array.from({ length: n * n }, (_, i) => nbrs(i));
  const free = j => !visited[j];
  let nodes = 0;
  const feasible = cur => {
    // 未行嘅格：冇出路 → 死；淨一條出路（唔係貼住而家位置）＝ 終點，最多一個
    let ends = 0;
    for (let u = 0; u < n * n; u++) {
      if (blocked[u] || visited[u]) continue;
      let d = 0, adjCur = false;
      for (const v of N[u]) { if (!visited[v]) d += 1; if (v === cur) adjCur = true; }
      if (adjCur) d += 1;
      if (d === 0) return false;
      if (d === 1 && !adjCur) { ends += 1; if (ends > 1) return false; }
    }
    return true;
  };
  const dfs = cur => {
    if (path.length === total) return true;
    if (++nodes > cap) return false;
    if (!feasible(cur)) return false;
    const opts = N[cur].filter(free)
      .map(j => [j, N[j].filter(free).length + Math.random() * 0.6])
      .sort((a, b) => a[1] - b[1]);
    for (const [j] of opts) {
      visited[j] = 1;
      path.push(j);
      if (dfs(j)) return true;
      visited[j] = 0;
      path.pop();
      if (nodes > cap) return false;
    }
    return false;
  };
  return dfs(path[path.length - 1]) ? path : null;
}

/* 生成保證有解嘅地圖：先放石柱，再搵一條行晒所有格嘅路線 */
function generate(n, holes) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const blocked = new Uint8Array(n * n);
    const cand = shuffle(Array.from({ length: n * n }, (_, i) => i));
    let placed = 0;
    for (const i of cand) {
      if (placed >= holes) break;
      const x = i % n, y = Math.floor(i / n);
      // 石柱唔貼住石柱，令地圖唔會太散
      const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .some(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && blocked[b * n + a]);
      if (near) continue;
      blocked[i] = 1;
      placed += 1;
    }
    let black = 0, white = 0;
    for (let i = 0; i < n * n; i++) {
      if (blocked[i]) continue;
      if (((i % n) + Math.floor(i / n)) % 2) white += 1; else black += 1;
    }
    if (Math.abs(black - white) > 1) continue;
    const starts = shuffle(Array.from({ length: n * n }, (_, i) => i).filter(i => {
      if (blocked[i]) return false;
      const isWhite = ((i % n) + Math.floor(i / n)) % 2 === 1;
      return black === white || (black > white ? !isWhite : isWhite);
    })).slice(0, 4);
    for (const s of starts) {
      const visited = new Uint8Array(n * n);
      visited[s] = 1;
      const path = solve(n, blocked, visited, [s], 6000);
      if (path) return { blocked, solution: path };
    }
  }
  // 後備：冇石柱，蛇形路線
  const solution = [];
  for (let y = 0; y < n; y++) for (let k = 0; k < n; k++) solution.push(y * n + (y % 2 ? n - 1 - k : k));
  return { blocked: new Uint8Array(n * n), solution };
}

export class StrokeView extends GridWorld {
  constructor(hooks) {
    super(hooks, { bg: ['#1c1640', '#110d28', '#06050f'] });
    this.alwaysFull = true;
    this.wallH = 0.3;
    this.mtx = new THREE.Matrix4();
    this.col = new THREE.Color();
    this.parts = [];
    this.chest = null;
  }

  hud(level) {
    return {
      mode: 'grid',
      counter: this.counterHtml(),
      intro: '進入符文大廳',
      prep: '每塊地磚都要行過一次，唔可以重複！',
      startMsg: '行過嘅地磚會亮起符文。行錯可以「退一步」',
      tools: [
        { id: 'undo', label: `${icon('undo')}退一步` },
        { id: 'hint', label: `${icon('lamp')}提示` },
        { id: 'reset', label: `${icon('restart')}重來` },
      ],
    };
  }

  counterHtml() { return `符文 <b>${this.path ? this.path.length : 1}/${this.total || 0}</b>`; }

  setup(level) {
    this.level = level;
    this.n = level.size;
    const n = this.n;
    const { blocked, solution } = generate(n, level.holes);
    this.blocked = blocked;
    this.solution = solution;
    this.start = solution[0];
    this.total = solution.length;

    this.parts.forEach(o => this.world.remove(o));
    this.parts = [];
    const add = o => { this.world.add(o); this.parts.push(o); return o; };

    const base = new THREE.Mesh(new THREE.PlaneGeometry(n + 1.2, n + 1.2), new THREE.MeshLambertMaterial({ color: 0x120e24 }));
    base.rotation.x = -Math.PI / 2;
    base.position.set((n - 1) / 2, -0.01, (n - 1) / 2);
    add(base);

    const tileGeo = new THREE.BoxGeometry(0.92, 0.08, 0.92);
    tileGeo.translate(0, -0.04, 0);
    this.floor = add(new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n * n));
    // 符文圈（加法混色；黑色＝隱形）
    const runeGeo = new THREE.RingGeometry(0.22, 0.32, 24);
    runeGeo.rotateX(-Math.PI / 2);
    this.runes = add(new THREE.InstancedMesh(runeGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }), n * n));
    for (let i = 0; i < n * n; i++) {
      this.mtx.makeTranslation(i % n, 0.012, Math.floor(i / n));
      this.floor.setMatrixAt(i, this.mtx);
      this.runes.setMatrixAt(i, this.mtx);
      this.runes.setColorAt(i, this.col.setRGB(0, 0, 0));
    }
    // 路線（金色光帶）
    const segGeo = new THREE.BoxGeometry(1, 0.03, 0.12);
    this.segs = add(new THREE.InstancedMesh(segGeo, new THREE.MeshBasicMaterial({
      color: 0xffc94a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    }), n * n));
    this.segs.count = 0;

    // 石柱
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8296, roughness: 0.95, flatShading: true });
    for (let i = 0; i < n * n; i++) {
      if (!blocked[i]) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36), rockMat);
      rock.scale.set(1, 1.5, 1);
      rock.rotation.y = Math.random() * 3;
      rock.position.set(i % n, 0.42, Math.floor(i / n));
      add(rock);
    }
    // 外框
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xe0cfa6 });
    const L = n + 0.3, h = 0.3, t = 0.15, c = (n - 1) / 2;
    [[c, -0.575, L, t], [c, n - 0.425, L, t], [-0.575, c, t, L], [n - 0.425, c, t, L]].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, h / 2, z);
      add(m);
    });
    // 起點光環
    this.startGlow = add(makeGlow(0x7dffa8, 1.4, 0.5));
    this.startGlow.position.set(this.start % n, 0.15, Math.floor(this.start / n));
    this.hintGlow = add(makeGlow(0x6fe3ff, 1.5, 0));

    if (this.chest) this.scene.remove(this.chest.group);
    this.chest = createChest({ light: true });
    this.chest.group.visible = false;
    this.scene.add(this.chest.group);
    this.chestT = -1;

    this.resetHero(this.start % n, Math.floor(this.start / n));
    this.resetPath();
    this.undos = 0;
    this.hints = 0;
    this.resets = 0;
    this.finished = false;
    this.layout();
  }

  resetPath() {
    this.lit = new Uint8Array(this.n * this.n);
    this.lit[this.start] = 1;
    this.path = [this.start];
    this.hintCell = -1;
    this.paint();
  }

  /* 地磚顏色、符文、路線 */
  paint() {
    const n = this.n;
    const head = this.path[this.path.length - 1];
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = Math.floor(i / n);
      if (this.blocked[i]) this.col.copy(PIT);
      else if (this.lit[i]) this.col.copy(i === head ? LIT_HEAD : LIT);
      else this.col.copy((x + y) % 2 ? FLOOR_B : FLOOR_A);
      this.floor.setColorAt(i, this.col);
      this.runes.setColorAt(i, this.lit[i] ? this.col.setRGB(1, 0.85, 0.45) : this.col.setRGB(0, 0, 0));
    }
    this.floor.instanceColor.needsUpdate = true;
    this.runes.instanceColor.needsUpdate = true;
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let k = 1; k < this.path.length; k++) {
      const a = this.path[k - 1], b = this.path[k];
      const ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ay === by ? 0 : Math.PI / 2);
      sc.set(1, 1, 1);
      this.mtx.compose(this.tmp.set((ax + bx) / 2, 0.02, (ay + by) / 2), q, sc);
      this.segs.setMatrixAt(k - 1, this.mtx);
    }
    this.segs.count = Math.max(0, this.path.length - 1);
    this.segs.instanceMatrix.needsUpdate = true;
    this.hooks.counter(this.counterHtml());
  }

  /* ---------- 移動規則 ---------- */
  inside(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }

  canStep(d, nx, ny) {
    if (!this.inside(nx, ny)) return false;
    const j = this.idx(nx, ny);
    if (this.blocked[j]) return false;
    if (!this.lit[j]) return true;
    if (j === this.path[this.path.length - 2]) return true;  // 行返上一格＝退一步
    this.hooks.toast('呢格已經行過喇，揀第二條路');
    return false;
  }

  onStep(d, from, to) {
    this.hintCell = -1;
    if (this.lit[to]) {
      this.lit[from] = 0;
      this.path.pop();
      this.undos += 1;
      Sound.close();
    } else {
      this.lit[to] = 1;
      this.path.push(to);
      Sound.rune(this.path.length);
    }
    this.paint();
  }

  onArrive() {
    if (this.path.length === this.total) { this.finish(); return; }
    const x = this.hx, y = this.hy;
    const forward = Object.values(DIRS).some(d => {
      const nx = x + d.dx, ny = y + d.dy;
      return this.inside(nx, ny) && !this.blocked[this.idx(nx, ny)] && !this.lit[this.idx(nx, ny)];
    });
    if (!forward) this.hooks.toast('冇路可行喇！試下「退一步」或者「提示」');
  }

  /* ---------- 工具掣 ---------- */
  tool(id) {
    if (!this.active || this.anim) return;
    if (id === 'undo') {
      if (this.path.length < 2) { this.hooks.toast('已經喺起點喇'); return; }
      const prev = this.path[this.path.length - 2];
      const px = prev % this.n, py = Math.floor(prev / this.n);
      const dir = Object.values(DIRS).find(d => this.hx + d.dx === px && this.hy + d.dy === py);
      this.move(dir.name);
    } else if (id === 'reset') {
      this.resets += 1;
      const s = this.start;
      this.hx = s % this.n;
      this.hy = Math.floor(s / this.n);
      this.pos.set(this.hx, this.hy);
      this.queued = null;
      this.resetPath();
      Sound.shuffle();
      this.hooks.toast('返回起點，重新開始！');
    } else if (id === 'hint') {
      this.hints += 1;
      const visited = Uint8Array.from(this.lit);
      const sol = solve(this.n, this.blocked, visited, this.path, 40000);
      if (!sol) {
        this.hooks.toast('呢條路行唔通喇，試下退幾步');
        return;
      }
      const next = sol[this.path.length];
      this.hintCell = next;
      const nx = next % this.n, ny = Math.floor(next / this.n);
      const dir = Object.values(DIRS).find(d => this.hx + d.dx === nx && this.hy + d.dy === ny);
      this.hooks.toast(`提示：向${DIR_WORD[dir.name]}行`);
    }
  }

  finish() {
    this.active = false;
    this.finished = true;
    const time = this.hooks.complete();
    this.hero.celebrate();
    Sound.chest();
    buzz([40, 60, 80]);
    const c = (this.n - 1) / 2;
    this.chest.group.visible = true;
    this.chest.group.position.set(c, -1, c);
    this.chestT = 0;
    this.hooks.toast('全部符文點亮！寶箱出現了！');
    const lv = this.level;
    const stars = time <= lv.stars[0] ? 3 : time <= lv.stars[1] ? 2 : 1;
    const { undos, hints } = this;
    this.sched.after(1.8, () => this.hooks.finish({
      time, stars,
      lines: [['地磚', `${this.total} 格`], ['退一步', undos], ['提示', hints]],
      bonus: hints === 0 ? 10 : 0,
      kicker: 'ONE STROKE',
      title: stars === 3 ? '一筆完成！' : stars === 2 ? '路線規劃成功！' : '符文全部點亮！',
    }));
  }

  tick(dt, t) {
    this.startGlow.material.opacity = this.path.length === 1 ? 0.45 + 0.2 * Math.sin(t * 3) : 0;
    if (this.hintCell >= 0) {
      this.hintGlow.position.set(this.hintCell % this.n, 0.2, Math.floor(this.hintCell / this.n));
      this.hintGlow.material.opacity = 0.55 + 0.35 * Math.sin(t * 7);
    } else {
      this.hintGlow.material.opacity = 0;
    }
    if (this.chestT >= 0) {
      this.chestT += dt;
      const k = Math.min(1, this.chestT / 0.8);
      const c = (this.n - 1) / 2;
      this.chest.group.position.set(c, -1 + k * 2.2, c);
      this.chest.group.scale.setScalar(1.2);
      if (this.chestT > 0.8 && !this.chest.isOpen) {
        this.chest.open();
        this.tmp.set(c, 1.6, c);
        this.sparks.spawn(this.tmp, { count: 120, color: 0xffd56a, speed: 5, life: 1.1, gravity: 4, up: 3 });
      }
    }
    if (this.chest) this.chest.update(dt, t);
  }
}
export { generate as generateStroke, solve as solveStroke };  // 測試用
