/* 腦力勇者 — 總控制：畫面、計時、結算、輸入（所有遊戲共用） */
import { Engine, webglAvailable, rectOf, snapshot } from './engine.js';
import {
  save, persist, expToNext, titleFor, addExp, GAMES, CATEGORIES, gameIds, keyOf, isUnlocked, sizeLabel,
  starsTotal, starsMax, isBetter, fmtTime, fmtTimeHtml, fmtBest,
  pushHistory, historyOf, markPlayed, playsInLastDays, streakDays, dayKey, addGold,
} from './store.js';
import { createHero } from './models.js';
import { SLOTS, GEAR, gearState, gearThumb, buyGear, equipGear, heroGear, gearKey, findGear } from './gear.js';
import { today, recordPlay, questText, questGoal, questReward, stampWeeks, setGameList, COMPLETE_BONUS } from './daily.js';
import { sparkline } from './charts.js';
import { makeShareCard } from './share.js';
import { Sound, buzz } from './sound.js';
import { icon } from './icons.js';
import { MenuView } from './menu.js';
import { SchulteView } from './schulte.js';
import { MazeView } from './maze.js';
import { MemoryView } from './memory.js';
import { SimonView } from './simon.js';
import { StrokeView } from './stroke.js';
import { MahjongView } from './mahjong.js';
import { WhackView } from './whack.js';
import { ShopView } from './shop.js';
import { IdiomView } from './idiom.js';
import { DuelView } from './duel.js';
import { ROUNDS, DUEL_GAMES } from './duel-rounds.js';

