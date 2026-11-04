/* =========================================================
   腦力勇者 — 數觸之戰．地下迷宮
   純 vanilla JS，無外部資源；音效由 Web Audio 即時合成
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 小工具 ---------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const restartAnim = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const buzz = pattern => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* 不支援就算 */ } };
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function fmtTime(sec) {
    if (sec < 60) return `${sec.toFixed(1)} 秒`;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m} 分 ${String(s).padStart(2, '0')} 秒`;
  }
  function fmtTimeHtml(sec) {
    if (sec < 60) return `${sec.toFixed(1)}<small>秒</small>`;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}<small>分</small>${String(s).padStart(2, '0')}<small>秒</small>`;
  }

  /* =========================================================
     存檔（localStorage，失敗時照玩，只係唔記錄）
     ========================================================= */
  const STORE_KEY = 'brainHero.v1';
  const freshSave = () => ({ exp: 0, level: 1, plays: 0, best: {}, stars: {}, muted: false });
  function loadSave() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshSave();
      const data = JSON.parse(raw);
      const s = Object.assign(freshSave(), data);
      s.best = Object.assign({}, data.best);
      s.stars = Object.assign({}, data.stars);
      return s;
    } catch (_) {
      return freshSave();
    }
  }
  const save = loadSave();
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (_) { /* 私密瀏覽等情況 */ }
  }

  /* ---------- 等級與稱號 ---------- */
  const expToNext = lv => 60 + lv * 40;
  const TITLES = [
    [1, '見習冒險者'], [3, '旅行劍士'], [5, '王國戰士'], [8, '聖騎士'],
    [12, '勇者'], [16, '傳說勇者'], [20, '腦力賢者'], [30, '不朽英雄'],
  ];
  function titleFor(lv) {
    let t = TITLES[0][1];
    for (const [min, name] of TITLES) if (lv >= min) t = name;
    return t;
  }
  function addExp(amount) {
    const from = save.level;
    save.exp += amount;
    while (save.exp >= expToNext(save.level)) {
      save.exp -= expToNext(save.level);
      save.level += 1;
    }
    return { leveled: save.level > from, from, to: save.level };
  }

  /* =========================================================
     音效（Web Audio 合成，零外部檔案）
     ========================================================= */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let unlocked = false;

    function ensure() {
      if (save.muted) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, start, dur, opts = {}) {
      const c = ensure();
      if (!c) return;
      const { type = 'square', vol = 0.4, slide = 0 } = opts;
      const t0 = c.currentTime + start;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    // 五聲音階：連續答啱會一路升調，好似彈緊旋律
    const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0];
    const noteAt = i => SCALE[i % 5] * Math.pow(2, Math.min(Math.floor(i / 5), 2));

    return {
      unlock() {
        const c = ensure();
        if (!c || unlocked) return;
        // iOS：喺用戶手勢內播一段無聲 buffer 先算真正解鎖
        const buf = c.createBuffer(1, 1, 22050);
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start(0);
        unlocked = true;
      },
      setMuted(m) {
        if (ctx) { m ? ctx.suspend() : ctx.resume(); }
      },
      hit(i, crit) {
        tone(noteAt(i), 0, 0.12, { vol: 0.32 });
        tone(noteAt(i) * 2, 0.025, 0.09, { type: 'triangle', vol: crit ? 0.3 : 0.14 });
      },
      miss()  { tone(150, 0, 0.24, { type: 'sawtooth', vol: 0.22, slide: 0.55 }); },
      tick()  { tone(660, 0, 0.1, { vol: 0.28 }); },
      go()    { tone(880, 0, 0.1, { vol: 0.3 }); tone(1318.5, 0.09, 0.28, { vol: 0.3 }); },
      step()  { tone(300, 0, 0.045, { type: 'triangle', vol: 0.22 }); },
      bump()  { tone(95, 0, 0.11, { vol: 0.2, slide: 0.8 }); },
      gem() {
        tone(1046.5, 0, 0.08, { type: 'triangle', vol: 0.4 });
        tone(1568, 0.07, 0.18, { type: 'triangle', vol: 0.4 });
      },
      victory() {
        const seq = [[392, 0, 0.11], [523.25, 0.12, 0.11], [659.25, 0.24, 0.11], [783.99, 0.36, 0.28],
                     [659.25, 0.66, 0.11], [783.99, 0.78, 0.11], [1046.5, 0.9, 0.55]];
        seq.forEach(([f, s, d]) => {
          tone(f, s, d, { vol: 0.32 });
          tone(f / 2, s, d, { type: 'triangle', vol: 0.22 });
        });
      },
      levelUp() {
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) =>
          tone(f, i * 0.085, 0.22, { type: 'triangle', vol: 0.42 }));
      },
    };
  })();

  // iOS 要喺手勢入面先可以發聲
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => Sound.unlock(), { capture: true, passive: true }));

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
    start() {
      if (!this.el) return;
      this.t0 = performance.now();
      this.running = true;
      this.loop();
    },
    elapsedMs() { return this.acc + (this.running ? performance.now() - this.t0 : 0); },
    loop() {
      cancelAnimationFrame(this.raf);
      const tick = () => {
        if (!this.running) return;
        this.render();
        this.raf = requestAnimationFrame(tick);
      };
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
    resume() {
      if (this.running || !this.el) return;
      this.t0 = performance.now();
      this.running = true;
      this.loop();
    },
    stop() {
      this.pause();
      this.render();
      const sec = this.acc / 1000;
      this.el = null;
      return sec;
    },
  };

  /* =========================================================
     關卡設定
     ========================================================= */
  const SCHULTE_LEVELS = [
    { id: 'easy',   name: '初級', size: 3, enemy: '🦇', enemyName: '洞窟蝙蝠', stars: [12, 20], exp: 20 },
    { id: 'normal', name: '中級', size: 4, enemy: '💀', enemyName: '骷髏劍士', stars: [30, 50], exp: 35 },
    { id: 'hard',   name: '高級', size: 5, enemy: '🐉', enemyName: '遠古巨龍', stars: [50, 80], exp: 55 },
    { id: 'boss',   name: '魔王', size: 6, enemy: '😈', enemyName: '混沌魔王', stars: [85, 130], exp: 80, unlock: 'hard' },
  ];
  const MAZE_LEVELS = [
    { id: 'easy',   name: '初級', size: 7,  gems: 2, fog: false, loops: 2, desc: '小型迷宮，熟習操作', exp: 20 },
    { id: 'normal', name: '中級', size: 10, gems: 3, fog: false, loops: 4, desc: '路線更長更曲折', exp: 35 },
    { id: 'hard',   name: '高級', size: 12, gems: 3, fog: true,  loops: 5, desc: '黑暗中靠火把前進', exp: 55 },
    { id: 'boss',   name: '魔王', size: 15, gems: 4, fog: true,  loops: 8, desc: '巨大又黑暗的魔城', exp: 80, unlock: 'hard' },
  ];
  const GAMES = {
    schulte: { title: '數觸之戰', icon: '🐉', levels: SCHULTE_LEVELS, label: l => `${l.size}×${l.size}`, sub: '點擊順序：1 → 2 → 3 …，越快擊倒魔物，評價越高。' },
    maze:    { title: '地下迷宮', icon: '🏰', levels: MAZE_LEVELS,    label: l => `${l.size}×${l.size}`, sub: '用方向鍵、滑動或點擊地圖帶領勇者前往王冠。' },
  };
  const keyOf = (game, level) => `${game}-${level.id}`;
  const isUnlocked = (game, level) => !level.unlock || save.best[`${game}-${level.unlock}`] != null;

  /* =========================================================
     畫面與導航
     ========================================================= */
  const screens = { menu: $('#screen-menu'), schulte: $('#screen-schulte'), maze: $('#screen-maze') };
  let current = 'menu';
  let inGameHistory = false;
  let autoPaused = false;
  let session = null; // { game, level }

  function showScreen(name) {
    current = name;
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    document.body.classList.toggle('in-game', name !== 'menu');
    if (name === 'menu') {
      renderMenu();
      window.scrollTo(0, 0);
    }
  }

  const overlays = { diff: $('#diffOverlay'), result: $('#resultOverlay'), retreat: $('#retreatOverlay') };
  const countdownEl = $('#countdown');
  function openOverlay(el) {
    el.hidden = false;
    const focusEl = el.querySelector('.cmd-btn.primary:not(:disabled), .cmd-btn:not(:disabled)');
    if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 50);
  }
  const closeOverlay = el => { el.hidden = true; };
  const closeAllOverlays = () => Object.values(overlays).forEach(closeOverlay);
  const overlayOpen = () => Object.values(overlays).some(el => !el.hidden) || !countdownEl.hidden;

  function abortGame() {
    Countdown.cancel();
    Schulte.abort();
    Maze.abort();
    Timer.reset(null);
    autoPaused = false;
  }

  function goMenu() {
    abortGame();
    closeAllOverlays();
    showScreen('menu');
    if (inGameHistory) {
      inGameHistory = false;
      history.back();
    }
  }

  // iPhone 邊緣向右掃（返回）→ 返回據點，而唔係離開網頁
  window.addEventListener('popstate', () => {
    if (!inGameHistory) return;
    inGameHistory = false;
    abortGame();
    closeAllOverlays();
    showScreen('menu');
  });

  function startGame(game, level) {
    closeAllOverlays();
    abortGame();
    session = { game, level };
    if (!inGameHistory) {
      try { history.pushState({ brainHero: 'game' }, ''); inGameHistory = true; } catch (_) { /* file:// 等環境 */ }
    }
    showScreen(game);
    (game === 'schulte' ? Schulte : Maze).start(level);
  }

  /* ---------- 開場倒數 ---------- */
  const Countdown = (() => {
    let timer = 0;
    const intro = $('#cdIntro');
    const num = $('#cdNum');
    return {
      run(text, done) {
        clearTimeout(timer);
        intro.textContent = text;
        num.textContent = '';
        num.className = 'countdown-num';
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
        timer = setTimeout(next, 700);
      },
      cancel() {
        clearTimeout(timer);
        countdownEl.hidden = true;
      },
    };
  })();

  /* ---------- 版面：棋盤按可用空間變成最大正方形 ---------- */
  function fitBoard() {
    if (current === 'menu') return;
    const screen = screens[current];
    const area = $('.board-area', screen);
    const board = $('.board', screen);
    const size = Math.max(160, Math.floor(Math.min(area.clientWidth, area.clientHeight, 760)));
    board.style.setProperty('--board-size', `${size}px`);
    if (current === 'schulte') Schulte.layout(size);
    else Maze.resize();
  }
  let fitRaf = 0;
  const queueFit = () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitBoard); };
  window.addEventListener('resize', queueFit);
  window.addEventListener('orientationchange', () => setTimeout(fitBoard, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);

  /* =========================================================
     遊戲一：數觸之戰（Schulte 數字表）
     ========================================================= */
  const Schulte = (() => {
    const grid = $('#sGrid');
    const nextEl = $('#sNext');
    const hpEl = $('#sHp');
    const missEl = $('#sMiss');
    const msgEl = $('#sMsg');
    const enemyEl = $('#sEnemy');
    const enemyNameEl = $('#sEnemyName');
    const enemyBox = $('.enemy', screens.schulte);

    const st = { level: null, total: 0, next: 1, misses: 0, combo: 0, maxCombo: 0, crits: 0, lastHit: 0, active: false, hintTimer: 0 };
    const msg = text => { msgEl.textContent = text; };

    function floatText(text, cls) {
      const el = document.createElement('span');
      el.className = `float-text ${cls || ''}`;
      el.textContent = text;
      enemyBox.appendChild(el);
      setTimeout(() => el.remove(), 850);
    }

    function setHp() {
      const ratio = (st.total - (st.next - 1)) / st.total;
      hpEl.style.width = `${ratio * 100}%`;
      hpEl.classList.toggle('mid', ratio <= 0.5 && ratio > 0.2);
      hpEl.classList.toggle('low', ratio <= 0.2);
    }

    function armHint() {
      clearTimeout(st.hintTimer);
      st.hintTimer = setTimeout(() => {
        if (!st.active) return;
        const t = grid.querySelector(`.tile[data-v="${st.next}"]`);
        if (t) t.classList.add('hint');
        msg('▶ 勇者的直覺：留意發光的數字！');
      }, 9000);
    }

    function start(level) {
      st.level = level;
      st.total = level.size * level.size;
      st.next = 1;
      st.misses = 0; st.combo = 0; st.maxCombo = 0; st.crits = 0; st.lastHit = 0;
      st.active = false;
      clearTimeout(st.hintTimer);

      const nums = shuffle(Array.from({ length: st.total }, (_, i) => i + 1));
      grid.style.setProperty('--n', level.size);
      grid.innerHTML = nums.map(v => `<button class="tile" data-v="${v}" role="gridcell" aria-label="${v}">${v}</button>`).join('');
      grid.classList.add('locked');

      enemyEl.textContent = level.enemy;
      enemyEl.className = 'enemy-sprite';
      enemyNameEl.textContent = level.enemyName;
      nextEl.textContent = '1';
      missEl.textContent = '0';
      setHp();
      msg(`▶ ${level.enemyName}出現了！`);
      Timer.reset($('#sTimer'));
      fitBoard();

      Countdown.run(`${level.enemy} ${level.enemyName}出現了！`, () => {
        st.active = true;
        grid.classList.remove('locked');
        Timer.start();
        msg('▶ 由「1」開始，順序點擊！');
        armHint();
      });
    }

    function layout(size) {
      const n = st.level ? st.level.size : 3;
      const gap = Math.round(Math.max(6, Math.min(14, size * 0.022)));
      const tile = (size - gap * (n - 1)) / n;
      grid.style.setProperty('--gap', `${gap}px`);
      grid.style.setProperty('--tile-font', `${Math.round(tile * (n >= 6 ? 0.42 : 0.46))}px`);
    }

    function correct(tile) {
      const now = performance.now();
      const crit = st.lastHit && now - st.lastHit < 1000;
      st.lastHit = now;
      tile.classList.remove('hint');
      tile.classList.add('cleared');
      restartAnim(tile, 'hit');
      tile.setAttribute('aria-label', `${tile.dataset.v}（已擊破）`);

      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      if (crit) st.crits += 1;
      Sound.hit(st.next - 1, crit);
      buzz(12);

      restartAnim(enemyEl, 'hurt');
      const dmg = crit ? rand(22, 32) : rand(8, 15);
      floatText(`-${dmg}`);
      if (crit) msg(`▶ 會心一擊！造成 ${dmg} 點傷害`);
      else msg(`▶ 命中！造成 ${dmg} 點傷害`);
      if (st.combo >= 5 && st.combo % 5 === 0) floatText(`${st.combo} 連擊！`, 'combo');

      st.next += 1;
      setHp();
      if (st.next > st.total) { finish(); return; }
      nextEl.textContent = String(st.next);
      restartAnim(nextEl, 'pop');
      armHint();
    }

    function wrong(tile) {
      st.misses += 1;
      st.combo = 0;
      missEl.textContent = String(st.misses);
      Sound.miss();
      buzz([25, 40, 25]);
      restartAnim(tile, 'wrong');
      setTimeout(() => tile.classList.remove('wrong'), 420);
      msg(`▶ 這是「${tile.dataset.v}」，請找「${st.next}」`);
    }

    function onTap(tile) {
      if (!st.active || !tile || tile.classList.contains('cleared')) return;
      if (Number(tile.dataset.v) === st.next) correct(tile);
      else wrong(tile);
    }

    function finish() {
      st.active = false;
      clearTimeout(st.hintTimer);
      grid.classList.add('locked');
      const time = Timer.stop();
      restartAnim(enemyEl, 'defeated');
      Sound.victory();
      buzz([40, 60, 80]);
      msg(`▶ ${st.level.enemyName}被打倒了！`);

      const lv = st.level;
      const stars = time <= lv.stars[0] ? 3 : time <= lv.stars[1] ? 2 : 1;
      const lines = [
        ['失誤', st.misses === 0 ? '0 ✨' : `${st.misses}`],
        ['最高連擊', `${st.maxCombo}`],
        ['會心一擊', `${st.crits}`],
      ];
      const bonus = [];
      if (st.misses === 0) bonus.push(['無失誤獎勵', 10]);
      const title = stars === 3 ? '完美勝利！' : stars === 2 ? '漂亮的勝利！' : '戰鬥勝利！';
      setTimeout(() => showResult({
        game: 'schulte', level: lv, time, stars, lines, bonus,
        eyebrow: 'VICTORY', title,
      }), 950);
    }

    function abort() {
      st.active = false;
      clearTimeout(st.hintTimer);
      grid.classList.add('locked');
    }

    // pointerdown 反應最快；click（detail 0）留畀鍵盤用家
    grid.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const tile = e.target.closest('.tile');
      if (tile) { e.preventDefault(); onTap(tile); }
    });
    grid.addEventListener('click', e => {
      if (e.detail !== 0) return;
      onTap(e.target.closest('.tile'));
    });

    return { start, layout, abort, get active() { return st.active; } };
  })();

  /* =========================================================
     遊戲二：地下迷宮
     ========================================================= */
  const Maze = (() => {
    const canvas = $('#mCanvas');
    const ctx = canvas.getContext('2d');
    const gemsEl = $('#mGems');
    const msgEl = $('#mMsg');
    const N = 1, E = 2, S = 4, W = 8;
    const DIRS = {
      up:    { dx: 0,  dy: -1, bit: N, opp: S },
      right: { dx: 1,  dy: 0,  bit: E, opp: W },
      down:  { dx: 0,  dy: 1,  bit: S, opp: N },
      left:  { dx: -1, dy: 0,  bit: W, opp: E },
    };
    const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    const ANIM_MS = 110;
    const BUMP_MS = 170;

    const st = {
      level: null, size: 0, cells: null, seen: null, visited: null,
      hero: { x: 0, y: 0 }, from: { x: 0, y: 0 }, animStart: 0,
      bump: null, goal: 0, gems: new Set(), gemTotal: 0, collected: 0,
      steps: 0, shortest: 0, active: false, raf: 0,
    };
    const msg = text => { msgEl.textContent = text; };
    const idx = (x, y) => y * st.size + x;

    /* --- 迷宮生成：遞迴回溯 + 少量環路（減少死路挫敗感）--- */
    function generate(size, loops) {
      const cells = new Uint8Array(size * size).fill(N | E | S | W);
      const seen = new Uint8Array(size * size);
      const stack = [[0, 0]];
      seen[0] = 1;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const options = Object.values(DIRS).filter(d => {
          const nx = x + d.dx, ny = y + d.dy;
          return nx >= 0 && ny >= 0 && nx < size && ny < size && !seen[ny * size + nx];
        });
        if (!options.length) { stack.pop(); continue; }
        const d = pick(options);
        const nx = x + d.dx, ny = y + d.dy;
        cells[y * size + x] &= ~d.bit;
        cells[ny * size + nx] &= ~d.opp;
        seen[ny * size + nx] = 1;
        stack.push([nx, ny]);
      }
      // 打通部分死路，形成環路
      const deadEnds = () => {
        const out = [];
        for (let i = 1; i < cells.length; i++) {
          const open = 4 - [N, E, S, W].filter(b => cells[i] & b).length;
          if (open === 1) out.push(i);
        }
        return out;
      };
      for (const i of shuffle(deadEnds()).slice(0, loops)) {
        const x = i % size, y = Math.floor(i / size);
        const walls = Object.values(DIRS).filter(d => {
          const nx = x + d.dx, ny = y + d.dy;
          return (cells[i] & d.bit) && nx >= 0 && ny >= 0 && nx < size && ny < size;
        });
        if (!walls.length) continue;
        const d = pick(walls);
        cells[i] &= ~d.bit;
        cells[(y + d.dy) * size + (x + d.dx)] &= ~d.opp;
      }
      return { cells, deadEnds: deadEnds() };
    }

    function bfs(cells, size, start) {
      const dist = new Int32Array(size * size).fill(-1);
      dist[start] = 0;
      const q = [start];
      for (let h = 0; h < q.length; h++) {
        const i = q[h];
        const x = i % size, y = Math.floor(i / size);
        for (const d of Object.values(DIRS)) {
          if (cells[i] & d.bit) continue;
          const j = (y + d.dy) * size + (x + d.dx);
          if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
        }
      }
      return dist;
    }

    function reveal() {
      if (!st.level.fog) return;
      const r = 2;
      for (let y = st.hero.y - r; y <= st.hero.y + r; y++) {
        for (let x = st.hero.x - r; x <= st.hero.x + r; x++) {
          if (x < 0 || y < 0 || x >= st.size || y >= st.size) continue;
          if ((x - st.hero.x) ** 2 + (y - st.hero.y) ** 2 <= r * r + 1) st.seen[idx(x, y)] = 1;
        }
      }
    }

    function updateGems() { gemsEl.textContent = `${st.collected}/${st.gemTotal}`; }

    function start(level) {
      st.level = level;
      st.size = level.size;
      const { cells, deadEnds } = generate(level.size, level.loops);
      st.cells = cells;
      const dist = bfs(cells, level.size, 0);
      let far = 0;
      dist.forEach((d, i) => { if (d > dist[far]) far = i; });
      st.goal = far;
      st.shortest = dist[far];

      const candidates = shuffle(deadEnds.filter(i => i !== 0 && i !== far));
      const extra = shuffle(Array.from(cells.keys()).filter(i => i !== 0 && i !== far && dist[i] > 2));
      st.gems = new Set();
      for (const i of candidates.concat(extra)) {
        if (st.gems.size >= level.gems) break;
        st.gems.add(i);
      }
      st.gemTotal = st.gems.size;
      st.collected = 0;
      st.steps = 0;
      st.hero = { x: 0, y: 0 };
      st.from = { x: 0, y: 0 };
      st.animStart = 0;
      st.bump = null;
      st.seen = new Uint8Array(level.size * level.size);
      st.visited = new Uint8Array(level.size * level.size);
      st.visited[0] = 1;
      st.active = false;
      reveal();
      updateGems();
      msg(level.fog ? '▶ 四周一片黑暗……王冠在遠處發光！' : '▶ 找出通往王冠 👑 的路！');
      Timer.reset($('#mTimer'));
      fitBoard();

      Countdown.run(level.fog ? '🔥 點起火把，進入黑暗迷宮！' : '🏰 進入地下迷宮！', () => {
        st.active = true;
        Timer.start();
        requestRender();
        msg('▶ 用方向鍵、滑動或點擊地圖前進');
      });
    }

    function resize() {
      if (!st.level) return;
      const cssW = canvas.clientWidth;
      if (!cssW) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const px = Math.round(cssW * dpr);
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
      requestRender();
    }

    function requestRender() { if (!st.raf) st.raf = requestAnimationFrame(frame); }
    function frame(now) {
      st.raf = 0;
      if (draw(now)) requestRender();
    }

    // 四邊留少少位，外牆唔會被 canvas 切走一半
    function geom(w) {
      const pad = w * 0.014;
      return { pad, cs: (w - pad * 2) / st.size };
    }

    function emoji(ch, cx, cy, size) {
      ctx.fillStyle = '#fff'; // fillStyle 嘅透明度會影響 emoji，要重設
      ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, cx, cy + size * 0.06);
    }

    // 回傳 true 代表仲有動畫，要繼續畫
    function draw(now) {
      if (!st.level || !canvas.width) return false;
      const W = canvas.width;
      const size = st.size;
      const { pad, cs } = geom(W);
      const fog = st.level.fog;

      // 底色（迷霧＝全黑）
      ctx.fillStyle = fog ? '#05040a' : '#1d1830';
      ctx.fillRect(0, 0, W, W);
      ctx.save();
      ctx.translate(pad, pad);

      // 地板
      for (let i = 0; i < st.cells.length; i++) {
        if (fog && !st.seen[i]) continue;
        const x = i % size, y = Math.floor(i / size);
        ctx.fillStyle = st.visited[i] ? '#2e2748' : '#1d1830';
        ctx.fillRect(x * cs, y * cs, cs + 1, cs + 1);
      }
      // 走過的足跡
      ctx.fillStyle = 'rgba(245, 200, 66, .28)';
      for (let i = 0; i < st.cells.length; i++) {
        if (!st.visited[i] || i === idx(st.hero.x, st.hero.y)) continue;
        const x = i % size, y = Math.floor(i / size);
        ctx.beginPath();
        ctx.arc((x + 0.5) * cs, (y + 0.5) * cs, Math.max(2, cs * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }

      // 牆壁
      ctx.strokeStyle = '#ece1bd';
      ctx.lineWidth = Math.max(2.5, cs * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < st.cells.length; i++) {
        if (fog && !st.seen[i]) continue;
        const c = st.cells[i];
        const x0 = (i % size) * cs, y0 = Math.floor(i / size) * cs;
        const x1 = x0 + cs, y1 = y0 + cs;
        if (c & N) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
        if (c & S) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
        if (c & W) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
        if (c & E) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
      }
      ctx.stroke();

      // 寶石
      for (const g of st.gems) {
        if (fog && !st.seen[g]) continue;
        emoji('💎', (g % size + 0.5) * cs, (Math.floor(g / size) + 0.5) * cs, cs * 0.6);
      }

      // 勇者位置（含移動動畫）
      let animating = false;
      let t = 1;
      if (st.animStart) {
        t = Math.min(1, (now - st.animStart) / ANIM_MS);
        if (t < 1) animating = true; else st.animStart = 0;
      }
      const ease = 1 - (1 - t) * (1 - t);
      let hx = (st.from.x + (st.hero.x - st.from.x) * ease + 0.5) * cs;
      let hy = (st.from.y + (st.hero.y - st.from.y) * ease + 0.5) * cs;
      if (st.bump) {
        const bt = (now - st.bump.start) / BUMP_MS;
        if (bt < 1) {
          const off = Math.sin(bt * Math.PI) * cs * 0.16;
          hx += st.bump.dx * off; hy += st.bump.dy * off;
          animating = true;
        } else st.bump = null;
      }

      // 火把光暈
      if (fog) {
        const g = ctx.createRadialGradient(hx, hy, cs * 1.1, hx, hy, cs * 3.4);
        g.addColorStop(0, 'rgba(5, 4, 10, 0)');
        g.addColorStop(1, 'rgba(5, 4, 10, .6)');
        ctx.fillStyle = g;
        ctx.fillRect(-pad, -pad, W, W);
      }

      // 王冠（迷霧中都會發光，畀方向感）
      const gx = (st.goal % size + 0.5) * cs, gy = (Math.floor(st.goal / size) + 0.5) * cs;
      const pulse = 0.75 + 0.25 * Math.sin(now / 320);
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, cs * 0.9);
      glow.addColorStop(0, `rgba(245, 200, 66, ${0.55 * pulse})`);
      glow.addColorStop(1, 'rgba(245, 200, 66, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gx - cs, gy - cs, cs * 2, cs * 2);
      emoji('👑', gx, gy, cs * 0.68);

      // 勇者
      ctx.fillStyle = 'rgba(245, 200, 66, .32)';
      ctx.beginPath();
      ctx.arc(hx, hy, cs * 0.42, 0, Math.PI * 2);
      ctx.fill();
      emoji('🧙', hx, hy, cs * 0.72);
      ctx.restore();

      // 王冠要持續閃爍
      return animating || st.active;
    }

    function move(dirName) {
      if (!st.active) return false;
      const d = DIRS[dirName];
      const i = idx(st.hero.x, st.hero.y);
      if (st.cells[i] & d.bit) {
        st.bump = { dx: d.dx, dy: d.dy, start: performance.now() };
        Sound.bump();
        buzz(15);
        requestRender();
        return false;
      }
      st.from = { x: st.hero.x, y: st.hero.y };
      st.hero = { x: st.hero.x + d.dx, y: st.hero.y + d.dy };
      st.animStart = performance.now();
      st.steps += 1;
      const j = idx(st.hero.x, st.hero.y);
      st.visited[j] = 1;
      reveal();
      Sound.step();

      if (st.gems.has(j)) {
        st.gems.delete(j);
        st.collected += 1;
        updateGems();
        restartAnim(gemsEl.parentElement, 'pop');
        Sound.gem();
        buzz(20);
        msg(st.collected === st.gemTotal ? '▶ 寶石全部到手！向王冠進發！' : `▶ 得到了寶石！（${st.collected}/${st.gemTotal}）`);
      }
      requestRender();
      if (j === st.goal) finish();
      return true;
    }

    function finish() {
      st.active = false;
      stopRepeat();
      const time = Timer.stop();
      Sound.victory();
      buzz([40, 60, 80]);
      msg('▶ 奪得王冠！迷宮攻略成功！');
      requestRender();

      const lv = st.level;
      const fogMul = lv.fog ? 1.35 : 1;
      const par3 = (st.shortest * 0.6 + 5) * fogMul;
      const par2 = (st.shortest * 1.25 + 12) * fogMul;
      const stars = time <= par3 ? 3 : time <= par2 ? 2 : 1;
      const lines = [
        ['步數', `${st.steps}`],
        ['最短路線', `${st.shortest}`],
        ['寶石', `${st.collected}/${st.gemTotal}`],
      ];
      const bonus = [];
      if (st.collected) bonus.push([`寶石 × ${st.collected}`, st.collected * 5]);
      if (st.collected === st.gemTotal && st.gemTotal) bonus.push(['全寶石獎勵', 10]);
      const title = stars === 3 ? '完美攻略！' : stars === 2 ? '迷宮攻略成功！' : '成功脫出迷宮！';
      setTimeout(() => showResult({
        game: 'maze', level: lv, time, stars, lines, bonus,
        eyebrow: 'DUNGEON CLEAR', title,
      }), 900);
    }

    function abort() {
      st.active = false;
      stopRepeat();
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    }

    /* --- 操控：D-pad（長按連續行）--- */
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
        move(dir);
        repeatTimer = setTimeout(() => {
          repeatTimer = setInterval(() => { if (!move(dir)) stopRepeat(); }, 150);
        }, 320);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, stopRepeat));
      btn.addEventListener('click', e => { if (e.detail === 0) move(btn.dataset.dir); });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    /* --- 操控：喺地圖上滑動（拖住可以連續行）或者點擊方向 --- */
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      if (!st.active) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 舊瀏覽器 */ }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const rect = canvas.getBoundingClientRect();
      const threshold = Math.max(22, geom(rect.width).cs * 0.75);
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      move(dir);
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = true;
    });
    const endDrag = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasTap = !drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 12;
      drag = null;
      if (!wasTap || e.type !== 'pointerup' || !st.active) return;
      // 點擊：向點擊位置嘅方向行一步
      const rect = canvas.getBoundingClientRect();
      const { pad, cs } = geom(rect.width);
      const tx = e.clientX - rect.left - pad - (st.hero.x + 0.5) * cs;
      const ty = e.clientY - rect.top - pad - (st.hero.y + 0.5) * cs;
      if (Math.abs(tx) < cs * 0.5 && Math.abs(ty) < cs * 0.5) return;
      move(Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up'));
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    return { start, resize, move, abort, get active() { return st.active; } };
  })();

  /* ---------- 鍵盤（電腦／iPad 外接鍵盤）---------- */
  let lastKey = 0;
  const KEY_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!overlays.retreat.hidden) { resumeFromRetreat(); return; }
      if (!overlays.diff.hidden) { closeDiff(); return; }
      if (current !== 'menu' && !overlayOpen()) { requestRetreat(); return; }
    }
    if (current !== 'maze' || overlayOpen()) return;
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastKey < 95) return;
    lastKey = now;
    Maze.move(dir);
  });

  /* =========================================================
     戰果結算
     ========================================================= */
  function showResult({ game, level, time, stars, lines, bonus, eyebrow, title }) {
    const key = keyOf(game, level);
    const prevBest = save.best[key];
    const firstClear = prevBest == null;
    const t1 = Math.round(time * 10) / 10;
    const isRecord = firstClear || t1 < prevBest;
    const unlocksBoss = firstClear && level.id === 'hard';
    if (isRecord) save.best[key] = t1;
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
    save.plays += 1;

    // 過關基本分 + 每粒星 10 + 額外獎勵（無失誤／寶石等）
    const expTotal = level.exp + stars * 10 + bonus.reduce((sum, [, v]) => sum + v, 0);
    const lvl = addExp(expTotal);
    persist();
    updateStatus();

    $('#resEyebrow').textContent = eyebrow;
    $('#resTitle').textContent = title;
    $('#resStars').innerHTML = [0, 1, 2].map(i => `<span class="star${i < stars ? ' on' : ''}">★</span>`).join('');
    $('#resStars').setAttribute('aria-label', `評價 ${stars} 星（滿分 3 星）`);
    $('#resTime').innerHTML = fmtTimeHtml(time);

    const badge = $('#resBadge');
    badge.hidden = !isRecord;
    badge.textContent = firstClear ? '🎖 首次攻略！' : '🏆 新紀錄！';
    const compare = $('#resCompare');
    compare.textContent = firstClear ? '' : isRecord
      ? `比之前最佳快 ${(prevBest - t1).toFixed(1)} 秒`
      : `最佳紀錄 ${fmtTime(prevBest)}`;
    compare.hidden = firstClear;

    const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    $('#resStats').innerHTML = lines.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('');
    $('#resExp').innerHTML = `獲得經驗值 <b>+${expTotal} EXP</b>`;
    $('#resUnlock').hidden = !unlocksBoss;

    const lvBox = $('#resLevelUp');
    lvBox.hidden = !lvl.leveled;
    if (lvl.leveled) {
      const oldTitle = titleFor(lvl.from);
      const newTitle = titleFor(lvl.to);
      $('#resLevelDetail').textContent = newTitle !== oldTitle
        ? `Lv ${lvl.from} → ${lvl.to}．新稱號「${newTitle}」`
        : `Lv ${lvl.from} → Lv ${lvl.to}`;
      setTimeout(() => { Sound.levelUp(); buzz([30, 30, 30, 30, 60]); }, 1500);
    }
    openOverlay(overlays.result);
  }

  /* =========================================================
     難度選擇
     ========================================================= */
  let diffGame = null;
  function openDiff(game) {
    diffGame = game;
    const g = GAMES[game];
    $('#diffTitle').textContent = `${g.icon} ${g.title}`;
    $('#diffSub').textContent = g.sub;
    $('#diffList').innerHTML = g.levels.map(l => {
      const unlocked = isUnlocked(game, l);
      const best = save.best[keyOf(game, l)];
      const stars = save.stars[keyOf(game, l)] || 0;
      const desc = unlocked
        ? (game === 'schulte' ? `${l.enemy} ${l.enemyName}` : l.desc)
        : '🔒 攻略高級後解鎖';
      const bestHtml = best != null
        ? `<span class="diff-best">${fmtTime(best)}<span class="stars-sm">${starText(stars)}</span></span>`
        : `<span class="diff-best empty">${unlocked ? '未挑戰' : ''}</span>`;
      return `<button class="cmd-btn diff-btn" data-level="${l.id}" ${unlocked ? '' : 'disabled'}>
          <span class="diff-name">${l.name}<small>${g.label(l)}</small></span>
          <span class="diff-desc">${desc}</span>
          ${bestHtml}
        </button>`;
    }).join('');
    openOverlay(overlays.diff);
  }
  function closeDiff() {
    closeOverlay(overlays.diff);
    if (current !== 'menu') goMenu();
  }
  $('#diffList').addEventListener('click', e => {
    const btn = e.target.closest('.diff-btn');
    if (!btn || btn.disabled) return;
    const level = GAMES[diffGame].levels.find(l => l.id === btn.dataset.level);
    startGame(diffGame, level);
  });

  /* =========================================================
     撤退
     ========================================================= */
  let retreatPaused = false;
  function requestRetreat() {
    if (!countdownEl.hidden) { goMenu(); return; }
    const playing = (current === 'schulte' && Schulte.active) || (current === 'maze' && Maze.active);
    if (!playing) { goMenu(); return; }
    retreatPaused = Timer.running;
    Timer.pause();
    openOverlay(overlays.retreat);
  }
  function resumeFromRetreat() {
    closeOverlay(overlays.retreat);
    if (retreatPaused) Timer.resume();
    retreatPaused = false;
  }

  /* ---------- 切走 App 時暫停計時 ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (Timer.running) { Timer.pause(); autoPaused = true; }
    } else if (autoPaused) {
      autoPaused = false;
      if (overlays.retreat.hidden) Timer.resume();
      else retreatPaused = true;
    }
  });

  /* ---------- iOS：遊戲中禁止雙指縮放（據點畫面照樣可以放大睇）---------- */
  ['gesturestart', 'gesturechange'].forEach(ev =>
    document.addEventListener(ev, e => { if (document.body.classList.contains('in-game')) e.preventDefault(); }));

  /* =========================================================
     據點畫面 / 狀態列
     ========================================================= */
  function updateStatus() {
    const need = expToNext(save.level);
    const pct = `${Math.min(100, (save.exp / need) * 100)}%`;
    $('#tbLevel').textContent = save.level;
    $('#tbExp').style.width = pct;
    $('#recLevel').textContent = save.level;
    $('#recTitle').textContent = titleFor(save.level);
    $('#recExp').style.width = pct;
    $('#recExpText').innerHTML = `經驗值 ${save.exp} / ${need}<br>出戰 ${save.plays} 次`;
  }

  function renderMenu() {
    updateStatus();
    const rows = [];
    for (const [game, g] of Object.entries(GAMES)) {
      rows.push(`<dt class="rec-section">${g.icon} ${g.title}</dt>`);
      for (const l of g.levels) {
        const key = keyOf(game, l);
        const best = save.best[key];
        const unlocked = isUnlocked(game, l);
        rows.push(`<dt>${l.name}　${g.label(l)}</dt>`);
        rows.push(best != null
          ? `<dd>${fmtTime(best)}<span class="stars-sm">${starText(save.stars[key] || 0)}</span></dd>`
          : `<dd class="empty">${unlocked ? '未挑戰' : '🔒 未解鎖'}</dd>`);
      }
    }
    $('#recGrid').innerHTML = rows.join('');
  }

  /* ---------- 靜音 ---------- */
  function renderMute() {
    $$('.mute-toggle').forEach(b => {
      b.textContent = save.muted ? '🔇' : '🔊';
      b.setAttribute('aria-pressed', String(save.muted));
      b.setAttribute('aria-label', save.muted ? '開啟音效' : '關閉音效');
    });
  }

  /* ---------- 全域按鈕 ---------- */
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

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    switch (actionEl.dataset.action) {
      case 'retreat':      requestRetreat(); break;
      case 'retreat-yes':  goMenu(); break;
      case 'retreat-no':   resumeFromRetreat(); break;
      case 'close-diff':   closeDiff(); break;
      case 'again':        if (session) startGame(session.game, session.level); break;
      case 'change-diff':  closeOverlay(overlays.result); if (session) openDiff(session.game); break;
      case 'home':         goMenu(); break;
      default: break;
    }
  });

  // 點擊遮罩背景（難度選擇）＝返回
  overlays.diff.addEventListener('click', e => { if (e.target === overlays.diff) closeDiff(); });

  /* ---------- 啟動 ---------- */
  renderMute();
  showScreen('menu');
})();
