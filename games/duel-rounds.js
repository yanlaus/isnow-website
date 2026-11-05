/* 對決擂台嘅每款回合。共用介面：
   { name, icon, rule(speed), limit?, create(ctx) → { start(), press(side, value, ts, el), update?(dt), timeout?(), destroy?() } }
   ctx：prompt/pad/msg(side|'both', …)、padEl(side)、after(sec, fn)、now()、lock(side, sec)、locked(side)、
        win(side, note)、draw(note)、names、speed（'easy'｜'normal'）、sound、buzz */
import { icon } from './icons.js';

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

export const ROUNDS = {
  quickdraw: {
    name: '騎士拔劍',
    icon: 'bolt',
    rule: speed => `見到「斬！」先好撳「拔劍」，快者勝；撳早當犯規。${speed === 'easy' ? '' : '小心似「斬」嘅假字！'}三次拔劍，先贏兩次。`,
    limit: 40,
    create: ctx => new QuickDraw(ctx),
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
