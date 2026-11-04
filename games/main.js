/* 腦力勇者 — 總控制：畫面、計時、結算、輸入 */
import { Engine, webglAvailable, rectOf } from './engine.js';
import {
  save, persist, expToNext, titleFor, addExp, GAMES, keyOf, isUnlocked, sizeLabel, starsTotal, fmtTime, fmtTimeHtml,
} from './store.js';
import { Sound, buzz } from './sound.js';
import { MenuView } from './menu.js';
import { SchulteView } from './schulte.js';
import { MazeView } from './maze.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const restartAnim = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function bootError(html) {
  $('#bootMsg').innerHTML = html;
  $('#boot').classList.add('error');
}

if (!webglAvailable()) {
  bootError('你部機暫時未能顯示 3D 畫面。<br>請更新 iOS／iPadOS，或者用較新嘅瀏覽器再試。');
} else {
  start().catch(err => {
    console.error(err);
    bootError('載入時出咗問題，請重新整理頁面再試。');
  });
}

async function start() {
  const fontsReady = Promise.race([
    document.fonts ? Promise.all([
      document.fonts.load('900 100px Montserrat'),
      document.fonts.load('900 40px "Noto Sans TC"'),
    ]) : Promise.resolve(),
    sleep(2500),
  ]).catch(() => {});

  const canvas = $('#gl');
  const engine = new Engine(canvas);

  /* =========================================================
     計時器（切走 App 自動暫停）
     ========================================================= */
  const Timer = {
    el: null, t0: 0, acc: 0, running: false, raf: 0, shown: '',
    reset(el) {
      cancelAnimationFrame(this.raf);
      this.el = el; this.acc = 0; this.running = false; this.shown = '';
      this.render();
    },
    start() { if (!this.el) return; this.t0 = performance.now(); this.running = true; this.loop(); },
    elapsedMs() { return this.acc + (this.running ? performance.now() - this.t0 : 0); },
    loop() {
      cancelAnimationFrame(this.raf);
      const tick = () => { if (!this.running) return; this.render(); this.raf = requestAnimationFrame(tick); };
      tick();
    },
    render() {
      if (!this.el) return;
      const html = fmtTimeHtml(this.elapsedMs() / 1000);
      if (html !== this.shown) { this.el.innerHTML = html; this.shown = html; }
    },
    pause() {
      if (!this.running) return;
      this.acc += performance.now() - this.t0;
      this.running = false;
      cancelAnimationFrame(this.raf);
    },
    resume() { if (this.running || !this.el) return; this.t0 = performance.now(); this.running = true; this.loop(); },
    stop() { this.pause(); this.render(); const s = this.acc / 1000; this.el = null; return s; },
  };

  /* =========================================================
     UI 小工具
     ========================================================= */
  const toastEls = { schulte: $('#toastS'), maze: $('#toastM') };
  function toast(text) {
    const el = toastEls[current];
    if (!el) return;
    el.textContent = text ? `▶ ${text}` : '';
    if (text) restartAnim(el, 'flash');
  }
  function popup(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('#popups').appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
  const counter = $('#counter');
  function setCounter(html) { counter.innerHTML = html; restartAnim(counter, 'pop'); }

  /* =========================================================
     3D 畫面
     ========================================================= */
  let lastTime = 0;
  let session = null;
  let current = 'menu';

  const schulte = new SchulteView({
    onProgress(next, total) {
      const nn = $('#nextNum');
      nn.textContent = next > total ? '✓' : String(next);
      restartAnim(nn, 'pop');
      const ratio = Math.max(0, (total - next + 1) / total);
      const hp = $('#hpFill');
      hp.style.width = `${ratio * 100}%`;
      hp.classList.toggle('mid', ratio <= 0.5 && ratio > 0.2);
      hp.classList.toggle('low', ratio <= 0.2);
    },
    onMiss(m) { setCounter(`失誤 <b>${m}</b>`); },
    onMessage: toast,
    onCombo(c) {
      const r = rectOf($('#enemyStage'));
      popup(`${c} 連擊！`, r.cx + r.width * 0.28, r.top + r.height * 0.25, 'combo');
    },
    onDamage(dmg, crit, x, y) {
      // 少少隨機位移，連續攻擊時數字唔會疊埋一齊
      popup(`-${dmg}`, x + (Math.random() - 0.5) * 110, y + (Math.random() - 0.5) * 36, crit ? 'crit' : '');
    },
    onComplete() { lastTime = Timer.stop(); },
    onFinish(stats) {
      const lv = session.level;
      const stars = lastTime <= lv.stars[0] ? 3 : lastTime <= lv.stars[1] ? 2 : 1;
      showResult({
        game: 'schulte', level: lv, time: lastTime, stars,
        lines: [['失誤', stats.misses === 0 ? '0 ✨' : stats.misses], ['最高連擊', stats.maxCombo], ['會心一擊', stats.crits]],
        bonus: stats.misses === 0 ? 10 : 0,
        kicker: 'VICTORY',
        title: stars === 3 ? '完美勝利！' : stars === 2 ? '漂亮的勝利！' : '戰鬥勝利！',
      });
    },
  });

  const maze = new MazeView({
    onGem(c, total) {
      setCounter(`💎 <b>${c}/${total}</b>`);
      toast(c === total ? '寶石全部到手！向寶箱進發！' : `得到了寶石！（${c}/${total}）`);
    },
    onMessage: toast,
    onComplete() { lastTime = Timer.stop(); },
    onFinish(stats) {
      const lv = session.level;
      const fogMul = lv.fog ? 1.35 : 1;
      const par3 = (stats.shortest * 0.6 + 5) * fogMul;
      const par2 = (stats.shortest * 1.25 + 12) * fogMul;
      const stars = lastTime <= par3 ? 3 : lastTime <= par2 ? 2 : 1;
      showResult({
        game: 'maze', level: lv, time: lastTime, stars,
        lines: [['步數', stats.steps], ['最短路線', stats.shortest], ['寶石', `${stats.collected}/${stats.gemTotal}`]],
        bonus: stats.collected * 5 + (stats.collected === stats.gemTotal && stats.gemTotal ? 10 : 0),
        kicker: 'DUNGEON CLEAR',
        title: stars === 3 ? '完美攻略！' : stars === 2 ? '迷宮攻略成功！' : '成功脫出迷宮！',
      });
    },
  });

  const menuView = new MenuView();
  const views = { menu: menuView, schulte, maze };

  function measure() {
    if (current === 'menu') menuView.setRect(rectOf($('#menuStage')));
    else if (current === 'schulte') schulte.setRects(rectOf($('#schultePlay')), rectOf($('#enemyStage')));
    else maze.setRect(rectOf($('#mazePlay')));
  }

  function showScreen(name) {
    current = name;
    $('#menu').classList.toggle('active', name === 'menu');
    const game = $('#game');
    game.classList.toggle('active', name !== 'menu');
    game.classList.toggle('schulte', name === 'schulte');
    game.classList.toggle('maze', name === 'maze');
    engine.setView(views[name]);
    measure();
    if (name === 'menu') renderMenu();
  }

  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { engine.resize(); measure(); });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  /* =========================================================
     Overlays / 導航
     ========================================================= */
  const overlays = {
    diff: $('#diffOverlay'), records: $('#recordsOverlay'), result: $('#resultOverlay'), retreat: $('#retreatOverlay'),
  };
  const countdownEl = $('#countdown');
  function openOverlay(el) {
    el.hidden = false;
    const f = el.querySelector('.cta, .level-card:not(:disabled)');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
  }
  const closeOverlay = el => { el.hidden = true; };
  const closeAllOverlays = () => Object.values(overlays).forEach(closeOverlay);
  const overlayOpen = () => Object.values(overlays).some(el => !el.hidden) || !countdownEl.hidden;

  let inGameHistory = false;
  let autoPaused = false;
  let retreatPaused = false;

  /* 開場倒數 */
  const Countdown = (() => {
    let timer = 0;
    const intro = $('#cdIntro');
    const num = $('#cdNum');
    return {
      run(text, done) {
        clearTimeout(timer);
        intro.textContent = text;
        num.textContent = '';
        num.className = 'cd-num';
        countdownEl.hidden = false;
        const steps = ['3', '2', '1', '開始！'];
        let i = 0;
        const next = () => {
          if (i < steps.length) {
            num.textContent = steps[i];
            num.classList.toggle('go', i === 3);
            restartAnim(num, 'tick');
            if (i === 3) Sound.go(); else Sound.tick();
            i += 1;
            timer = setTimeout(next, i === 4 ? 520 : 680);
          } else {
            countdownEl.hidden = true;
            done();
          }
        };
        timer = setTimeout(next, 900);
      },
      cancel() { clearTimeout(timer); countdownEl.hidden = true; },
    };
  })();

  function abortGame() {
    Countdown.cancel();
    schulte.abort();
    maze.abort();
    stopRepeat();
    Timer.reset(null);
    autoPaused = false;
    retreatPaused = false;
  }

  function goMenu() {
    abortGame();
    closeAllOverlays();
    showScreen('menu');
    if (inGameHistory) { inGameHistory = false; history.back(); }
  }

  // iPhone 邊緣向右掃（返回）→ 返回據點，而唔係離開網頁
  window.addEventListener('popstate', () => {
    if (!inGameHistory) return;
    inGameHistory = false;
    abortGame();
    closeAllOverlays();
    showScreen('menu');
  });

  async function startGame(game, level) {
    closeAllOverlays();
    abortGame();
    session = { game, level };
    if (!inGameHistory) {
      try { history.pushState({ brainHero: 'game' }, ''); inGameHistory = true; } catch (_) { /* file:// */ }
    }
    if (game === 'schulte') await fontsReady;
    showScreen(game);
    $$('.toast').forEach(t => { t.textContent = ''; });
    Timer.reset($('#timer'));

    if (game === 'schulte') {
      $('#enemyName').textContent = level.enemyName;
      $('#nextNum').textContent = '1';
      const hp = $('#hpFill');
      hp.style.width = '100%';
      hp.className = '';
      counter.innerHTML = '失誤 <b>0</b>';
      schulte.setup(level);
      measure();
      Countdown.run(`${level.enemyName}出現了！`, () => {
        schulte.begin();
        Timer.start();
        toast('由「1」開始，順序點擊石磚！');
      });
    } else {
      maze.setup(level);
      measure();
      counter.innerHTML = `💎 <b>0/${maze.gemTotal}</b>`;
      toast(level.fog ? '四周一片黑暗……寶箱在遠處發光！' : '找出通往寶箱的路！');
      Countdown.run(level.fog ? '🔥 點起火把，進入黑暗迷宮！' : '🏰 進入地下迷宮！', () => {
        maze.begin();
        Timer.start();
        toast('用方向掣、滑動或點擊地面前進');
      });
    }
  }

  /* =========================================================
     戰果結算
     ========================================================= */
  function showResult({ game, level, time, stars, lines, bonus, kicker, title }) {
    const key = keyOf(game, level);
    const prevBest = save.best[key];
    const firstClear = prevBest == null;
    const t1 = Math.round(time * 10) / 10;
    const isRecord = firstClear || t1 < prevBest;
    const unlocksBoss = firstClear && level.id === 'hard';
    if (isRecord) save.best[key] = t1;
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
    save.plays += 1;
    // 過關基本分 + 每粒星 10 + 額外獎勵
    const expTotal = level.exp + stars * 10 + bonus;
    const lvl = addExp(expTotal);
    persist();
    updateStatus();

    $('#resKicker').textContent = kicker;
    $('#resTitle').textContent = title;
    $('#resStars').innerHTML = [0, 1, 2].map(i => `<span class="star${i < stars ? ' on' : ''}">★</span>`).join('');
    $('#resStars').setAttribute('aria-label', `評價 ${stars} 星（滿分 3 星）`);
    $('#resTime').innerHTML = fmtTimeHtml(time);

    const badge = $('#resBadge');
    badge.hidden = !isRecord;
    badge.textContent = firstClear ? '🎖 首次攻略！' : '🏆 新紀錄！';
    const compare = $('#resCompare');
    compare.hidden = firstClear;
    compare.textContent = firstClear ? '' : isRecord
      ? `比之前最佳快 ${(prevBest - t1).toFixed(1)} 秒`
      : `最佳紀錄 ${fmtTime(prevBest)}`;

    $('#resStats').innerHTML = lines.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('');
    $('#resExp').innerHTML = `獲得經驗值 <b>+${expTotal} EXP</b>`;
    $('#resUnlock').hidden = !unlocksBoss;

    const lvBox = $('#resLevelUp');
    lvBox.hidden = !lvl.leveled;
    if (lvl.leveled) {
      const oldT = titleFor(lvl.from);
      const newT = titleFor(lvl.to);
      $('#resLevelDetail').textContent = newT !== oldT
        ? `Lv ${lvl.from} → ${lvl.to}．新稱號「${newT}」`
        : `Lv ${lvl.from} → Lv ${lvl.to}`;
      setTimeout(() => { Sound.levelUp(); buzz([30, 30, 30, 30, 60]); }, 1400);
    }
    Sound.victory();
    openOverlay(overlays.result);
  }

  /* =========================================================
     難度選擇 / 紀錄
     ========================================================= */
  let diffGame = null;
  function openDiff(game) {
    diffGame = game;
    const g = GAMES[game];
    $('#diffTitle').textContent = `${g.icon} ${g.title}`;
    $('#diffSub').textContent = g.hint;
    $('#levelGrid').innerHTML = g.levels.map(l => {
      const unlocked = isUnlocked(game, l);
      const key = keyOf(game, l);
      const best = save.best[key];
      const desc = !unlocked ? '🔒 攻略高級後解鎖' : game === 'schulte' ? l.enemyName : l.desc;
      const bestHtml = best != null
        ? `<span>${fmtTime(best)}</span><span class="stars">${starText(save.stars[key] || 0)}</span>`
        : `<span class="none">${unlocked ? '未挑戰' : ''}</span>`;
      return `<button class="level-card" data-level="${l.id}" data-tier="${l.id}" ${unlocked ? '' : 'disabled'}>
          <span class="lc-head"><span class="lc-name">${l.name}</span><span class="lc-size">${sizeLabel(l)}</span></span>
          <span class="lc-desc">${desc}</span>
          <span class="lc-best">${bestHtml}</span>
        </button>`;
    }).join('');
    openOverlay(overlays.diff);
  }
  function closeDiff() {
    closeOverlay(overlays.diff);
    if (current !== 'menu') goMenu();
  }
  $('#levelGrid').addEventListener('click', e => {
    const btn = e.target.closest('.level-card');
    if (!btn || btn.disabled) return;
    startGame(diffGame, GAMES[diffGame].levels.find(l => l.id === btn.dataset.level));
  });

  function openRecords() {
    const need = expToNext(save.level);
    $('#rLv').textContent = save.level;
    $('#rTitle').textContent = titleFor(save.level);
    $('#rExp').style.width = `${Math.min(100, (save.exp / need) * 100)}%`;
    $('#rExpText').textContent = `經驗值 ${save.exp} / ${need}．出戰 ${save.plays} 次`;
    const rows = [];
    for (const [game, g] of Object.entries(GAMES)) {
      rows.push(`<div class="rec-group">${g.icon} ${g.title}</div>`);
      for (const l of g.levels) {
        const key = keyOf(game, l);
        const best = save.best[key];
        const val = best != null
          ? `${fmtTime(best)}<span class="stars">${starText(save.stars[key] || 0)}</span>`
          : `<span class="none">${isUnlocked(game, l) ? '未挑戰' : '🔒 未解鎖'}</span>`;
        rows.push(`<div class="rec-row"><span>${l.name}　${sizeLabel(l)}</span><span>${val}</span></div>`);
      }
    }
    $('#recList').innerHTML = rows.join('');
    openOverlay(overlays.records);
  }

  /* =========================================================
     撤退 / 暫停
     ========================================================= */
  function requestRetreat() {
    if (!countdownEl.hidden) { goMenu(); return; }
    const playing = (current === 'schulte' && schulte.active) || (current === 'maze' && maze.active);
    if (!playing) { goMenu(); return; }
    retreatPaused = Timer.running;
    Timer.pause();
    stopRepeat();
    openOverlay(overlays.retreat);
  }
  function resumeFromRetreat() {
    closeOverlay(overlays.retreat);
    if (retreatPaused) Timer.resume();
    retreatPaused = false;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (Timer.running) { Timer.pause(); autoPaused = true; }
      stopRepeat();
    } else if (autoPaused) {
      autoPaused = false;
      if (overlays.retreat.hidden) Timer.resume(); else retreatPaused = true;
    }
  });

  /* =========================================================
     輸入：畫布觸控
     ========================================================= */
  canvas.addEventListener('pointerdown', e => {
    if (overlayOpen() || e.button > 0) return;
    if (current === 'schulte') {
      e.preventDefault();
      schulte.pointerDown(e.clientX, e.clientY);
    } else if (current === 'maze') {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 舊瀏覽器 */ }
      maze.pointerDown(e.clientX, e.clientY, e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', e => { if (current === 'maze') maze.pointerMove(e.clientX, e.clientY, e.pointerId); });
  canvas.addEventListener('pointerup', e => { if (current === 'maze') maze.pointerUp(e.clientX, e.clientY, e.pointerId, false); });
  canvas.addEventListener('pointercancel', e => { if (current === 'maze') maze.pointerUp(e.clientX, e.clientY, e.pointerId, true); });

  /* 方向掣：長按連續行 */
  let repeatTimer = 0;
  let repeatBtn = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatTimer);
    if (repeatBtn) repeatBtn.classList.remove('pressed');
    repeatBtn = null;
  }
  $$('.dpad-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      stopRepeat();
      repeatBtn = btn;
      btn.classList.add('pressed');
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 舊瀏覽器 */ }
      const dir = btn.dataset.dir;
      maze.move(dir);
      repeatTimer = setTimeout(() => {
        repeatTimer = setInterval(() => { if (!maze.move(dir)) stopRepeat(); }, 165);
      }, 300);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, stopRepeat));
    btn.addEventListener('click', e => { if (e.detail === 0) maze.move(btn.dataset.dir); });
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  /* 鍵盤（電腦／iPad 外接鍵盤） */
  let lastKey = 0;
  const KEY_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!overlays.retreat.hidden) { resumeFromRetreat(); return; }
      if (!overlays.diff.hidden) { closeDiff(); return; }
      if (!overlays.records.hidden) { closeOverlay(overlays.records); return; }
      if (current !== 'menu' && !overlayOpen()) { requestRetreat(); return; }
    }
    if (current !== 'maze' || overlayOpen()) return;
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastKey < 90) return;
    lastKey = now;
    maze.move(dir);
  });

  // iOS 要喺手勢入面先可以發聲
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => Sound.unlock(), { capture: true, passive: true }));
  // 遊戲唔需要雙指縮放，避免誤觸
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));

  /* =========================================================
     據點 / 狀態
     ========================================================= */
  function updateStatus() {
    const pct = `${Math.min(100, (save.exp / expToNext(save.level)) * 100)}%`;
    $('#mLv').textContent = save.level;
    $('#mTitle').textContent = titleFor(save.level);
    $('#mExp').style.width = pct;
  }
  function renderMenu() {
    updateStatus();
    $('#qsSchulte').textContent = `★ ${starsTotal('schulte')}/12`;
    $('#qsMaze').textContent = `★ ${starsTotal('maze')}/12`;
  }
  function renderMute() {
    $$('.mute-toggle').forEach(b => {
      b.textContent = save.muted ? '🔇' : '🔊';
      b.setAttribute('aria-pressed', String(save.muted));
      b.setAttribute('aria-label', save.muted ? '開啟音效' : '關閉音效');
    });
  }

  document.addEventListener('click', e => {
    const quest = e.target.closest('[data-quest]');
    if (quest) { openDiff(quest.dataset.quest); return; }
    if (e.target.closest('.mute-toggle')) {
      save.muted = !save.muted;
      Sound.setMuted(save.muted);
      persist();
      renderMute();
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'retreat':       requestRetreat(); break;
      case 'retreat-yes':   goMenu(); break;
      case 'retreat-no':    resumeFromRetreat(); break;
      case 'close-diff':    closeDiff(); break;
      case 'records':       openRecords(); break;
      case 'close-records': closeOverlay(overlays.records); break;
      case 'again':         if (session) startGame(session.game, session.level); break;
      case 'change-diff':   closeOverlay(overlays.result); if (session) openDiff(session.game); break;
      case 'home':          goMenu(); break;
      default: break;
    }
  });
  overlays.diff.addEventListener('click', e => { if (e.target === overlays.diff) closeDiff(); });
  overlays.records.addEventListener('click', e => { if (e.target === overlays.records) closeOverlay(overlays.records); });

  // 自動測試用（網址加 ?debug 先會開）
  if (new URLSearchParams(location.search).has('debug')) window.__bh = { schulte, maze, engine };

  /* ---------- 啟動 ---------- */
  renderMute();
  showScreen('menu');
  await Promise.race([fontsReady, sleep(1200)]);
  measure();
  document.body.classList.remove('booting');
}
