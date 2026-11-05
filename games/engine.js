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

/* ---------- 3D 模型截圖（道具店貨品圖示）：用主 renderer 畫落 render target，轉做 PNG ---------- */
let snapRenderer = null;
const snapCache = new Map();
const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function snapshot(key, build, size = 128) {
  if (snapCache.has(key)) return snapCache.get(key);
  const r = snapRenderer;
  if (!r) return '';
  const S = size * 2;   // 畫大一倍再縮細＝反鋸齒
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a3040, 1.6));
  const key1 = new THREE.DirectionalLight(0xfff0dc, 2.0);
  key1.position.set(-2, 3, 4);
  scene.add(key1);
  const rim = new THREE.DirectionalLight(0xc9d6ff, 0.9);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const obj = build();
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
  cam.position.copy(sphere.center).add(new THREE.Vector3(0, 0.3, 1).normalize().multiplyScalar(dist));
  cam.lookAt(sphere.center);
  const rt = new THREE.WebGLRenderTarget(S, S);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const buf = new Uint8Array(S * S * 4);
  const prevTarget = r.getRenderTarget();
  const prevColor = r.getClearColor(new THREE.Color());
  const prevAlpha = r.getClearAlpha();
  try {
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, cam);
    r.readRenderTargetPixels(rt, 0, 0, S, S, buf);
  } catch (e) {
    return '';
  } finally {
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevColor, prevAlpha);
    rt.dispose();
    obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  // 上下倒轉 + 半透明邊位還原（premultiplied → straight alpha）
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const bg = big.getContext('2d');
  const img = bg.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    const src = (S - 1 - y) * S * 4, dst = y * S * 4;
    for (let x = 0; x < S * 4; x += 4) {
      const a = buf[src + x + 3];
      for (let k = 0; k < 3; k++) {
        let v = buf[src + x + k];
        if (a > 0 && a < 255) v = Math.round(linToSrgb(Math.min(1, srgbToLin(v / 255) * 255 / a)) * 255);
        img.data[dst + x + k] = v;
      }
      img.data[dst + x + 3] = a;
    }
  }
  bg.putImageData(img, 0, 0);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(big, 0, 0, size, size);
  const url = c.toDataURL('image/png');
  snapCache.set(key, url);
  return url;
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    snapRenderer = this.renderer;
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
    // 對決擂台：一個場景畫兩次（兩邊玩家各自方向）
    if (this.view.render) this.view.render(this.renderer, this.w, this.h);
    else this.renderer.render(this.view.scene, this.view.camera);
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
