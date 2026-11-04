/* 特效：光暈貼圖、漸變背景、火花粒子、星空、餘燼 */
import { THREE } from './engine.js';

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let shadowTex = null;
export function blobShadow(size = 0.8, opacity = 0.45) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  return m;
}

/* 垂直漸變，用做 scene.background */
export function gradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeGlow(color, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

/* 火花粒子池：加法混色，顏色漸暗＝淡出 */
export class Sparks {
  constructor(parent, { cap = 500, size = 0.2 } = {}) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.base = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.material = new THREE.PointsMaterial({
      size, map: glowTexture(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    parent.add(this.points);
  }

  spawn(origin, { count = 20, color = 0xffd56a, speed = 3, life = 0.7, gravity = 6, up = 1.2, spread = 1 } = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (i + 1) % this.cap;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const v = speed * (0.35 + Math.random() * 0.65);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * v * spread;
      this.vel[i * 3 + 1] = Math.cos(ph) * v + up;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v * spread;
      this.pos[i * 3] = origin.x;
      this.pos[i * 3 + 1] = origin.y;
      this.pos[i * 3 + 2] = origin.z;
      const l = life * (0.55 + Math.random() * 0.45);
      this.life[i] = l;
      this.max[i] = l;
      this.grav[i] = gravity;
      this.base[i * 3] = c.r;
      this.base[i * 3 + 1] = c.g;
      this.base[i * 3 + 2] = c.b;
    }
  }

  update(dt) {
    const damp = Math.max(0, 1 - dt * 1.6);
    for (let i = 0; i < this.cap; i++) {
      const o = i * 3;
      if (this.life[i] <= 0) {
        this.col[o] = this.col[o + 1] = this.col[o + 2] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[o + 1] -= this.grav[i] * dt;
      this.vel[o] *= damp; this.vel[o + 1] *= damp; this.vel[o + 2] *= damp;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.col[o] = this.base[o] * k;
      this.col[o + 1] = this.base[o + 1] * k;
      this.col[o + 2] = this.base[o + 2] * k;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}

/* 遠景星空 */
export function starField(count = 600, radius = 80, minY = -0.2) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = Math.random() * Math.PI * 2;
    const y = minY + Math.random() * (1 - minY);
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * r * radius;
    pos[i * 3 + 1] = y * radius;
    pos[i * 3 + 2] = Math.sin(th) * r * radius;
    const b = 0.5 + Math.random() * 0.5;
    const warm = Math.random() < 0.2;
    col[i * 3] = b;
    col[i * 3 + 1] = b * (warm ? 0.85 : 0.95);
    col[i * 3 + 2] = b * (warm ? 0.6 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, map: glowTexture(), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pts.frustumCulled = false;
  return pts;
}

/* 慢慢上升嘅餘燼／光塵 */
export class Embers {
  constructor(parent, { count = 60, box = [12, 8, 6], center = [0, 0, 0], color = 0xff9a4d, size = 0.12, speed = 0.5 } = {}) {
    this.count = count;
    this.box = box;
    this.center = center;
    this.speed = speed;
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = center[0] + (Math.random() - 0.5) * box[0];
      this.pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * box[1];
      this.pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * box[2];
      this.seed[i] = Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, color, map: glowTexture(), transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    parent.add(this.points);
  }

  update(dt, t) {
    const [bx, by] = this.box;
    const top = this.center[1] + by / 2;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.pos[o + 1] += this.speed * dt * (0.6 + (this.seed[i] % 1));
      this.pos[o] += Math.sin(t * 0.8 + this.seed[i]) * dt * 0.15;
      if (this.pos[o + 1] > top) {
        this.pos[o + 1] = this.center[1] - by / 2;
        this.pos[o] = this.center[0] + (Math.random() - 0.5) * bx;
      }
    }
    this.attr.needsUpdate = true;
  }
}
