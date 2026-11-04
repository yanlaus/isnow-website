/* 存檔、遊戲登記表、關卡設定、等級與稱號 */

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

export const save = loadSave();

export function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (_) { /* 私密瀏覽：照玩，只係唔記錄 */ }
}

/* ---------- 等級與稱號 ---------- */
export const expToNext = lv => 60 + lv * 40;

const TITLES = [
  [1, '見習冒險者'], [3, '旅行劍士'], [5, '王國戰士'], [8, '聖騎士'],
  [12, '勇者'], [16, '傳說勇者'], [20, '腦力賢者'], [30, '不朽英雄'],
];
export function titleFor(lv) {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (lv >= min) t = name;
  return t;
}

export function addExp(amount) {
  const from = save.level;
  save.exp += amount;
  while (save.exp >= expToNext(save.level)) {
    save.exp -= expToNext(save.level);
    save.level += 1;
  }
  return { leveled: save.level > from, from, to: save.level };
}

/* ---------- 遊戲登記表 ----------
   metric: 'time' ＝ 越快越好；'score' ＝ 越高越好
   每個關卡：id / name / label（顯示規模）/ desc / exp / unlock（要先攻略邊關） */
export const CATEGORIES = [
  { id: 'focus',    name: '專注反應', icon: '⚡' },
  { id: 'memory',   name: '記憶力',   icon: '🧠' },
  { id: 'strategy', name: '策略思考', icon: '🗺️' },
  { id: 'life',     name: '生活智慧', icon: '🏮' },
];

