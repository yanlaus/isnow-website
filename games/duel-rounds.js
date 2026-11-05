/* 對決擂台嘅每款回合。共用介面：
   { name, icon, rule(speed), limit?, create(ctx) → { start(), press(side, value, ts, el), update?(dt), timeout?(), destroy?() } }
   ctx：prompt/pad/msg(side|'both', …)、padEl(side)、after(sec, fn)、now()、lock(side, sec)、locked(side)、
        win(side, note)、draw(note)、names、speed（'easy'｜'normal'）、sound、buzz */
import { icon } from './icons.js';
import { THREE, snapshot } from './engine.js';
import { createItem } from './items.js';

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

/* ===================== 騎士拔劍（反應＋自制） ===================== */
class QuickDraw {
  constructor(ctx) {
    this.c = ctx;
    this.score = [0, 0];
    this.n = 0;
    this.state = 'idle';
  }
  start() {
    this.c.pad('both', `<button class="duel-btn draw" data-duel="draw">${icon('swords')}拔劍</button>`);
    this.nextDraw();
  }
  tally() { return `${this.c.names[0]} ${this.score[0]} : ${this.score[1]} ${this.c.names[1]}`; }
  waitHtml() { return `<div class="qd-wait">準備……</div><div class="qd-sub">第 ${this.n} 次・${this.tally()}</div>`; }
  nextDraw() {
    const c = this.c;
    this.n += 1;
    this.state = 'wait';
    c.prompt('both', this.waitHtml());
    c.msg('both', '見到「斬！」先好撳');
    const delay = rand(1.8, 4.2);
    // 標準難度：中途有假信號（「暫」「漸」似「斬」）
    if (c.speed !== 'easy') {
      const count = Math.random() < 0.6 ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const at = rand(0.7, Math.max(0.8, delay - 1.2));
        c.after(at, () => {
          if (this.state !== 'wait') return;
          c.prompt('both', `<div class="qd-fake">${pick(['暫', '漸', '斷'])}！</div><div class="qd-sub">唔係「斬」，唔好撳！</div>`);
          c.after(0.7, () => { if (this.state === 'wait') c.prompt('both', this.waitHtml()); });
        });
      }
    }
    c.after(delay, () => {
      if (this.state !== 'wait') return;
      this.state = 'go';
      this.goAt = performance.now();
      c.prompt('both', '<div class="qd-go">斬！</div>');
      c.sound.go();
      c.after(3, () => {
        if (this.state !== 'go') return;
        this.state = 'done';
        c.msg('both', '冇人拔劍？再嚟過');
        c.after(1.2, () => this.nextDraw());
      });
    });
  }
  press(side, value, ts) {
    if (value !== 'draw') return;
    const c = this.c;
    const foe = 1 - side;
    // 撳嘅時間早過「斬」出現（排隊中嘅觸控都計）＝犯規
    if (this.state === 'wait' || (this.state === 'go' && ts < this.goAt)) {
      this.state = 'done';
      c.sound.miss();
      c.buzz(60);
      c.prompt(side, '<div class="qd-foul">太早！犯規</div>');
      c.prompt(foe, `<div class="qd-res">${c.names[side]}犯規，你贏呢次</div>`);
      this.point(foe, `${c.names[side]}犯規`);
    } else if (this.state === 'go') {
      this.state = 'done';
      const rt = Math.max(0, (ts - this.goAt) / 1000);
      c.sound.hit(4, true);
      c.prompt(side, `<div class="qd-res win">快！${rt.toFixed(2)} 秒</div>`);
      c.prompt(foe, `<div class="qd-res">${c.names[side]}快啲（${rt.toFixed(2)} 秒）</div>`);
      this.point(side, `反應 ${rt.toFixed(2)} 秒`);
    }
  }
  point(side, note) {
    const c = this.c;
    this.score[side] += 1;
    c.msg('both', this.tally());
    if (this.score[side] >= 2) c.after(1.0, () => c.win(side, `拔劍 ${this.score[side]} : ${this.score[1 - side]}・${note}`));
    else c.after(1.5, () => this.nextDraw());
  }
}

