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
    this.view.update(dt, now / 1000);
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