export const GAMES = {
  schulte: {
    title: '數觸之戰', icon: '⚔️', category: 'focus', metric: 'time',
    tagline: '順序點數字，擊倒魔像',
    hint: '順序點擊 1 → 2 → 3 …，每點中一下就攻擊魔像！',
    levels: [
      { id: 'easy',   name: '初級', size: 3, desc: '苔岩魔像', enemyName: '苔岩魔像', rock: 0x6f8a62, crystal: 0x7dffa8, stars: [12, 20], exp: 20 },
      { id: 'normal', name: '中級', size: 4, desc: '寒冰魔像', enemyName: '寒冰魔像', rock: 0x7d97b8, crystal: 0x6fe3ff, stars: [30, 50], exp: 35 },
      { id: 'hard',   name: '高級', size: 5, desc: '熔岩魔像', enemyName: '熔岩魔像', rock: 0x4a3a36, crystal: 0xff8a2a, stars: [50, 80], exp: 55 },
      { id: 'boss',   name: '魔王', size: 6, desc: '混沌魔王', enemyName: '混沌魔王', rock: 0x2c2440, crystal: 0xd65cff, stars: [85, 130], exp: 80, unlock: 'hard', boss: true },
    ],
  },
  whack: {
    title: '打怪不打村民', icon: '🔨', category: 'focus', metric: 'score', unit: '分', scoreLabel: '得分',
    tagline: '魔物就打，村民就放過',
    hint: '60 秒內打走窗口出現嘅魔物。小心唔好打中村民！',
    levels: [
      { id: 'easy',   name: '初級', label: '3 個窗', windows: 3, desc: '節奏較慢，熟習操作', interval: [1.5, 1.0], stay: [1.9, 1.4], villager: 0.25, maxUp: 1, exp: 20 },
      { id: 'normal', name: '中級', label: '6 個窗', windows: 6, desc: '同時出現兩隻', interval: [1.3, 0.8], stay: [1.7, 1.2], villager: 0.3, maxUp: 2, exp: 35 },
      { id: 'hard',   name: '高級', label: '9 個窗', windows: 9, desc: '村民更多，速度更快', interval: [1.1, 0.65], stay: [1.5, 1.0], villager: 0.36, maxUp: 2, exp: 55 },
      { id: 'boss',   name: '魔王', label: '9 個窗', windows: 9, desc: '有魔物扮村民，睇清紅眼！', interval: [1.1, 0.65], stay: [1.5, 1.0], villager: 0.32, disguise: 0.25, maxUp: 3, exp: 80, unlock: 'hard' },
    ],
  },
  memory: {
    title: '寶箱記憶', icon: '🎁', category: 'memory', metric: 'time',
    tagline: '記住寶物，配對寶箱',
    hint: '開局寶箱會打開幾秒，記住入面嘅寶物，再逐對揭開相同嘅寶物。',
    levels: [
      { id: 'easy',   name: '初級', label: '3 對', pairs: 3, traps: 0, preview: 4, desc: '6 個寶箱', stars: [15, 30], exp: 20 },
      { id: 'normal', name: '中級', label: '6 對', pairs: 6, traps: 0, preview: 5, desc: '12 個寶箱', stars: [35, 60], exp: 35 },
      { id: 'hard',   name: '高級', label: '8 對', pairs: 8, traps: 0, preview: 6, desc: '16 個寶箱', stars: [50, 85], exp: 55 },
      { id: 'boss',   name: '魔王', label: '9 對', pairs: 9, traps: 2, preview: 7, desc: '混入咬人嘅假寶箱！', stars: [65, 105], exp: 80, unlock: 'hard' },
    ],
  },
  simon: {
    title: '咒文連鎖', icon: '🔮', category: 'memory', metric: 'score', unit: '連鎖', scoreLabel: '最長連鎖',
    tagline: '記住水晶次序，放必殺技',
    hint: '水晶會按次序閃光，照住同一次序點返。連鎖越長，勇者就放必殺技！',
    levels: [
      { id: 'easy',   name: '初級', label: '4 粒水晶', crystals: 4, speed: 0.75, desc: '播放較慢', stars: [8, 5], exp: 20 },
      { id: 'normal', name: '中級', label: '5 粒水晶', crystals: 5, speed: 0.62, desc: '多一粒水晶', stars: [9, 6], exp: 35 },
      { id: 'hard',   name: '高級', label: '6 粒水晶', crystals: 6, speed: 0.5, desc: '播放更快', stars: [10, 7], exp: 55 },
      { id: 'boss',   name: '魔王', label: '倒轉次序', crystals: 5, speed: 0.62, reverse: true, desc: '要倒轉次序點返！', stars: [7, 5], exp: 80, unlock: 'hard' },
    ],
  },
  maze: {
    title: '地下迷宮', icon: '🏰', category: 'strategy', metric: 'time',
    tagline: '穿越迷宮，打開寶箱',
    hint: '用方向掣、滑動或點擊地面，帶勇者去寶箱。',
    levels: [
      { id: 'easy',   name: '初級', size: 7,  gems: 2, fog: false, loops: 2, desc: '小型迷宮，熟習操作', exp: 20 },
      { id: 'normal', name: '中級', size: 10, gems: 3, fog: false, loops: 4, desc: '路線更長更曲折', exp: 35 },
      { id: 'hard',   name: '高級', size: 12, gems: 3, fog: true,  loops: 5, desc: '黑暗中靠火把前進', exp: 55 },
      { id: 'boss',   name: '魔王', size: 15, gems: 4, fog: true,  loops: 8, desc: '巨大又黑暗的魔城', exp: 80, unlock: 'hard' },
    ],
  },
  stroke: {
    title: '一筆畫地城', icon: '👣', category: 'strategy', metric: 'time',
    tagline: '每格行一次，點亮全部符文',
    hint: '每塊地磚都要行過一次，唔可以重複。行錯可以退一步。',
    levels: [
      { id: 'easy',   name: '初級', size: 4, holes: 1, desc: '細小石室', stars: [20, 45], exp: 20 },
      { id: 'normal', name: '中級', size: 5, holes: 2, desc: '多咗石柱阻路', stars: [35, 70], exp: 35 },
      { id: 'hard',   name: '高級', size: 6, holes: 3, desc: '要預早計好路線', stars: [60, 110], exp: 55 },
      { id: 'boss',   name: '魔王', size: 7, holes: 4, desc: '巨大符文大廳', stars: [90, 160], exp: 80, unlock: 'hard' },
    ],
  },
  mahjong: {
    title: '麻雀連連看', icon: '🀄', category: 'strategy', metric: 'time',
    tagline: '連線消除相同麻雀牌',
    hint: '點兩隻相同嘅牌，連線轉彎唔多過兩次就可以消除。清晒全枱就勝利！',
    levels: [
      { id: 'easy',   name: '初級', rows: 4, cols: 4, types: 6,  pool: 'easy',   label: '16 隻牌', desc: '字牌同萬子', stars: [30, 60], exp: 20 },
      { id: 'normal', name: '中級', rows: 5, cols: 6, types: 10, pool: 'normal', label: '30 隻牌', desc: '加入筒子', stars: [70, 130], exp: 35 },
      { id: 'hard',   name: '高級', rows: 6, cols: 7, types: 15, pool: 'all',    label: '42 隻牌', desc: '全副麻雀', stars: [110, 190], exp: 55 },
      { id: 'boss',   name: '魔王', rows: 7, cols: 8, types: 20, pool: 'all',    label: '56 隻牌', desc: '大枱挑戰', stars: [160, 260], exp: 80, unlock: 'hard' },
    ],
  },
  shop: {
    title: '道具店算賬', icon: '💰', category: 'life', metric: 'time',
    tagline: '記住訂單，計啱找續',
    hint: '客人會講要買咩。記住佢，揀好貨品，再計啱價錢同找續。',
    levels: [
      { id: 'easy',   name: '初級', label: '5 位客', kinds: 1, change: false, show: 6, items: 6, desc: '一款貨，計總數', stars: [60, 110], exp: 20 },
      { id: 'normal', name: '中級', label: '5 位客', kinds: 2, change: true,  show: 6, items: 6, desc: '兩款貨，要找續', stars: [100, 170], exp: 35 },
      { id: 'hard',   name: '高級', label: '5 位客', kinds: 3, change: true,  show: 7, items: 8, desc: '三款貨', stars: [130, 210], exp: 55 },
      { id: 'boss',   name: '魔王', label: '5 位客', kinds: 4, change: true,  show: 6, items: 8, desc: '四款貨，記得更快', stars: [160, 250], exp: 80, unlock: 'hard' },
    ],
  },
  idiom: {
    title: '成語石碑', icon: '🏛️', category: 'life', metric: 'time',
    tagline: '補全成語，解開封印',
    hint: '石碑上嘅成語缺咗一個字，喺四塊石入面揀返正確嘅字。',
    levels: [
      { id: 'easy',   name: '初級', label: '8 塊石碑',  count: 8,  tiers: [1],    blanks: 1, desc: '常用成語', stars: [60, 110], exp: 20 },
      { id: 'normal', name: '中級', label: '10 塊石碑', count: 10, tiers: [1, 2], blanks: 1, desc: '熟悉成語', stars: [80, 140], exp: 35 },
      { id: 'hard',   name: '高級', label: '10 塊石碑', count: 10, tiers: [2, 3], blanks: 1, desc: '較深成語', stars: [90, 160], exp: 55 },
      { id: 'boss',   name: '魔王', label: '10 塊石碑', count: 10, tiers: [2, 3], blanks: 2, desc: '每塊缺兩個字', stars: [140, 230], exp: 80, unlock: 'hard' },
    ],
  },
};

