/* 主選單：浮空島上嘅勇者，鏡頭慢慢環繞 */
import { THREE } from './engine.js';
import { gradientTexture, starField, Embers } from './fx.js';
import { createHero, createChest, createTorch, createCrystal, createIsland } from './models.js';

const FOV = 38;

function createCloud(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe9e4ff, roughness: 1, flatShading: true, transparent: true, opacity: 0.88 });
  [[0, 0, 0, 0.7], [0.65, 0.05, 0.1, 0.5], [-0.6, -0.05, 0, 0.55], [0.2, 0.3, -0.1, 0.5]].forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    m.position.set(x, y, z);
    g.add(m);
  });
  g.scale.set(scale * 1.4, scale * 0.7, scale);
  return g;
}

export class MenuView {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#0a1638', '#1b1d52', '#3a2150', '#1a0f2a']);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);

    this.scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x3a2a4a, 1.4));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.position.set(5, 8, 6);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8f7bff, 1.6);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);
    this.scene.add(starField(700, 90, -0.3));

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.root.add(createIsland().group);

    this.hero = createHero();
    this.hero.group.scale.setScalar(1.45);
    this.hero.group.position.set(0, 0, 0.3);
    this.root.add(this.hero.group);

    this.chest = createChest();
    this.chest.group.position.set(1.25, 0, -0.55);
    this.chest.group.rotation.y = -0.5;
    this.chest.group.scale.setScalar(1.15);
    this.root.add(this.chest.group);

    this.torch = createTorch({ light: true, height: 1.25 });
    this.torch.group.position.set(-1.35, 0, -0.65);
    this.root.add(this.torch.group);

    this.crystals = [[0xffd56a, 0.4], [0x6fe3ff, 2.4], [0xd65cff, 4.4]].map(([c, a], i) => {
      const cr = createCrystal(c);
      cr.group.position.set(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3);
      cr.group.userData.baseY = 0.6 + i * 0.45;
      this.root.add(cr.group);
      return cr;
    });

    this.clouds = [[-3.2, -2.6, 1.5, 1.1], [3.4, -3.2, -1, 1.3], [0.5, -3.9, 2.8, 0.9], [-2.5, -3.6, -2.4, 1]].map(([x, y, z, s]) => {
      const c = createCloud(s);
      c.position.set(x, y, z);
      c.userData.base = c.position.clone();
      this.root.add(c);
      return c;
    });

    this.embers = new Embers(this.scene, { count: 50, box: [9, 6, 9], center: [0, 0.5, 0], color: 0xffe08a, size: 0.12, speed: 0.35 });

    this.angle = 0.35;
    this.W = 1;
    this.H = 1;
    this.dist = 14;
    this.look = new THREE.Vector3(0, -0.7, 0);
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRect(r) {
    this.rect = r;
    this.layout();
  }

  layout() {
    const r = this.rect;
    if (!r) return;
    const { W, H } = this;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const ppw = Math.min(r.width / 8.2, r.height / 6.4);
    this.dist = H / (2 * tanHalf * Math.max(ppw, 1));
    this.camera.setViewOffset(W, H, W / 2 - r.cx, H / 2 - r.cy, W, H);
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    if (!this.reduced) this.angle += dt * 0.12;
    const a = this.angle;
    this.camera.position.set(Math.sin(a) * this.dist, this.dist * 0.3, Math.cos(a) * this.dist);
    this.camera.lookAt(this.look);
    this.hero.group.rotation.y = a * 0.9;
    this.hero.update(dt, t, 0);
    this.chest.update(dt, t);
    this.torch.update(dt, t);
    this.crystals.forEach(c => c.update(dt, t));
    this.clouds.forEach((c, i) => {
      c.position.x = c.userData.base.x + Math.sin(t * 0.2 + i) * 0.4;
    });
    this.root.position.y = Math.sin(t * 0.6) * 0.08;
    this.embers.update(dt, t);
  }
}
