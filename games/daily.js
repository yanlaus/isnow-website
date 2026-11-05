/* 每日任務（按日期固定抽三個）、連續出戰獎勵、印章簿資料 */
import { save, persist, dayKey, addDays, addGold, GAMES, streakDays } from './store.js';

/* 由日期決定嘅亂數：同一日開幾多次都係同一組任務 */
function rngFor(day) {
  let a = day ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAT_NAMES = { focus: '專注反應', memory: '記憶力', strategy: '策略思考', life: '生活智慧' };
const POOL = {
  plays: [
    { id: 'play2', text: '完成任何 2 局', goal: 2, reward: 20, test: () => true },
    { id: 'play3', text: '完成任何 3 局', goal: 3, reward: 30, test: () => true },
  ],
  extra: [
    ...Object.keys(CAT_NAMES).map(c => ({ id: `cat-${c}`, text: `玩一局「${CAT_NAMES[c]}」遊戲`, goal: 1, reward: 20, test: e => e.category === c })),
    { id: 'stars3', text: '喺任何遊戲攞 3 粒星', goal: 1, reward: 30, test: e => e.stars >= 3 },
    { id: 'stars2x2', text: '兩局都攞 2 粒星或以上', goal: 2, reward: 30, test: e => e.stars >= 2 },
    { id: 'record', text: '打破一項個人紀錄', goal: 1, reward: 40, test: e => e.isRecord && !e.firstClear },
    { id: 'newlevel', text: '挑戰一個未玩過嘅難度', goal: 1, reward: 30, test: e => e.firstClear },
  ],
};
const ALL = [...POOL.plays, ...POOL.extra];
const FEATURED = { id: 'featured', goal: 1, reward: 30 };

export const COMPLETE_BONUS = 50;

function generate(day, gameIds) {
  const rnd = rngFor(day);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const game = pick(gameIds);
  const extra = pick(POOL.extra);
  return {
    day,
    featured: game,
    bonus: false,
    quests: [
      { id: pick(POOL.plays).id, n: 0, done: false },
      { id: FEATURED.id, game, n: 0, done: false },
      { id: extra.id, n: 0, done: false },
    ],
  };
}

let gameList = Object.keys(GAMES);
export function setGameList(ids) { gameList = ids; }

export function today() {
  const day = dayKey();
  if (!save.daily || save.daily.day !== day) {
    save.daily = generate(day, gameList);
    persist();
  }
  return save.daily;
}

const def = q => (q.id === FEATURED.id ? FEATURED : ALL.find(d => d.id === q.id));
export function questText(q) {
  if (q.id === FEATURED.id) return `玩今日推介「${GAMES[q.game] ? GAMES[q.game].title : ''}」`;
  return def(q).text;
}
export const questGoal = q => def(q).goal;
export const questReward = q => def(q).reward;

/* 每局完結時記錄：e = { game, category, stars, isRecord, firstClear, firstToday }
   回傳今次完成咗嘅任務同獎勵，俾結算畫面顯示 */
export function recordPlay(e) {
  const d = today();
  const done = [];
  let gold = 0;
  for (const q of d.quests) {
    if (q.done) continue;
    const df = def(q);
    const ok = q.id === FEATURED.id ? e.game === q.game : df.test(e);
    if (!ok) continue;
    q.n += 1;
    if (q.n >= df.goal) {
      q.done = true;
      gold += df.reward;
      done.push({ text: questText(q), reward: df.reward });
    }
  }
  let bonus = 0;
  if (!d.bonus && d.quests.every(q => q.done)) {
    d.bonus = true;
    bonus = COMPLETE_BONUS;
  }
  // 連續出戰：每日第一局先計
  let streakBonus = 0;
  let streak = 0;
  if (e.firstToday) {
    streak = streakDays();
    if (streak > 0 && streak % 7 === 0) streakBonus = 60;
    else if (streak === 3) streakBonus = 20;
  }
  addGold(gold + bonus + streakBonus);
  persist();
  return { done, bonus, streak, streakBonus, gold: gold + bonus + streakBonus };
}

/* 印章簿：最近 4 個星期（星期一開始），每格 { day, n, today, future } */
export function stampWeeks(now = new Date()) {
  const dow = (now.getDay() + 6) % 7;            // 星期一 = 0
  const start = addDays(now, -dow - 21);
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      const k = dayKey(d);
      row.push({ date: d, n: save.days[k] || 0, today: k === dayKey(now), future: d > now });
    }
    weeks.push(row);
  }
  return weeks;
}
