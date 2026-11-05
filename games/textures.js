/* 文字貼圖：數字石磚、麻雀牌面、石碑刻字（CanvasTexture，有快取） */
import { THREE } from './engine.js';

const numberTextures = new Map();
export function numberTexture(n) {
  if (numberTextures.has(n)) return numberTextures.get(n);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const fs = n >= 10 ? 138 : 172;
  // 象牙色 Cinzel 刻字 + 深色描邊（石磚上清楚易讀）
  g.font = `700 ${fs}px Cinzel, "Noto Serif TC", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 18;
  g.strokeStyle = 'rgba(8, 7, 6, .9)';
  g.strokeText(String(n), 128, 134);
  g.fillStyle = '#f4ead2';
  g.fillText(String(n), 128, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  numberTextures.set(n, tex);
  return tex;
}


/* ---------- 麻雀牌面 ---------- */
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
export const MJ_TYPES = [
  ...NUM.map((_, i) => ({ suit: 'm', n: i + 1, name: `${NUM[i]}萬` })),
  ...NUM.map((_, i) => ({ suit: 'p', n: i + 1, name: `${NUM[i]}筒` })),
  ...NUM.map((_, i) => ({ suit: 's', n: i + 1, name: `${NUM[i]}索` })),
  ...HONORS.map((h, i) => ({ suit: 'z', n: i + 1, ch: h, name: i < 4 ? `${h}風` : h === '白' ? '白板' : h })),
];
const SERIF = '"Noto Serif TC", "Noto Sans TC", "PingFang HK", serif';
const DOTS = {
  1: [[.5, .5]],
  2: [[.5, .27], [.5, .73]],
  3: [[.24, .2], [.5, .5], [.76, .8]],
  4: [[.3, .27], [.7, .27], [.3, .73], [.7, .73]],
  5: [[.27, .22], [.73, .22], [.5, .5], [.27, .78], [.73, .78]],
  6: [[.3, .18], [.7, .18], [.3, .5], [.7, .5], [.3, .82], [.7, .82]],
  7: [[.2, .13], [.5, .24], [.8, .35], [.3, .6], [.7, .6], [.3, .86], [.7, .86]],
  8: [[.3, .13], [.7, .13], [.3, .38], [.7, .38], [.3, .62], [.7, .62], [.3, .87], [.7, .87]],
  9: [[.2, .17], [.5, .17], [.8, .17], [.2, .5], [.5, .5], [.8, .5], [.2, .83], [.5, .83], [.8, .83]],
};
const MJ_W = 160, MJ_H = 208, PAD = 18;

function drawMahjong(g, t) {
  g.clearRect(0, 0, MJ_W, MJ_H);
  g.fillStyle = '#fbf6e6';
  g.fillRect(0, 0, MJ_W, MJ_H);
  const bx = PAD, by = PAD, bw = MJ_W - PAD * 2, bh = MJ_H - PAD * 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (t.suit === 'm') {
    g.fillStyle = '#16213e';
    g.font = `900 66px ${SERIF}`;
    g.fillText(NUM[t.n - 1], MJ_W / 2, by + bh * 0.27);
    g.fillStyle = '#c8102e';
    g.font = `900 78px ${SERIF}`;
    g.fillText('萬', MJ_W / 2, by + bh * 0.73);
  } else if (t.suit === 'p') {
    const pts = DOTS[t.n];
    const r = t.n === 1 ? 50 : t.n <= 4 ? 24 : t.n <= 6 ? 20 : 17;
    pts.forEach(([x, y], i) => {
      const cx = bx + x * bw, cy = by + y * bh;
      const red = (t.n === 1) || (t.n === 5 && i === 2) || (t.n === 9 && i >= 3 && i <= 5) || (t.n === 7 && i < 3);
      const col = red ? '#c8102e' : (i % 2 ? '#1f7a3a' : '#1d4fa3');
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbf6e6';
      g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, cy, r * 0.3, 0, Math.PI * 2); g.fill();
    });
  } else if (t.suit === 's') {
    if (t.n === 1) {
      // 一索：粗身竹 + 紅頂
      g.fillStyle = '#1f7a3a';
      g.fillRect(MJ_W / 2 - 16, by + 10, 32, bh - 20);
      g.fillStyle = '#c8102e';
      g.beginPath(); g.arc(MJ_W / 2, by + 18, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbf6e6';
      [0.42, 0.66].forEach(k => g.fillRect(MJ_W / 2 - 16, by + bh * k, 32, 5));
    } else {
      const pts = DOTS[t.n];
      const h = t.n <= 3 ? 64 : t.n <= 6 ? 50 : 40;
      pts.forEach(([x, y], i) => {
        const cx = bx + x * bw, cy = by + y * bh;
        const red = (t.n === 5 && i === 2) || (t.n === 7 && i === 0) || (t.n === 9 && i >= 3 && i <= 5);
        g.fillStyle = red ? '#c8102e' : '#1f7a3a';
        g.beginPath();
        g.roundRect ? g.roundRect(cx - 8, cy - h / 2, 16, h, 7) : g.rect(cx - 8, cy - h / 2, 16, h);
        g.fill();
        g.fillStyle = '#fbf6e6';
        g.fillRect(cx - 8, cy - 2, 16, 4);
      });
    }
  } else if (t.ch === '白') {
    g.strokeStyle = '#1d4fa3';
    g.lineWidth = 9;
    g.strokeRect(bx + 14, by + 18, bw - 28, bh - 36);
  } else {
    g.fillStyle = t.ch === '中' ? '#c8102e' : t.ch === '發' ? '#1f7a3a' : '#16213e';
    g.font = `900 120px ${SERIF}`;
    g.fillText(t.ch, MJ_W / 2, MJ_H / 2 + 4);
  }
}

const mjCache = new Map();
export function mahjongTexture(typeIdx) {
  if (mjCache.has(typeIdx)) return mjCache.get(typeIdx).tex;
  const c = document.createElement('canvas');
  c.width = MJ_W;
  c.height = MJ_H;
  const g = c.getContext('2d');
  drawMahjong(g, MJ_TYPES[typeIdx]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  mjCache.set(typeIdx, { tex, g });
  return tex;
}
/* 字型載入完先重畫（Google Fonts 按字分批下載） */
let mjFontsReady = null;
export function ensureMahjongFonts() {
  if (!mjFontsReady) {
    mjFontsReady = (document.fonts ? document.fonts.load(`900 80px ${SERIF}`, '一二三四五六七八九萬東南西北中發') : Promise.resolve())
      .catch(() => {})
      .then(() => {
        mjCache.forEach(({ tex, g }, i) => { drawMahjong(g, MJ_TYPES[i]); tex.needsUpdate = true; });
      });
  }
  return mjFontsReady;
}