/* 已經做好嘅遊戲（未登記嘅唔會喺主選單出現） */
const VIEW_CLASSES = {
  schulte: SchulteView,
  maze: MazeView,
  memory: MemoryView,
  simon: SimonView,
  stroke: StrokeView,
  mahjong: MahjongView,
  whack: WhackView,
  shop: ShopView,
  idiom: IdiomView,
};

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
      document.fonts.load('700 100px Cinzel', '0123456789'),
      document.fonts.load('900 40px "Noto Sans TC"'),
      document.fonts.load('900 40px "Noto Serif TC"', '一二三四五六七八九萬東南西北中發'),
    ]) : Promise.resolve(),
    sleep(2500),
  ]).catch(() => {});

  const canvas = $('#gl');
  const engine = new Engine(canvas);
  const gameEl = $('#game');

  /* =========================================================
     計時器：正數或倒數（切走 App 自動暫停）
     ========================================================= */
  const Timer = {
    el: null, t0: 0, acc: 0, running: false, raf: 0, shown: '', limit: 0, onUp: null,
    reset(el) {
      cancelAnimationFrame(this.raf);
      this.el = el; this.acc = 0; this.running = false; this.shown = ''; this.limit = 0; this.onUp = null;
      $('.timer-pill').classList.remove('warn');
      this.render();
    },
    preset(limit) { this.limit = limit; this.render(); },
    start(limit = 0, onUp = null) {
      if (!this.el) return;
      this.limit = limit;
      this.onUp = onUp;
      this.t0 = performance.now();
      this.running = true;
      this.loop();
    },
    elapsedMs() { return this.acc + (this.running ? performance.now() - this.t0 : 0); },
    loop() {
      cancelAnimationFrame(this.raf);
      const tick = () => {
        if (!this.running) return;
        if (this.limit && this.elapsedMs() >= this.limit * 1000) {
          this.pause();
          this.acc = this.limit * 1000;
          this.render();
          const f = this.onUp;
          this.onUp = null;
          if (f) f();
          return;
        }
        this.render();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    },
    render() {
      if (!this.el) return;
      const s = this.elapsedMs() / 1000;
      const shownSec = this.limit ? Math.max(0, this.limit - s) : s;
      const html = fmtTimeHtml(shownSec);
      if (html !== this.shown) { this.el.innerHTML = html; this.shown = html; }
      $('.timer-pill').classList.toggle('warn', !!this.limit && shownSec <= 10 && shownSec > 0);
    },
    penalty(sec) { this.acc += sec * 1000; this.render(); },
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
     共用 UI
     ========================================================= */
  const activeMode = () => $(`#game .mode[data-mode="${gameEl.dataset.mode}"]`);
  function toast(text) {
    const mode = activeMode();
    const el = mode && mode.querySelector('.toast');
    if (!el) return;
    el.textContent = text || '';
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
  const counterEl = $('#counter');
  function setCounter(html) { counterEl.innerHTML = html; restartAnim(counterEl, 'pop'); }

  function renderTools(tools) {
    $$('#game .tool-row').forEach(row => { row.innerHTML = ''; row.hidden = true; });
    const row = activeMode() && activeMode().querySelector('.tool-row');
    if (!row || !tools.length) return;
    row.innerHTML = tools.map(t => `<button class="tool-btn" data-tool="${t.id}">${t.label}</button>`).join('');
    row.hidden = false;
  }

  // 超級機械人大戰式「必殺技」插畫橫幅
  let cutinTimer = 0;
  function cutin(name, attack) {
    const el = $('#cutin');
    $('#cutinName').textContent = name;
    $('#cutinAttack').textContent = attack;
    el.hidden = false;
    restartAnim(el, 'show');
    clearTimeout(cutinTimer);
    cutinTimer = setTimeout(() => { el.hidden = true; }, 1600);
  }

  /* =========================================================
     遊戲畫面（按需要先建立，慳記憶體）
     ========================================================= */
  let session = null;
  let live = false;          // 呢局仲未結算
  let current = 'menu';

  const hooks = {
    toast,
    popup,
    counter: setCounter,
    cutin,
    clockStart(limit = 0) {
      Timer.start(limit, () => { const v = views[current]; if (v && v.timeUp) v.timeUp(); });
    },
    clockPause() { Timer.pause(); },
    clockResume() { Timer.resume(); },
    penalty(sec) { Timer.penalty(sec); },
    complete() { return Timer.stop(); },
    elapsed() { return Timer.elapsedMs() / 1000; },
    finish(result) {
      if (!live || !session) return;
      live = false;
      showResult({ game: session.game, level: session.level, ...result });
    },
    setTool(id, label, disabled = false) {
      const b = $(`#game [data-tool="${id}"]`);
      if (!b) return;
      if (label != null) b.innerHTML = label;
      b.disabled = disabled;
    },
    rect(name) {
      const el = activeMode() && activeMode().querySelector(`[data-region="${name}"]`);
      return el ? rectOf(el) : null;
    },
    panel() { return $('#panelBody'); },
  };

  const menuView = new MenuView();
  const views = { menu: menuView };
  function getView(id) {
    if (!views[id]) views[id] = new VIEW_CLASSES[id](hooks);
    return views[id];
  }

  function measure() {
    if (current === 'menu') {
      menuView.setRects({ stage: rectOf($('#menuStage')) });
      return;
    }
    const mode = activeMode();
    if (!mode) return;
    const regions = {};
    $$('[data-region]', mode).forEach(el => { regions[el.dataset.region] = rectOf(el); });
    views[current].setRects(regions);
  }

  function showScreen(name) {
    current = name;
    $('#menu').classList.toggle('active', name === 'menu');
    gameEl.classList.toggle('active', name !== 'menu');
    gameEl.dataset.game = name;
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
    share: $('#shareOverlay'), armory: $('#armoryOverlay'), stamps: $('#stampsOverlay'), duel: $('#duelOverlay'),
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

  function setPaused(p) {
    const v = views[current];
    if (v && current !== 'menu') v.paused = p;
  }

  function abortGame() {
    Countdown.cancel();
    Object.values(views).forEach(v => { if (v.abort) v.abort(); v.paused = false; });
    stopRepeat();
    Timer.reset(null);
    live = false;
    autoPaused = false;
    retreatPaused = false;
    $('#cutin').hidden = true;
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
    await fontsReady;
    const view = getView(game);
    view.setup(level);
    const hud = view.hud(level);
    session.hud = hud;
    gameEl.dataset.mode = hud.mode;
    showScreen(game);
    renderTools(hud.tools || []);
    $$('#game .toast').forEach(t => { t.textContent = ''; });
    counterEl.innerHTML = hud.counter || '';
    counterEl.hidden = !hud.counter;
    Timer.reset($('#timer'));
    if (hud.timeLimit) Timer.preset(hud.timeLimit);
    live = true;
    measure();
    if (hud.prep) toast(hud.prep);
    Countdown.run(hud.intro, () => {
      view.begin();
      if (!hud.manualClock) hooks.clockStart(hud.timeLimit || 0);
      if (hud.startMsg) toast(hud.startMsg);
    });
  }

  /* =========================================================
     對決擂台（iPad 面對面雙人）
     ========================================================= */
  const duelCfg = Object.assign({ game: 'mix', speed: 'easy', need: 3 }, save.duelCfg || {});
  if (!DUEL_GAMES.includes(duelCfg.game)) duelCfg.game = 'mix';
  function getDuel() {
    if (!views.duel) views.duel = new DuelView({ ...hooks, duelFinish });
    return views.duel;
  }
  function renderDuelSetup() {
    $('#duelGames').innerHTML = DUEL_GAMES.map(id => {
      const r = id === 'mix' ? { name: '混合賽', icon: 'mix', sub: '每煲換一款' } : { ...ROUNDS[id], sub: '' };
      return `<button class="duel-game${duelCfg.game === id ? ' on' : ''}" data-dgame="${id}" aria-pressed="${duelCfg.game === id}">${icon(r.icon)}<b>${r.name}</b>${r.sub ? `<small>${r.sub}</small>` : ''}</button>`;
    }).join('');
    $$('#duelSpeed [data-speed]').forEach(b => b.classList.toggle('on', b.dataset.speed === duelCfg.speed));
    $$('#duelNeed [data-need]').forEach(b => b.classList.toggle('on', Number(b.dataset.need) === duelCfg.need));
    $('#duelPhoneNote').hidden = Math.min(window.innerWidth, window.innerHeight) >= 600;
  }
  function openDuelSetup() {
    renderDuelSetup();
    openOverlay(overlays.duel);
  }
  async function startDuel() {
    closeAllOverlays();
    abortGame();
    save.duelCfg = { ...duelCfg };
    persist();
    session = { game: 'duel', level: null };
    if (!inGameHistory) {
      try { history.pushState({ brainHero: 'game' }, ''); inGameHistory = true; } catch (_) { /* file:// */ }
    }
    await fontsReady;
    const view = getDuel();
    view.setup({ ...duelCfg });
    gameEl.dataset.mode = 'duel';
    showScreen('duel');
    live = true;
    measure();
    view.begin();
  }
  function duelFinish() {
    if (!live) return null;
    live = false;
    save.plays += 1;
    markPlayed();
    const exp = 20;
    const lvl = addExp(exp);
    addGold(10);
    const q = recordPlay({ game: 'duel', category: 'duel', stars: 0, isRecord: false, firstClear: false, duel: true, firstToday: save.days[dayKey()] === 1 });
    persist();
    updateStatus();
    let text = `獲得 +${exp} EXP・金幣 +${10 + q.gold}`;
    if (q.done.length) text += `・完成 ${q.done.length} 個任務`;
    if (lvl.leveled) {
      text += `・升到 Lv ${lvl.to}！`;
      setTimeout(() => { Sound.levelUp(); buzz([30, 30, 30, 30, 60]); }, 1200);
    }
    return { text };
  }
  // 對決按鈕用 pointerdown：即時、兩隻手指同時撳都各自計
  $('.duel-mode').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-duel]');
    if (!b || current !== 'duel' || overlayOpen()) return;
    e.preventDefault();
    const half = b.closest('.duel-half');
    if (half) getDuel().press(Number(half.dataset.side), b.dataset.duel, e.timeStamp, b);
  });

  /* =========================================================
     戰果結算
     ========================================================= */
  function showResult({ game, level, time = 0, score = 0, stars, lines, bonus = 0, kicker, title }) {
    const g = GAMES[game];
    const isScore = g.metric === 'score';
    const key = keyOf(game, level);
    const prevBest = save.best[key];
    const firstClear = prevBest == null;
    const value = isScore ? score : Math.round(time * 10) / 10;
    const isRecord = isBetter(game, value, prevBest);
    const prevHist = historyOf(key);
    const last = prevHist.length ? prevHist[prevHist.length - 1][1] : null;
    pushHistory(key, value);
    markPlayed();
    const unlocksBoss = firstClear && g.levels.some(l => l.unlock === level.id);
    if (isRecord) save.best[key] = value;
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
    save.plays += 1;
    // 過關基本分 + 每粒星 10 + 額外獎勵；金幣：10 + 每粒星 5，破紀錄再加 10
    const expTotal = level.exp + stars * 10 + bonus;
    const lvl = addExp(expTotal);
    const goldBase = 10 + stars * 5 + (isRecord && !firstClear ? 10 : 0);
    addGold(goldBase);
    const quest = recordPlay({ game, category: g.category, stars, isRecord, firstClear, firstToday: save.days[dayKey()] === 1 });
    persist();
    updateStatus();

    $('#resKicker').textContent = kicker;
    $('#resTitle').textContent = title;
    $('#resStars').innerHTML = [0, 1, 2].map(i => `<span class="star${i < stars ? ' on' : ''}">★</span>`).join('');
    $('#resStars').setAttribute('aria-label', `評價 ${stars} 星（滿分 3 星）`);
    $('#resLabel').textContent = isScore ? g.scoreLabel : '用時';
    $('#resTime').innerHTML = isScore ? `${score}<small>${g.unit}</small>` : fmtTimeHtml(time);

    const badge = $('#resBadge');
    badge.hidden = !isRecord;
    badge.innerHTML = firstClear ? `${icon('medal')}${isScore ? '首次挑戰' : '首次攻略'}` : `${icon('trophy')}新紀錄`;
    const compare = $('#resCompare');
    const note = firstClear ? '' : compareText(game, value, last, prevBest, isRecord);
    compare.hidden = !note;
    compare.innerHTML = note;
    const trend = $('#resTrend');
    trend.innerHTML = sparkline(historyOf(key).slice(-10).map(h => h[1]), { invert: !isScore });
    trend.hidden = !trend.innerHTML;

    $('#resStats').innerHTML = lines.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('');
    $('#resExp').innerHTML = `獲得 <b>+${expTotal} EXP</b><span class="res-gold">${icon('coin')}<b>+${goldBase + quest.gold}</b></span>`;
    showQuestNote(quest);
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

    // 戰績圖喺背景先整好，撳「分享」時即刻用（iOS 分享要喺撳掣嗰下觸發）
    const now = new Date();
    shareInfo = {
      gameTitle: g.title,
      levelName: `${level.name} ${sizeLabel(level)}`,
      resultTitle: title,
      label: isScore ? g.scoreLabel : '用時',
      value: isScore ? `${score} ${g.unit}` : fmtTime(time),
      stars,
      note: firstClear ? '首次攻略！' : ((compare.querySelector('b.up') || {}).textContent || ''),
      heroKey: `share-hero-${gearKey()}`,
      buildHero: () => createHero(heroGear()),
      lv: save.level,
      playerTitle: titleFor(save.level),
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      text: `我喺「腦力勇者」${g.title}（${level.name}）${isScore ? `攞咗 ${score} ${g.unit}` : `用咗 ${fmtTime(time)}`}！`,
    };
    shareCard = null;
    setTimeout(() => { if (shareInfo && !shareCard) shareCard = makeShareCard(shareInfo).catch(() => null); }, 900);
  }

  /* 結算畫面：今次完成咗嘅每日任務、連續日數獎勵 */
  function showQuestNote(q) {
    const parts = [];
    if (q.done.length === 1) parts.push(`完成任務：${q.done[0].text}`);
    else if (q.done.length > 1) parts.push(`完成 ${q.done.length} 個任務`);
    if (q.bonus) parts.push('今日全部完成！');
    if (q.streakBonus) parts.push(`連續 ${q.streak} 日`);
    const el = $('#resQuest');
    el.innerHTML = parts.length ? `${icon('check')}<span>${parts.join('・')}</span>` : '';
    el.title = q.done.map(d => d.text).join('、');
    el.hidden = !parts.length;
  }

  /* 同上次／最佳比較（正面講法；「比上次差」就淡淡哋列出上次同最佳） */
  function compareText(game, value, last, prevBest, isRecord) {
    const g = GAMES[game];
    const isScore = g.metric === 'score';
    const amt = d => (isScore ? `${Math.abs(d)} ${g.unit}` : `${Math.abs(d).toFixed(1)} 秒`);
    if (isRecord) return `<b class="up">比之前最佳${isScore ? '多' : '快'} ${amt(value - prevBest)}！</b>`;
    const better = last == null ? 0 : (isScore ? value - last : last - value);
    const bestTxt = `最佳 ${fmtBest(game, prevBest)}`;
    if (last != null && better > (isScore ? 0 : 0.04)) return `<b class="up">比上次${isScore ? '多' : '快'} ${amt(better)}！</b>・${bestTxt}`;
    if (last != null && Math.abs(better) <= (isScore ? 0 : 0.04)) return `同上次一樣・${bestTxt}`;
    return last != null ? `上次 ${fmtBest(game, last)}・${bestTxt}` : bestTxt;
  }

  /* ---------- 分享戰績 ---------- */
  let shareInfo = null;
  let shareCard = null;
  async function shareResult() {
    if (!shareInfo) return;
    if (!shareCard) shareCard = makeShareCard(shareInfo).catch(() => null);
    const card = await shareCard;
    if (!card) return;
    const file = typeof File === 'function' ? new File([card.blob], 'brain-quest.png', { type: 'image/png' }) : null;
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareInfo.text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    $('#shareImg').src = card.url;
    $('#shareDownload').href = card.url;
    openOverlay(overlays.share);
  }

  /* =========================================================
     難度選擇 / 紀錄
     ========================================================= */
  let diffGame = null;
  function openDiff(game) {
    diffGame = game;
    const g = GAMES[game];
    $('#diffTitle').innerHTML = `${icon(g.icon)}${g.title}`;
    $('#diffSub').textContent = g.hint;
    $('#levelGrid').innerHTML = g.levels.map(l => {
      const unlocked = isUnlocked(game, l);
      const key = keyOf(game, l);
      const best = save.best[key];
      const desc = !unlocked ? `${icon('lock')}攻略高級後解鎖` : l.desc;
      const bestHtml = best != null
        ? `<span>${fmtBest(game, best)}</span><span class="stars">${starText(save.stars[key] || 0)}</span>`
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

  const availableGames = () => gameIds().filter(id => VIEW_CLASSES[id]);

  function openRecords() {
    const need = expToNext(save.level);
    $('#rLv').textContent = save.level;
    $('#rTitle').textContent = titleFor(save.level);
    $('#rExp').style.width = `${Math.min(100, (save.exp / need) * 100)}%`;
    $('#rExpText').textContent = `經驗值 ${save.exp} / ${need}．出戰 ${save.plays} 次`;
    $('#rSummary').innerHTML = `${icon('calendar')}最近 7 日出戰 <b>${playsInLastDays(7)}</b> 局．連續 <b>${streakDays()}</b> 日`;
    const rows = [];
    for (const game of availableGames()) {
      const g = GAMES[game];
      rows.push(`<div class="rec-group">${icon(g.icon)}${g.title}</div>`);
      for (const l of g.levels) {
        const key = keyOf(game, l);
        const best = save.best[key];
        const spark = sparkline(historyOf(key).slice(-10).map(h => h[1]), { w: 64, h: 24, invert: g.metric !== 'score', cls: 'spark mini' });
        const val = best != null
          ? `${spark}${fmtBest(game, best)}<span class="stars">${starText(save.stars[key] || 0)}</span>`
          : `<span class="none">${isUnlocked(game, l) ? '未挑戰' : `${icon('lock')}未解鎖`}</span>`;
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
    const v = views[current];
    if (!v || !v.active) { goMenu(); return; }
    retreatPaused = Timer.running;
    Timer.pause();
    setPaused(true);
    stopRepeat();
    openOverlay(overlays.retreat);
  }
  function resumeFromRetreat() {
    closeOverlay(overlays.retreat);
    setPaused(false);
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
     輸入：畫布觸控（交俾當前遊戲處理）
     ========================================================= */
  const playView = () => (current !== 'menu' ? views[current] : null);
  canvas.addEventListener('pointerdown', e => {
    const v = playView();
    if (!v || !v.pointerDown || overlayOpen() || e.button > 0) return;
    e.preventDefault();
    if (v.pointerMove) { try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 舊瀏覽器 */ } }
    v.pointerDown(e.clientX, e.clientY, e.pointerId);
  });
  canvas.addEventListener('pointermove', e => { const v = playView(); if (v && v.pointerMove) v.pointerMove(e.clientX, e.clientY, e.pointerId); });
  canvas.addEventListener('pointerup', e => { const v = playView(); if (v && v.pointerUp) v.pointerUp(e.clientX, e.clientY, e.pointerId, false); });
  canvas.addEventListener('pointercancel', e => { const v = playView(); if (v && v.pointerUp) v.pointerUp(e.clientX, e.clientY, e.pointerId, true); });

  // 面板模式（道具店、成語石碑）嘅 HTML 按鈕
  $('#panelBody').addEventListener('click', e => {
    const v = playView();
    if (v && v.panelClick && !overlayOpen()) v.panelClick(e);
  });

  /* 方向掣：長按連續行 */
  let repeatTimer = 0;
  let repeatBtn = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatTimer);
    if (repeatBtn) repeatBtn.classList.remove('pressed');
    repeatBtn = null;
  }
  const moveCurrent = dir => { const v = playView(); return !!(v && v.move && !overlayOpen() && v.move(dir)); };
  $$('.dpad-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      stopRepeat();
      repeatBtn = btn;
      btn.classList.add('pressed');
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 舊瀏覽器 */ }
      const dir = btn.dataset.dir;
      moveCurrent(dir);
      repeatTimer = setTimeout(() => {
        repeatTimer = setInterval(() => { if (!moveCurrent(dir)) stopRepeat(); }, 165);
      }, 300);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, stopRepeat));
    btn.addEventListener('click', e => { if (e.detail === 0) moveCurrent(btn.dataset.dir); });
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
      for (const o of [overlays.share, overlays.armory, overlays.stamps, overlays.duel]) if (!o.hidden) { closeOverlay(o); return; }
      if (current !== 'menu' && !overlayOpen()) { requestRetreat(); return; }
    }
    const v = playView();
    if (!v || !v.move || overlayOpen()) return;
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastKey < 90) return;
    lastKey = now;
    v.move(dir);
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
    $('#mGold').textContent = save.gold || 0;
  }
  function renderMenu() {
    updateStatus();
    renderInstallTip();
    renderDaily();
    const featured = today().featured;
    const ids = availableGames();
    $('#gameGrid').innerHTML = CATEGORIES.map(c => {
      const games = ids.filter(id => GAMES[id].category === c.id);
      if (!games.length) return '';
      const cards = games.map(id => {
        const g = GAMES[id];
        return `<button class="game-card cat-${g.category}${id === featured ? ' featured' : ''}" data-quest="${id}">
            <span class="gc-ico" aria-hidden="true">${icon(g.icon)}</span>
            <span class="gc-name">${g.title}</span>
            <span class="gc-tag">${g.tagline}</span>
            <span class="gc-stars">★ ${starsTotal(id)}/${starsMax(id)}</span>
            ${id === featured ? '<span class="gc-feat">今日推介</span>' : ''}
          </button>`;
      }).join('');
      return `<section class="cat"><h2 class="cat-head">${icon(c.icon)}<span>${c.name}</span></h2><div class="cards">${cards}</div></section>`;
    }).join('');
  }
  /* ---------- 加到主畫面（PWA） ---------- */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderInstallTip(); });
  function renderInstallTip() {
    const tip = $('#installTip');
    const show = !isStandalone() && !save.installDismissed && (isIOS || !!installEvt);
    tip.hidden = !show;
    if (!show) return;
    $('.tip-install', tip).hidden = !installEvt;
    if (isIOS) {
      $('#installText').innerHTML = `撳${icon('share')}「分享」→${icon('addbox')}「加入主畫面」，就好似 App 咁開，冇網都玩到。`;
      $('#installNote').textContent = '主畫面版本嘅紀錄同 Safari 分開，建議早啲加。';
    } else {
      $('#installText').textContent = '撳「安裝」就可以喺主畫面一撳開遊戲，冇網都玩到。';
      $('#installNote').textContent = '';
    }
  }
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('games-sw.js', { scope: 'games' }).catch(() => { /* 唔支援就照網上玩 */ });
  }

  /* ---------- 今日任務卡 ---------- */
  function renderDaily() {
    const d = today();
    const items = d.quests.map(q => {
      const goal = questGoal(q);
      const attrs = q.id === 'featured' && !q.done ? ` data-quest="${q.game}" role="button" tabindex="0"` : '';
      return `<li class="dq${q.done ? ' done' : ''}${attrs ? ' link' : ''}"${attrs}>
          <span class="dq-check">${icon(q.done ? 'check' : 'flag')}</span>
          <span class="dq-text">${questText(q)}</span>
          <span class="dq-prog">${Math.min(q.n, goal)}/${goal}</span>
          <span class="dq-reward">${icon('coin')}${questReward(q)}</span>
        </li>`;
    }).join('');
    $('#dailyCard').innerHTML = `
      <div class="daily-head">
        <h2 class="dh-title">${icon('flag')}今日任務</h2>
        <span class="dh-streak">${icon('calendar')}連續 <b>${streakDays()}</b> 日</span>
      </div>
      <ul class="daily-list">${items}</ul>
      <div class="daily-foot">
        <span class="dq-bonus${d.bonus ? ' got' : ''}">${icon('chest')}${d.bonus ? '今日任務全部完成！' : `全部完成再送 ${COMPLETE_BONUS} 金幣`}</span>
        <button class="ghost-btn" data-action="stamps">${icon('seal')}印章簿</button>
      </div>`;
  }

  /* ---------- 印章簿 ---------- */
  function openStamps() {
    const weeks = stampWeeks();
    const head = ['一', '二', '三', '四', '五', '六', '日'].map(d => `<span class="sg-head">${d}</span>`).join('');
    const cells = weeks.flat().map(c => {
      const cls = ['sg-day', c.n ? 'stamped' : '', c.today ? 'today' : '', c.future ? 'future' : ''].filter(Boolean).join(' ');
      return `<span class="${cls}"${c.n ? ` title="玩咗 ${c.n} 局"` : ''}><i>${c.date.getDate()}</i>${c.n ? icon('seal', 'stamp') : ''}</span>`;
    }).join('');
    $('#stampGrid').innerHTML = head + cells;
    const stamped = weeks.flat().filter(c => c.n).length;
    $('#stampsSub').innerHTML = `最近四星期蓋咗 <b>${stamped}</b> 個印．連續 <b>${streakDays()}</b> 日．最近 7 日 <b>${playsInLastDays(7)}</b> 局`;
    openOverlay(overlays.stamps);
  }

  /* ---------- 裝備屋 ---------- */
  let armorySlot = 'sword';
  function renderArmory(msg = '') {
    $('#aGold').textContent = save.gold || 0;
    $('#armoryMsg').textContent = msg;
    const heroUrl = snapshot(`armory-hero-${gearKey()}`, () => {
      const h = createHero(heroGear());
      h.group.rotation.y = 0.45;
      return h.group;
    }, 200);
    $('#armoryHero').hidden = !heroUrl;
    if (heroUrl) $('#armoryHero').src = heroUrl;
    $('#armoryTabs').innerHTML = SLOTS.map(s => `<button class="armory-tab${s.id === armorySlot ? ' on' : ''}" role="tab" aria-selected="${s.id === armorySlot}" data-slot="${s.id}">${icon(s.icon)}${s.name}</button>`).join('');
    $('#armoryGrid').innerHTML = GEAR[armorySlot].map(item => {
      const st = gearState(item);
      const img = gearThumb(armorySlot, item);
      let act;
      if (st === 'equipped') act = `<span class="ar-state">${icon('check')}裝備中</span>`;
      else if (st === 'owned') act = `<button class="ghost-btn ar-btn" data-gear-equip="${item.id}">裝備</button>`;
      else if (st === 'buyable') act = `<button class="cta ar-btn" data-gear-buy="${item.id}">${icon('coin')}${item.price} 購買</button>`;
      else if (st === 'locked') act = `<button class="ghost-btn ar-btn" disabled>${icon('lock')}Lv ${item.lv} 解鎖</button>`;
      else act = `<button class="ghost-btn ar-btn" disabled>${icon('coin')}${item.price}</button><span class="ar-hint">仲差 ${item.price - (save.gold || 0)} 金幣</span>`;
      return `<div class="ar-card${st === 'equipped' ? ' on' : ''}">
          ${img ? `<img class="ar-img" src="${img}" alt="">` : ''}
          <div class="ar-info"><b class="ar-name">${item.name}</b><span class="ar-desc">${item.desc}</span></div>
          <div class="ar-act">${act}</div>
        </div>`;
    }).join('');
  }
  function openArmory() {
    renderArmory();
    openOverlay(overlays.armory);
  }
  function gearChanged(msg) {
    renderArmory(msg);
    menuView.refreshHero(heroGear());
    updateStatus();
    Object.values(views).forEach(v => { if (v !== menuView && v.refreshHero) v.refreshHero(heroGear()); });
  }

  function renderMute() {
    $$('.mute-toggle').forEach(b => {
      b.innerHTML = icon(save.muted ? 'sound-off' : 'sound-on');
      b.setAttribute('aria-pressed', String(save.muted));
      b.setAttribute('aria-label', save.muted ? '開啟音效' : '關閉音效');
    });
  }

  document.addEventListener('click', e => {
    const dg = e.target.closest('[data-dgame]');
    if (dg) { duelCfg.game = dg.dataset.dgame; renderDuelSetup(); return; }
    const sp = e.target.closest('[data-speed]');
    if (sp) { duelCfg.speed = sp.dataset.speed; renderDuelSetup(); return; }
    const nd = e.target.closest('[data-need]');
    if (nd) { duelCfg.need = Number(nd.dataset.need); renderDuelSetup(); return; }
    const slotBtn = e.target.closest('[data-slot]');
    if (slotBtn) { armorySlot = slotBtn.dataset.slot; renderArmory(); return; }
    const buy = e.target.closest('[data-gear-buy]');
    if (buy) {
      const id = buy.dataset.gearBuy;
      if (buyGear(id)) { Sound.coin(); buzz(20); gearChanged(`買咗「${findGear(id).item.name}」，已經裝備！`); }
      return;
    }
    const eq = e.target.closest('[data-gear-equip]');
    if (eq) {
      const id = eq.dataset.gearEquip;
      if (equipGear(id)) { Sound.flip(); gearChanged(`換上「${findGear(id).item.name}」`); }
      return;
    }
    const quest = e.target.closest('[data-quest]');
    if (quest) { openDiff(quest.dataset.quest); return; }
    if (e.target.closest('.mute-toggle')) {
      save.muted = !save.muted;
      Sound.setMuted(save.muted);
      persist();
      renderMute();
      return;
    }
    const tool = e.target.closest('[data-tool]');
    if (tool) {
      const v = playView();
      if (v && v.tool && !overlayOpen() && !tool.disabled) v.tool(tool.dataset.tool);
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
      case 'share':         shareResult(); break;
      case 'armory':        openArmory(); break;
      case 'duel-open':     openDuelSetup(); break;
      case 'duel-setup':    openDuelSetup(); break;
      case 'close-duel':    closeOverlay(overlays.duel); break;
      case 'duel-start':
      case 'duel-again':    startDuel(); break;
      case 'close-armory':  closeOverlay(overlays.armory); break;
      case 'stamps':        openStamps(); break;
      case 'close-stamps':  closeOverlay(overlays.stamps); break;
      case 'close-share':   closeOverlay(overlays.share); break;
      case 'install':
        if (installEvt) {
          installEvt.prompt();
          installEvt.userChoice.finally(() => { installEvt = null; renderInstallTip(); });
        }
        break;
      case 'dismiss-install': save.installDismissed = true; persist(); renderInstallTip(); break;
      default: break;
    }
  });
  overlays.diff.addEventListener('click', e => { if (e.target === overlays.diff) closeDiff(); });
  overlays.records.addEventListener('click', e => { if (e.target === overlays.records) closeOverlay(overlays.records); });
  [overlays.armory, overlays.stamps, overlays.share, overlays.duel].forEach(o => o.addEventListener('click', e => { if (e.target === o) closeOverlay(o); }));

  // 自動測試用（網址加 ?debug 先會開）
  if (new URLSearchParams(location.search).has('debug')) {
    window.__bh = {
      views, getView, engine, Timer, save, getDuel,
      shareUrl: () => (shareCard || (shareInfo ? makeShareCard(shareInfo) : Promise.resolve(null))).then(c => c && c.url),
    };
  }

  /* ---------- 啟動 ---------- */
  $$('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, el.className); });
  setGameList(availableGames());
  renderMute();
  showScreen('menu');
  await Promise.race([fontsReady, sleep(1200)]);
  measure();
  document.body.classList.remove('booting');
  registerOffline();
}