/* ===================== 數觸之戰（雙人）：同一個排列，先點完者勝 ===================== */
class SchulteDuel {
  constructor(ctx) {
    this.c = ctx;
    this.n = ctx.speed === 'easy' ? 3 : 4;
    this.total = this.n * this.n;
    this.next = [1, 1];
  }
  start() {
    const nums = shuffle(Array.from({ length: this.total }, (_, i) => i + 1));
    this.c.pad('both', `<div class="sd-grid" style="--n:${this.n}">${nums.map(v => `<button class="duel-btn sd-tile" data-duel="${v}">${v}</button>`).join('')}</div>`);
    this.t0 = this.c.now();
    this.progress();
  }
  progress() {
    const pct = s => Math.round(((this.next[s] - 1) / this.total) * 100);
    [0, 1].forEach(s => this.c.prompt(s, `<div class="sd-next">下一個 <b>${this.next[s]}</b></div>
      <div class="sd-bars"><span>你</span><i class="me" style="--p:${pct(s)}%"></i><span>對手</span><i style="--p:${pct(1 - s)}%"></i></div>`));
  }
  timeout() {
    const [a, b] = this.next;
    if (a === b) this.c.draw('夠鐘，進度一樣');
    else this.c.win(a > b ? 0 : 1, `夠鐘，點到 ${Math.max(a, b) - 1} 個`);
  }
  press(side, value, ts, el) {
    const c = this.c;
    const v = Number(value);
    if (!v || v < this.next[side]) return;
    if (v === this.next[side]) {
      if (el) el.classList.add('done');
      c.sound.hit(v - 1, false);
      this.next[side] += 1;
      if (this.next[side] > this.total) { c.win(side, `${(c.now() - this.t0).toFixed(1)} 秒點完 ${this.total} 個`); return; }
      this.progress();
    } else {
      c.sound.miss();
      c.buzz(40);
      c.lock(side, 1);
      if (el) { el.classList.add('wrong'); c.after(0.45, () => el.classList.remove('wrong')); }
      c.msg(side, `點錯！要點 ${this.next[side]}`, 'bad');
      c.after(1.1, () => c.msg(side, ''));
    }
  }
}

/* ===================== 搶答共用：先答啱 3 題者勝，答錯鎖一陣 ===================== */
class QuizRace {
  constructor(ctx) {
    this.c = ctx;
    this.pts = [0, 0];
    this.qn = 0;
    this.goal = 3;
    this.state = 'idle';
  }
  start() { this.nextQ(); }
  tally(side) { return `<span class="qz-tally">你 <b>${this.pts[side]}</b> : <b>${this.pts[1 - side]}</b> 對手</span>`; }
  nextQ() {
    this.qn += 1;
    this.q = this.make();
    this.state = 'ask';
    this.show();
  }
  /* 子類：make() → { answer, … }；show() 畫題目同選項 */
  press(side, value, ts, el) {
    const c = this.c;
    if (this.state !== 'ask') return;
    if (String(value) === String(this.q.answer)) {
      this.state = 'between';
      this.pts[side] += 1;
      if (el) el.classList.add('right');
      c.sound.hit(this.pts[side] + 2, true);
      c.msg(side, '答啱！', 'good');
      c.msg(1 - side, `${c.names[side]}搶先答啱`);
      if (this.pts[side] >= this.goal) c.after(0.9, () => c.win(side, `${this.label} ${this.pts[side]} : ${this.pts[1 - side]}`));
      else c.after(1.2, () => { c.msg('both', ''); this.nextQ(); });
    } else {
      c.sound.miss();
      c.buzz(40);
      c.lock(side, 1.2);
      if (el) { el.classList.add('wrong'); c.after(0.6, () => el.classList.remove('wrong')); }
      c.msg(side, '錯！停一停', 'bad');
      c.after(1.3, () => { if (this.state === 'ask') c.msg(side, ''); });
    }
  }
  timeout() {
    const [a, b] = this.pts;
    if (a === b) this.c.draw('夠鐘，分數一樣');
    else this.c.win(a > b ? 0 : 1, `夠鐘，${this.label} ${Math.max(a, b)} : ${Math.min(a, b)}`);
  }
  answer() { return this.state === 'ask' ? String(this.q.answer) : null; }
}

