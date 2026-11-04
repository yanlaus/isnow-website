/* 道具店算賬：記住客人訂單 → 揀貨 → 計總數 → 找續（工作記憶 + 計算） */
import { THREE, Scheduler, centerOnRect, fitCameraDistance, shuffle, randInt, pick } from './engine.js';
import { gradientTexture, Sparks, blobShadow } from './fx.js';
import { createVillager, createTorch } from './models.js';
import { createItem } from './items.js';
import { Sound, buzz } from './sound.js';

const CUSTOMERS = 5;
const ITEMS = [
  { id: 'apple',  name: '蘋果', icon: '🍎', price: 1 },
  { id: 'candle', name: '蠟燭', icon: '🕯️', price: 2 },
  { id: 'bread',  name: '麵包', icon: '🍞', price: 3 },
  { id: 'herb',   name: '藥草', icon: '🌿', price: 4 },
  { id: 'fish',   name: '鮮魚', icon: '🐟', price: 5 },
  { id: 'potion', name: '藥水', icon: '🧪', price: 6 },
  { id: 'cheese', name: '芝士', icon: '🧀', price: 7 },
  { id: 'key',    name: '鎖匙', icon: '🔑', price: 8 },
];
const NOTES = [5, 10, 20, 50, 100];
const NAMES = ['村長', '旅人', '鐵匠', '漁夫', '農婦', '吟遊詩人', '騎士', '魔法師'];
const SHIRTS = [0x3f7fd0, 0x3fa35a, 0xd0703f, 0xc04f7a, 0x7a5ac0, 0x2f9a9a];
const HATS = [0x8a5a2b, 0x2f5a3a, 0x7a2a2a, 0x3a3a6a, 0x5a4a3a];

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#6b3f1f';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#f5c842';
  g.lineWidth = 10;
  g.strokeRect(10, 10, 492, 140);
  g.fillStyle = '#ffe08a';
  g.font = '900 96px "Noto Sans TC", "PingFang HK", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('勇者道具店', 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 四個選項：正確答案 + 三個相近嘅錯誤答案 */
function choicesFor(answer, hints) {
  const cand = new Set();
  [1, 2, 3, 5, 10, ...hints].forEach(d => { cand.add(answer + d); cand.add(answer - d); });
  const wrong = shuffle([...cand].filter(v => v > 0 && v !== answer)).slice(0, 3);
  return shuffle([answer, ...wrong]);
}

