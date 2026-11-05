/* 戰績圖：1080×1350 直向 PNG（啱 WhatsApp），勇者用 3D 模型截圖 */
import { snapshot } from './engine.js';
import { createHero } from './models.js';

const W = 1080, H = 1350;
const SERIF = '"Noto Serif TC", "Songti TC", serif';
const NUM = 'Cinzel, "Noto Serif TC", Georgia, serif';
const SANS = '"Noto Sans TC", "PingFang HK", sans-serif';

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function diamond(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y);
  g.closePath();
  g.fill();
}
/* 一行入面數字用 Cinzel、中文用細啲嘅無襯線字，整體置中 */
function drawMixed(g, text, cx, y, numFont, cjkFont, numColor, cjkColor) {
  const parts = String(text).split(/(\d+(?:\.\d+)?)/).filter(Boolean).map(t => ({ t, num: /^\d/.test(t) }));
  let total = 0;
  parts.forEach(p => { g.font = p.num ? numFont : cjkFont; p.w = g.measureText(p.t).width; total += p.w; });
  let x = cx - total / 2;
  g.textAlign = 'left';
  parts.forEach(p => {
    g.font = p.num ? numFont : cjkFont;
    g.fillStyle = p.num ? numColor : cjkColor;
    g.fillText(p.t, x, y);
    x += p.w;
  });
  g.textAlign = 'center';
}
function spaced(g, text, cx, y, gap) {
  const chars = [...text];
  const widths = chars.map(c => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = 'left';
  chars.forEach((c, i) => { g.fillText(c, x, y); x += widths[i] + gap; });
  g.textAlign = 'center';
}

/* info: { gameTitle, levelName, resultTitle, label, value, stars, note, lv, playerTitle, date, heroKey, buildHero } */
export async function makeShareCard(info) {
  const all = [info.gameTitle, info.levelName, info.resultTitle, info.label, info.value, info.note, info.playerTitle, info.date, '腦力勇者每日一戰鍛鍊專注力與記憶力・★'].join('');
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`900 100px ${SERIF}`, all),
      document.fonts.load(`700 40px ${SANS}`, all),
      document.fonts.load(`700 100px ${NUM}`, '0123456789.BRAINQUESTLv'),
    ]).catch(() => {});
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  // 底色 + 勇者背後光暈
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1b2250');
  bg.addColorStop(0.55, '#10152e');
  bg.addColorStop(1, '#080b16');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W / 2, 520, 30, W / 2, 520, 400);
  halo.addColorStop(0, 'rgba(201,162,74,.30)');
  halo.addColorStop(1, 'rgba(201,162,74,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);

  // 金色雙框 + 四角菱形
  g.strokeStyle = '#c9a24a';
  g.lineWidth = 6;
  roundRect(g, 36, 36, W - 72, H - 72, 22);
  g.stroke();
  g.strokeStyle = 'rgba(201,162,74,.38)';
  g.lineWidth = 2;
  roundRect(g, 56, 56, W - 112, H - 112, 14);
  g.stroke();
  g.fillStyle = '#c9a24a';
  [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]].forEach(([x, y]) => diamond(g, x, y, 13));

  // 標題
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#c9a24a';
  g.font = `600 30px ${NUM}`;
  spaced(g, 'BRAIN QUEST', W / 2, 128, 14);
  const gold = g.createLinearGradient(0, 140, 0, 250);
  gold.addColorStop(0, '#f7ecc8');
  gold.addColorStop(0.5, '#e2c27a');
  gold.addColorStop(1, '#a67c2e');
  g.fillStyle = gold;
  g.font = `900 112px ${SERIF}`;
  spaced(g, '腦力勇者', W / 2, 242, 18);
  g.strokeStyle = 'rgba(201,162,74,.6)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2 - 230, 282); g.lineTo(W / 2 - 22, 282); g.moveTo(W / 2 + 22, 282); g.lineTo(W / 2 + 230, 282); g.stroke();
  g.fillStyle = '#c9a24a';
  diamond(g, W / 2, 282, 10);

  // 勇者
  const heroUrl = snapshot(info.heroKey || 'share-hero', () => {
    const h = info.buildHero ? info.buildHero() : createHero();
    h.group.rotation.y = 0.4;
    return h.group;
  }, 480);
  if (heroUrl) {
    try { g.drawImage(await loadImg(heroUrl), W / 2 - 240, 300, 480, 480); } catch (_) { /* 冇勇者圖都照出 */ }
  }

  // 遊戲、難度、評語
  g.fillStyle = '#ecd9a4';
  g.font = `900 66px ${SERIF}`;
  g.fillText(info.gameTitle, W / 2, 852);
  g.fillStyle = '#c7bfae';
  g.font = `700 36px ${SANS}`;
  g.fillText(`${info.levelName}・${info.resultTitle}`, W / 2, 908);

  // 星
  g.font = `76px ${SERIF}`;
  [-1, 0, 1].forEach((k, i) => {
    g.fillStyle = i < info.stars ? '#e2c27a' : 'rgba(201,162,74,.22)';
    g.fillText('★', W / 2 + k * 96, 1000);
  });

  // 成績
  g.fillStyle = '#b3ab9c';
  g.font = `700 32px ${SANS}`;
  g.fillText(info.label, W / 2, 1056);
  drawMixed(g, info.value, W / 2, 1160, `700 118px ${NUM}`, `700 46px ${SANS}`, '#f3e6c4', '#c7bfae');
  if (info.note) {
    g.fillStyle = '#9fd4b0';
    g.font = `700 36px ${SANS}`;
    g.fillText(info.note, W / 2, 1218);
  }

  // 底部
  g.fillStyle = '#b3ab9c';
  g.font = `700 30px ${SANS}`;
  g.fillText(`Lv ${info.lv} ${info.playerTitle}・${info.date}`, W / 2, 1270);

  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  return { blob, url: c.toDataURL('image/png') };
}