/* ===================== 元素咒文（Stroop 色字）===================== */
const INKS = [
  { id: 'red', name: '紅', css: '#e8505f' },
  { id: 'blue', name: '藍', css: '#5f90ff' },
  { id: 'yellow', name: '黃', css: '#f2c84a' },
  { id: 'white', name: '白', css: '#f4efe4' },
];
class Stroop extends QuizRace {
  constructor(ctx) { super(ctx); this.label = '元素咒文'; }
  make() {
    const word = pick(INKS);
    const ink = Math.random() < 0.2 ? word : pick(INKS.filter(i => i.id !== word.id));
    const meaning = this.c.speed !== 'easy' && this.qn > 1 && Math.random() < 0.3;
    return { word, ink, meaning, answer: meaning ? word.id : ink.id };
  }
  show() {
    const { word, ink, meaning } = this.q;
    const ask = meaning ? `<div class="st-ask flip">${icon('mix')}今次揀「字嘅意思」！</div>` : '<div class="st-ask">揀「字嘅顏色」</div>';
    [0, 1].forEach(s => this.c.prompt(s, `${ask}<div class="st-word" style="color:${ink.css}">${word.name}</div>`));
    this.c.pad('both', `<div class="qz-grid">${INKS.map(i => `<button class="duel-btn st-btn" data-duel="${i.id}" style="--c:${i.css}"><i></i>${i.name}</button>`).join('')}</div>`);
    [0, 1].forEach(s => this.c.msg(s, ''));
    [0, 1].forEach(s => { const el = this.c.padEl(s); el.insertAdjacentHTML('beforeend', this.tally(s)); });
  }
}

/* ===================== 金幣速算 ===================== */
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
class MathRace extends QuizRace {
  constructor(ctx) { super(ctx); this.label = '金幣速算'; }
  make() {
    let a, b, op, ans;
    const easy = this.c.speed === 'easy';
    const kind = easy ? pick(['+', '+', '-']) : pick(['+', '-', '×']);
    if (kind === '+') { a = easy ? randInt(2, 9) : randInt(12, 48); b = randInt(2, 9); ans = a + b; }
    else if (kind === '-') { a = easy ? randInt(8, 18) : randInt(21, 60); b = randInt(2, 9); ans = a - b; }
    else { a = randInt(3, 12); b = pick([2, 3]); ans = a * b; }
    op = kind === '×' ? '×' : kind === '+' ? '＋' : '－';
    const opts = new Set([ans]);
    const deltas = shuffle([1, -1, 2, -2, 10, -10, 3]);
    for (const d of deltas) { if (opts.size >= 4) break; if (ans + d > 0) opts.add(ans + d); }
    return { a, b, op, answer: ans, choices: shuffle([...opts]) };
  }
  show() {
    const { a, b, op, choices } = this.q;
    this.c.prompt('both', `<div class="ma-q"><b>${a}</b><span>${op}</span><b>${b}</b><span>＝</span><b class="qm">？</b><small>${icon('coin')}金幣</small></div>`);
    this.c.pad('both', `<div class="qz-grid">${choices.map(v => `<button class="duel-btn ma-btn" data-duel="${v}">${v}</button>`).join('')}</div>`);
    [0, 1].forEach(s => this.c.padEl(s).insertAdjacentHTML('beforeend', this.tally(s)));
  }
}