export const gameIds = () => CATEGORIES.flatMap(c => Object.keys(GAMES).filter(id => GAMES[id].category === c.id));

export const keyOf = (game, level) => `${game}-${level.id}`;
export const isUnlocked = (game, level) => !level.unlock || save.best[`${game}-${level.unlock}`] != null;
export const sizeLabel = level => level.label || `${level.size}×${level.size}`;

export function starsTotal(game) {
  return GAMES[game].levels.reduce((sum, l) => sum + (save.stars[keyOf(game, l)] || 0), 0);
}
export const starsMax = game => GAMES[game].levels.length * 3;

/* 新紀錄判斷：時間越短越好，分數越高越好 */
export const isBetter = (game, value, prev) => prev == null
  || (GAMES[game].metric === 'score' ? value > prev : value < prev);

/* ---------- 時間格式 ---------- */
export function fmtTime(sec) {
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m} 分 ${String(s).padStart(2, '0')} 秒`;
}
export function fmtTimeHtml(sec) {
  if (sec < 60) return `${sec.toFixed(1)}<small>秒</small>`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}<small>分</small>${String(s).padStart(2, '0')}<small>秒</small>`;
}
export function fmtBest(game, v) {
  const g = GAMES[game];
  return g.metric === 'score' ? `${v} ${g.unit}` : fmtTime(v);
}