export class ShopView {
  constructor(hooks) {
    this.hooks = hooks;
    this.sched = new Scheduler();
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#4a2c18', '#2e1a0e', '#160c06']);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3a2410, 1.6));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
    key.position.set(-3, 6, 8);
    this.scene.add(key);

    const wood = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 4.4, 0.2), wood(0x7a4a28));
    wall.position.set(0, 1.9, -1.6);
    this.scene.add(wall);
    // 貨架 + 貨品
    const shelfMat = wood(0x5a3418);
    [0.9, 1.9, 2.9].forEach((y, row) => {
      for (const side of [-1, 1]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.5), shelfMat);
        shelf.position.set(side * 2.7, y, -1.3);
        this.scene.add(shelf);
        const kinds = [['potion', 'apple', 'bread'], ['apple', 'potion', 'potion'], ['bread', 'potion', 'apple']][row];
        kinds.forEach((k, j) => {
          const it = createItem(k);
          it.scale.setScalar(0.85);
          it.position.set(side * 2.7 + (j - 1) * 0.75, y + 0.22, -1.25);
          this.scene.add(it);
        });
      }
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false }));
    sign.position.set(0, 3.45, -1.45);
    this.scene.add(sign);
    this.torches = [-1, 1].map(s => {
      const t = createTorch({ light: false, height: 1.2 });
      t.group.position.set(s * 4.1, 0.4, -1.2);
      this.scene.add(t.group);
      return t;
    });
    // 櫃枱
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.0, 1.0), wood(0x8a5430));
    counter.position.set(0, 0.5, 1.1);
    this.scene.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.12, 1.2), wood(0xb27a46));
    top.position.set(0, 1.06, 1.1);
    this.scene.add(top);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshLambertMaterial({ color: 0x3a2414 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xf5c842, metalness: 0.75, roughness: 0.3, emissive: 0x3a2800 });
    this.coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14);
    this.coins = [];
    this.customer = null;
    this.sparks = new Sparks(this.scene, { cap: 300, size: 0.3 });
    this.v = new THREE.Vector3();
    this.W = 1;
    this.H = 1;
    this.active = false;
  }

  hud() {
    return {
      mode: 'panel',
      counter: `客人 <b>1/${CUSTOMERS}</b>`,
      intro: '💰 勇者道具店開門營業！',
      prep: '記住客人要買咩，然後揀貨同計數',
    };
  }

  setup(level) {
    this.sched.clear();
    this.level = level;
    this.items = ITEMS.slice(0, level.items);
    this.served = 0;
    this.misses = 0;
    this.repeats = 0;
    this.phase = 'idle';
    this.order = null;
    this.basket = {};
    this.active = false;
    this.clearCoins();
    if (this.customer) this.scene.remove(this.customer.group);
    this.customer = null;
    this.hooks.panel().innerHTML = '<p class="panel-wait">準備開門……</p>';
    this.layout();
  }

  begin() {
    this.active = true;
    this.nextCustomer();
  }

  abort() {
    this.active = false;
    this.sched.clear();
  }

  /* ---------- 客人 ---------- */
  nextCustomer() {
    if (!this.active) return;
    if (this.served >= CUSTOMERS) { this.finish(); return; }
    this.clearCoins();
    const lv = this.level;
    const kinds = shuffle(this.items.slice()).slice(0, lv.kinds);
    const lines = kinds.map(it => ({ item: it, qty: lv.kinds === 1 ? randInt(2, 4) : randInt(1, 3) }));
    const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
    const pay = NOTES.find(n => n > total) || Math.ceil((total + 1) / 10) * 10;
    this.order = { lines, total, pay, who: pick(NAMES) };
    this.basket = {};
    this.hooks.counter(`客人 <b>${this.served + 1}/${CUSTOMERS}</b>`);

    if (this.customer) this.scene.remove(this.customer.group);
    this.customer = createVillager({ shirt: pick(SHIRTS), hat: pick(HATS) });
    this.customer.group.scale.setScalar(1.25);
    this.customer.group.add(blobShadow(0.9, 0.35));
    this.scene.add(this.customer.group);
    this.walk = { from: 4.2, to: 0, t: 0, dur: 0.9 };
    this.phase = 'arrive';
    this.renderPanel();
    this.sched.after(0.9, () => this.showOrder(this.level.show));
  }

  showOrder(sec) {
    if (!this.active) return;
    this.phase = 'memorize';
    this.renderPanel(sec);
    Sound.pop();
    this.hooks.toast(`${this.order.who}：「唔該，我想買……」`);
    this.memoToken = {};
    const tok = this.memoToken;
    this.sched.after(sec, () => { if (this.memoToken === tok) this.hideOrder(); });
  }

  hideOrder() {
    this.memoToken = null;
    this.phase = 'pick';
    this.renderPanel();
    this.hooks.toast('記住咗未？揀返客人要嘅貨品');
  }

  /* ---------- 面板 ---------- */
  orderText() {
    return this.order.lines.map(l => `${l.item.icon} ${l.item.name} ×${l.qty}`).join('　');
  }

  renderPanel(sec = 0) {
    const el = this.hooks.panel();
    const o = this.order;
    if (!o) return;
    const step = (n, text) => `<p class="step-title"><span class="step-no">${n}</span>${text}</p>`;
    let html = '';
    if (this.phase === 'arrive') {
      html = `<div class="order-card"><p class="order-who">🧑 ${o.who}行緊入嚟……</p></div>`;
    } else if (this.phase === 'memorize' || this.phase === 'pick') {
      const memo = this.phase === 'memorize';
      html += memo
        ? `<div class="order-card show">
            <p class="order-who">🧑 ${o.who}：</p>
            <p class="order-text">「${this.orderText()}」</p>
            <div class="order-bar"><i style="animation-duration:${sec}s"></i></div>
            <button class="ghost-btn order-btn" data-shop="hide">記住咗！</button>
          </div>`
        : `<div class="order-card row">
            <p class="order-who">🧑 ${o.who}等緊你揀貨……</p>
            <button class="ghost-btn order-btn mini" data-shop="repeat">🔁 再問</button>
          </div>`;
      html += step('1', '揀貨：點貨品放入籃');
      html += `<div class="item-grid${memo ? ' locked' : ''}">${this.items.map(it =>
        `<button class="item-card" data-item="${it.id}" ${memo ? 'disabled' : ''}>
           <span class="ic-emoji">${it.icon}</span><span class="ic-name">${it.name}</span><span class="ic-price">${it.price} 金幣</span>
         </button>`).join('')}</div>`;
      const chips = Object.entries(this.basket).filter(([, q]) => q > 0).map(([id, q]) => {
        const it = ITEMS.find(x => x.id === id);
        return `<button class="chip" data-remove="${id}">${it.icon} ${it.name} ×${q} <span aria-hidden="true">✕</span></button>`;
      }).join('');
      html += `<div class="basket"><span class="basket-label">🧺 籃：</span>${chips || '<span class="basket-empty">未有嘢</span>'}</div>`;
      html += `<button class="cta deliver" data-shop="deliver" ${memo ? 'disabled' : ''}>✔ 交貨</button>`;
    } else if (this.phase === 'total') {
      const detail = o.lines.map(l => `${l.item.icon}${l.item.name}（${l.item.price} 金幣）×${l.qty}`).join('　');
      html += `<div class="order-card"><p class="order-text small">${detail}</p></div>`;
      html += step('2', '一共幾多金幣？');
      html += `<div class="choices">${this.choices.map(v => `<button class="choice" data-choice="${v}">${v}<small>金幣</small></button>`).join('')}</div>`;
    } else if (this.phase === 'change') {
      html += `<div class="order-card"><p class="order-text">總數 <b>${o.total}</b> 金幣，${o.who}俾你 <b>${o.pay}</b> 金幣</p></div>`;
      html += step('3', '要找幾多金幣？');
      html += `<div class="choices">${this.choices.map(v => `<button class="choice" data-choice="${v}">${v}<small>金幣</small></button>`).join('')}</div>`;
    } else if (this.phase === 'thanks') {
      html = `<div class="order-card done"><p class="order-who">😊 ${o.who}：「多謝晒！下次再嚟！」</p></div>`;
    }
    el.innerHTML = html;
  }

  panelClick(e) {
    if (!this.active) return;
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.shop === 'hide' && this.phase === 'memorize') { this.hideOrder(); return; }
    if (btn.dataset.shop === 'repeat' && this.phase === 'pick') {
      this.repeats += 1;
      this.showOrder(3);
      return;
    }
    if (btn.dataset.item && this.phase === 'pick') {
      this.basket[btn.dataset.item] = (this.basket[btn.dataset.item] || 0) + 1;
      Sound.flip();
      this.renderPanel();
      return;
    }
    if (btn.dataset.remove && this.phase === 'pick') {
      this.basket[btn.dataset.remove] = Math.max(0, (this.basket[btn.dataset.remove] || 0) - 1);
      Sound.close();
      this.renderPanel();
      return;
    }
    if (btn.dataset.shop === 'deliver' && this.phase === 'pick') { this.deliver(); return; }
    if (btn.dataset.choice && (this.phase === 'total' || this.phase === 'change')) this.choose(Number(btn.dataset.choice), btn);
  }

  deliver() {
    const o = this.order;
    const want = Object.fromEntries(o.lines.map(l => [l.item.id, l.qty]));
    const ids = new Set([...Object.keys(want), ...Object.keys(this.basket).filter(k => this.basket[k] > 0)]);
    const ok = [...ids].every(id => (want[id] || 0) === (this.basket[id] || 0));
    if (!ok) {
      this.misses += 1;
      Sound.miss();
      buzz([25, 40, 25]);
      this.hooks.toast(`${o.who}：「唔係呢啲喎……」可以撳「再問一次」`);
      this.shakeCustomer = 0.4;
      return;
    }
    Sound.coin();
    this.hooks.toast(`${o.who}：「啱晒！一共幾錢呀？」`);
    this.phase = 'total';
    this.choices = choicesFor(o.total, o.lines.map(l => l.item.price));
    this.renderPanel();
  }

  choose(v, btn) {
    const o = this.order;
    const answer = this.phase === 'total' ? o.total : o.pay - o.total;
    if (v !== answer) {
      this.misses += 1;
      btn.disabled = true;
      btn.classList.add('wrong');
      Sound.miss();
      buzz([25, 40, 25]);
      this.hooks.toast('計多次喇，唔使急');
      return;
    }
    btn.classList.add('right');
    Sound.coin();
    buzz(15);
    if (this.phase === 'total' && this.level.change) {
      this.dropCoins(Math.min(8, Math.ceil(o.pay / 5)));
      this.phase = 'change';
      this.choices = choicesFor(o.pay - o.total, [o.pay - o.total + 5]);
      this.hooks.toast(`${o.who}俾你 ${o.pay} 金幣`);
      this.sched.after(0.35, () => this.renderPanel());
      return;
    }
    if (!this.level.change) this.dropCoins(Math.min(8, o.total));
    this.served += 1;
    this.phase = 'thanks';
    this.sched.after(0.3, () => this.renderPanel());
    this.hooks.toast(`交易完成！（${this.served}/${CUSTOMERS}）`);
    this.customer.group.getWorldPosition(this.v);
    this.v.y += 2.2;
    this.sparks.spawn(this.v, { count: 30, color: 0xff8ab0, speed: 2.5, life: 0.8, gravity: -1 });
    this.sched.after(1.0, () => { this.walk = { from: 0, to: -4.4, t: 0, dur: 0.9 }; });
    this.sched.after(1.9, () => this.nextCustomer());
  }

  dropCoins(n) {
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat);
      c.position.set((Math.random() - 0.5) * 1.6, 2.6 + k * 0.15, 1.05 + (Math.random() - 0.5) * 0.4);
      c.userData.vy = 0;
      c.userData.rest = 1.14 + (k % 3) * 0.04;
      this.scene.add(c);
      this.coins.push(c);
    }
  }

  clearCoins() {
    this.coins.forEach(c => this.scene.remove(c));
    this.coins = [];
  }

  finish() {
    this.active = false;
    const time = this.hooks.complete();
    const lv = this.level;
    // 星級：時間 + 失誤／再問嘅小扣分
    const eff = time + this.misses * 4 + this.repeats * 3;
    const stars = eff <= lv.stars[0] ? 3 : eff <= lv.stars[1] ? 2 : 1;
    this.hooks.panel().innerHTML = '<div class="order-card done"><p class="order-who">🏮 今日營業完畢！</p></div>';
    this.hooks.finish({
      time, stars,
      lines: [['招呼客人', `${CUSTOMERS} 位`], ['計錯／揀錯', this.misses], ['再問一次', this.repeats]],
      bonus: this.misses === 0 ? 10 : 0,
      kicker: 'SHOP CLOSED',
      title: stars === 3 ? '精明掌櫃！' : stars === 2 ? '生意興隆！' : '營業完畢！',
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
    const pts = [
      new THREE.Vector3(-3.0, 0, 1.6), new THREE.Vector3(3.0, 0, 1.6),
      new THREE.Vector3(-3.0, 3.9, -1.5), new THREE.Vector3(3.0, 3.9, -1.5),
    ];
    const target = new THREE.Vector3(0, 1.7, 0);
    const dir = new THREE.Vector3(0, 0.22, 1).normalize();
    fitCameraDistance(this.camera, target, dir, pts, r, this.W, this.H, 2);
  }

  update(dt, t) {
    this.sched.update(dt);
    this.sparks.update(dt);
    this.torches.forEach(tc => tc.update(dt, t));
    if (this.customer) {
      const g = this.customer.group;
      let x = g.position.x;
      let bob = Math.sin(t * 2.2) * 0.02;
      if (this.walk) {
        this.walk.t += dt;
        const k = Math.min(1, this.walk.t / this.walk.dur);
        x = this.walk.from + (this.walk.to - this.walk.from) * k;
        bob = Math.abs(Math.sin(k * Math.PI * 4)) * 0.12;
        if (k >= 1) this.walk = null;
      }
      if (this.shakeCustomer > 0) {
        this.shakeCustomer = Math.max(0, this.shakeCustomer - dt);
        g.rotation.z = Math.sin(t * 40) * 0.12 * (this.shakeCustomer / 0.4);
      } else {
        g.rotation.z = 0;
      }
      g.position.set(x, 1.55 + bob, 0.1);
    }
    for (const c of this.coins) {
      if (c.position.y > c.userData.rest) {
        c.userData.vy -= 12 * dt;
        c.position.y = Math.max(c.userData.rest, c.position.y + c.userData.vy * dt);
        c.rotation.x += dt * 8;
        if (c.position.y === c.userData.rest) c.rotation.x = 0;
      }
    }
  }
}