/* ===================== 寶物搶認：數寶石／邊件唔見咗 ===================== */
const ITEM_POOL = ['sword', 'shield', 'potion', 'crown', 'key', 'scroll', 'ring', 'helmet', 'boot', 'apple', 'bread', 'candle', 'fish', 'cheese'];
const GEM_COLORS = [0x4aa8e8, 0xd04a6a, 0x3fbf86, 0xe8b84a, 0x9a6ad8];
const itemImg = kind => snapshot(`item-${kind}`, () => createItem(kind), 112);
// 寶石縮圖：單純一粒切割寶石（唔用場景入面帶光暈、影嘅寶石，截圖先會夠大）
const gemImg = i => snapshot(`gem-icon-${i % GEM_COLORS.length}`, () => {
  const color = GEM_COLORS[i % GEM_COLORS.length];
  const geo = new THREE.OctahedronGeometry(0.3);
  geo.scale(1, 1.3, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.2, flatShading: true }));
  m.rotation.set(0.25, 0.6, 0.15);
  return m;
}, 112, 1.45);
class Treasure extends QuizRace {
  constructor(ctx) {
    super(ctx);
    this.label = '寶物搶認';
    this.kindNext = Math.random() < 0.5 ? 'count' : 'missing';
  }
  make() {
    const easy = this.c.speed === 'easy';
    const type = this.kindNext;
    this.kindNext = type === 'count' ? 'missing' : 'count';
    if (type === 'count') {
      const n = easy ? randInt(3, 6) : randInt(4, 9);
      const opts = new Set([n]);
      for (const d of shuffle([1, -1, 2, -2])) { if (opts.size >= 4) break; if (n + d >= 2) opts.add(n + d); }
      return { type, n, answer: n, choices: [...opts].sort((x, y) => x - y), showFor: easy ? 2.5 : 1.5 };
    }
    const shown = shuffle(ITEM_POOL.slice()).slice(0, easy ? 4 : 5);
    const missing = pick(shown);
    const left = shuffle(shown.filter(k => k !== missing));
    const other = pick(ITEM_POOL.filter(k => !shown.includes(k)));
    const choices = shuffle([missing, ...shuffle(left.slice()).slice(0, 2), other]);
    return { type, shown, left, missing, answer: missing, choices, showFor: easy ? 3 : 2 };
  }
  nextQ() {
    this.qn += 1;
    this.q = this.make();
    this.state = 'show';
    const q = this.q;
    const c = this.c;
    // 先展示，再收埋
    if (q.type === 'count') {
      const gems = Array.from({ length: q.n }, (_, i) => `<img class="tr-gem" src="${gemImg(i)}" alt="" style="--r:${randInt(-25, 25)}deg;--y:${randInt(-10, 10)}px">`).join('');
      c.prompt('both', '<div class="tr-ask">記住有幾多粒寶石！</div>');
      c.pad('both', `<div class="tr-pile">${gems}</div>`);
    } else {
      c.prompt('both', '<div class="tr-ask">記住呢幾件寶物！</div>');
      c.pad('both', `<div class="tr-row">${q.shown.map(k => `<img class="tr-item" src="${itemImg(k)}" alt="">`).join('')}</div>`);
    }
    c.msg('both', '');
    c.after(q.showFor, () => { this.state = 'ask'; this.show(); });
  }
  show() {
    const q = this.q;
    const c = this.c;
    if (q.type === 'count') {
      c.prompt('both', '<div class="tr-ask">頭先有幾多粒寶石？</div>');
      c.pad('both', `<div class="qz-grid">${q.choices.map(v => `<button class="duel-btn ma-btn" data-duel="${v}">${v}</button>`).join('')}</div>`);
    } else {
      c.prompt('both', `<div class="tr-ask">邊件唔見咗？</div><div class="tr-left">${q.left.map(k => `<img src="${itemImg(k)}" alt="">`).join('')}</div>`);
      c.pad('both', `<div class="qz-grid">${q.choices.map(k => `<button class="duel-btn tr-btn" data-duel="${k}"><img src="${itemImg(k)}" alt=""></button>`).join('')}</div>`);
    }
    [0, 1].forEach(s => this.c.padEl(s).insertAdjacentHTML('beforeend', this.tally(s)));
  }
}

export const ROUNDS = {
  quickdraw: {
    name: '騎士拔劍',
    icon: 'bolt',
    rule: speed => `見到「斬！」先好撳「拔劍」，快者勝；撳早當犯規。${speed === 'easy' ? '' : '小心似「斬」嘅假字！'}三次拔劍，先贏兩次。`,
    limit: 40,
    create: ctx => new QuickDraw(ctx),
  },
  stroop: {
    name: '元素咒文',
    icon: 'drop',
    rule: speed => `中間個字用另一隻顏色寫，要揀「字嘅顏色」，唔係字嘅意思。${speed === 'easy' ? '' : '間中會轉做揀「字嘅意思」，睇清楚題目！'}先答啱 3 題者勝。`,
    limit: 60,
    create: ctx => new Stroop(ctx),
  },
  math: {
    name: '金幣速算',
    icon: 'coins',
    rule: speed => `計中間條數，揀啱答案。${speed === 'easy' ? '20 以內加減。' : '有兩位數同乘數。'}先答啱 3 題者勝；揀錯停一停。`,
    limit: 60,
    create: ctx => new MathRace(ctx),
  },
  treasure: {
    name: '寶物搶認',
    icon: 'gem',
    rule: () => '寶物出現一陣就收埋：有時數有幾多粒寶石，有時搵出唔見咗嗰件。先答啱 3 題者勝。',
    limit: 70,
    create: ctx => new Treasure(ctx),
  },
  schulte: {
    name: '數觸之戰',
    icon: 'sword',
    rule: speed => `由 1 開始順序點到 ${speed === 'easy' ? 9 : 16}，先點完者勝；點錯要停一秒。`,
    limit: 60,
    create: ctx => new SchulteDuel(ctx),
  },
};

/* 混合賽輪替次序（未做好嘅會自動略過） */
export const MIX_ORDER = ['quickdraw', 'stroop', 'math', 'treasure', 'schulte'];
export const DUEL_GAMES = ['mix', ...Object.keys(ROUNDS)];
