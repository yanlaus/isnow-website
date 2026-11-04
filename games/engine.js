/* 渲染引擎：一個全螢幕 WebGL canvas，按畫面切換 view */
import * as THREE from '../vendor/three/three.module.min.js';

export { THREE };

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (_) {
    return false;
  }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;   // 打怪：角色由窗台下面升起
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;
    this.view = null;
    this.last = 0;
    this.slow = 0;
    this.w = 1;
    this.h = 1;
    this.loop = this.loop.bind(this);
    this.resize();
    requestAnimationFrame(this.loop);
  }

  setView(view) {
    this.view = view;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    if (this.view) this.view.resize(w, h);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    // 舊機跑唔順就自動降低解像度
    if (dt > 0.03) this.slow += 1; else this.slow = Math.max(0, this.slow - 1);
    if (this.slow > 40 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.5);
      this.slow = 0;
      this.resize();
    }
    if (!this.view) return;
    // 暫停時（撤退確認視窗）遊戲邏輯停低，畫面照畫
    this.view.update(this.view.paused ? 0 : dt, now / 1000);
    this.renderer.render(this.view.scene, this.view.camera);
  }
}

/* 將 DOM 元素位置轉成 {cx, cy, width, height}（CSS px） */
export function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const easeOutBack = t => { const c = 1.70158; const x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/* 由 update(dt) 推動嘅計時器：暫停、切走 App 時自動停低 */
export class Scheduler {
  constructor() { this.list = []; }
  after(sec, fn) { this.list.push({ t: sec, fn }); }
  clear() { this.list = []; }
  update(dt) {
    if (!this.list.length) return;
    const due = [];
    this.list = this.list.filter(it => {
      it.t -= dt;
      if (it.t <= 0) { due.push(it.fn); return false; }
      return true;
    });
    due.forEach(fn => fn());
  }
}

/* 二分法搵鏡頭距離：pts 全部投影入 rect（CSS px）。dir＝由 target 指向鏡頭嘅單位向量 */
export function fitCameraDistance(camera, target, dir, pts, rect, W, H, margin = 6) {
  const v = new THREE.Vector3();
  let lo = 0.5, hi = 150;
  for (let it = 0; it < 28; it++) {
    const d = (lo + hi) / 2;
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let ok = true;
    for (const p of pts) {
      v.copy(p).project(camera);
      const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
      if (px < rect.left + margin || px > rect.left + rect.width - margin
        || py < rect.top + margin || py > rect.top + rect.height - margin) { ok = false; break; }
    }
    if (ok) hi = d; else lo = d;
  }
  camera.position.copy(target).addScaledVector(dir, hi);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return hi;
}

/* 令鏡頭中心對準 HTML 區域中心 */
export function centerOnRect(camera, rect, W, H) {
  camera.setViewOffset(W, H, W / 2 - rect.cx, H / 2 - rect.cy, W, H);
  camera.updateProjectionMatrix();
}

/* 3D 點 → 螢幕座標（CSS px） */
const _p = new THREE.Vector3();
export function toScreen(obj3dOrVec, camera, W, H, out = {}) {
  if (obj3dOrVec.isObject3D) obj3dOrVec.getWorldPosition(_p); else _p.copy(obj3dOrVec);
  _p.project(camera);
  out.x = (_p.x + 1) / 2 * W;
  out.y = (1 - _p.y) / 2 * H;
  return out;
}

/* 螢幕空間揀最近嘅目標（對長者寬鬆：唔使準確點中模型） */
export function pickNearest(items, getPoint, x, y, camera, W, H, maxPx) {
  let best = null, bestD = maxPx;
  const s = {};
  for (const it of items) {
    toScreen(getPoint(it), camera, W, H, s);
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
