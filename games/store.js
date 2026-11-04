/* 存檔、關卡設定、等級與稱號 */

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

/* ---------- 關卡 ---------- */
// rock / crystal：魔像嘅石色同水晶色
export const SCHULTE_LEVELS = [
  { id: 'easy',   name: '初級', size: 3, enemyName: '苔岩魔像', rock: 0x6f8a62, crystal: 0x7dffa8, stars: [12, 20], exp: 20 },
  { id: 'normal', name: '中級', size: 4, enemyName: '寒冰魔像', rock: 0x7d97b8, crystal: 0x6fe3ff, stars: [30, 50], exp: 35 },
  { id: 'hard',   name: '高級', size: 5, enemyName: '熔岩魔像', rock: 0x4a3a36, crystal: 0xff8a2a, stars: [50, 80], exp: 55 },
  { id: 'boss',   name: '魔王', size: 6, enemyName: '混沌魔王', rock: 0x2c2440, crystal: 0xd65cff, stars: [85, 130], exp: 80, unlock: 'hard', boss: true },
];

export const MAZE_LEVELS = [
  { id: 'easy',   name: '初級', size: 7,  gems: 2, fog: false, loops: 2, desc: '小型迷宮，熟習操作', exp: 20 },
  { id: 'normal', name: '中級', size: 10, gems: 3, fog: false, loops: 4, desc: '路線更長更曲折', exp: 35 },
  { id: 'hard',   name: '高級', size: 12, gems: 3, fog: true,  loops: 5, desc: '黑暗中靠火把前進', exp: 55 },
  { id: 'boss',   name: '魔王', size: 15, gems: 4, fog: true,  loops: 8, desc: '巨大又黑暗的魔城', exp: 80, unlock: 'hard' },
];

export const GAMES = {
  schulte: { title: '數觸之戰', icon: '⚔️', levels: SCHULTE_LEVELS, hint: '順序點擊 1 → 2 → 3 …，每點中一下就攻擊魔像！' },
  maze:    { title: '地下迷宮', icon: '🏰', levels: MAZE_LEVELS,    hint: '用方向掣、滑動或點擊地面，帶勇者去寶箱。' },
};

export const keyOf = (game, level) => `${game}-${level.id}`;
export const isUnlocked = (game, level) => !level.unlock || save.best[`${game}-${level.unlock}`] != null;
export const sizeLabel = level => `${level.size}×${level.size}`;

export function starsTotal(game) {
  return GAMES[game].levels.reduce((sum, l) => sum + (save.stars[keyOf(game, l)] || 0), 0);
}

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
