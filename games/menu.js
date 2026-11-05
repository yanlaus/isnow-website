/* 主選單：黃昏山崖上嘅騎士，遠方城堡、山巒、霧氣；鏡頭緩緩移動 */
import { THREE, centerOnRect, fitCameraDistance } from './engine.js';
import { gradientTexture, starField, Embers, makeGlow } from './fx.js';
import { createHero, createTorch } from './models.js';
import { heroGear } from './gear.js';

const FOV = 36;
const flat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...opts });

function mountain(r, h, color, seg = 5) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), flat(color));
  m.rotation.y = Math.random() * Math.PI;
  return m;
}

/* 遠方城堡剪影（窗口有燈） */
function createCastle() {
  const g = new THREE.Group();
  const stone = flat(0x1e1c36);
  const roof = flat(0x2a2246);
  const win = new THREE.MeshBasicMaterial({ color: 0xffc46a, fog: false });
  const tower = (x, z, r, h) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 8), stone);
    t.position.set(x, h / 2, z);
    g.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, h * 0.45, 8), roof);
    c.position.set(x, h + h * 0.22, z);
    g.add(c);
    for (let k = 0; k < 2; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.35, r * 0.55), win);
      w.position.set(x, h * (0.55 + k * 0.22), z + r * 1.02);
      g.add(w);
    }
  };
  const wall = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 1.2), stone);
  wall.position.set(0, 1.1, 0);
  g.add(wall);
  for (let k = -3; k <= 3; k++) {
    const cren = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 1.2), stone);
    cren.position.set(k * 1.0, 2.4, 0);
    g.add(cren);
  }
  tower(-3.6, 0, 0.9, 4.4);
  tower(3.6, 0, 0.9, 4.4);
  tower(0, -1.2, 1.2, 6.5);
  tower(-1.6, -0.6, 0.6, 5.2);
  tower(1.8, -0.8, 0.55, 4.8);
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), win);
  gate.position.set(0, 0.6, 0.61);
  g.add(gate);
  return g;
}

export class MenuView {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(['#0a1030', '#1c1c46', '#3d2a52', '#7a3f4e', '#c4704a']);
    this.scene.fog = new THREE.Fog(0x3d2a52, 18, 70);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

    this.scene.add(new THREE.HemisphereLight(0x9fa8d0, 0x2a1a20, 1.0));
    const dusk = new THREE.DirectionalLight(0xffb27a, 2.6);   // 背後夕陽：輪廓光
    dusk.position.set(8, 5, -12);
    this.scene.add(dusk);
    const fill = new THREE.DirectionalLight(0x9aa6d8, 1.5);   // 鏡頭方向補光，睇清勇者正面
    fill.position.set(3, 5, 10);
    this.scene.add(fill);

    const stars = starField(500, 150, 0.15);
    stars.material.size = 2;
    stars.material.fog = false;
    this.scene.add(stars);
    // 月亮
    const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0xf3e6c4, fog: false }));
    moon.position.set(-12, 15, -70);
    this.scene.add(moon);
    const moonGlow = makeGlow(0xf3d9a0, 16, 0.35);
    moonGlow.material.fog = false;
    moonGlow.position.copy(moon.position).add(new THREE.Vector3(0, 0, 0.5));
    this.scene.add(moonGlow);

    // 山巒（三層，越遠越淡）
    [[-30, -55, 14, 16, 0x2c2a52], [-8, -60, 18, 20, 0x2c2a52], [22, -58, 16, 17, 0x2c2a52],
      [-18, -40, 10, 11, 0x24223f], [12, -42, 11, 12, 0x24223f], [34, -40, 9, 10, 0x24223f],
      [-26, -26, 7, 6, 0x1c1a30], [26, -24, 8, 7, 0x1c1a30]].forEach(([x, z, r, h, c]) => {
      const m = mountain(r, h, c);
      m.position.set(x, h / 2 - 3.5, z);
      this.scene.add(m);
    });
    // 城堡山丘
    const hill = mountain(9, 5, 0x1a1830, 7);
    hill.position.set(11, -1.5, -30);
    this.scene.add(hill);
    const castle = createCastle();
    castle.position.set(11, 0.6, -30);
    castle.rotation.y = -0.35;
    this.scene.add(castle);

    // 前景：石崖
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.4, 7), flat(0x45414e));
    cliff.position.y = -0.7;
    this.root.add(cliff);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.08, 7), flat(0x2e3a2e));
    top.position.y = 0.0;
    this.root.add(top);
    const rockMat = flat(0x5a5562);
    [[-1.9, 0.9, 0.35], [1.7, 1.2, 0.28], [0.9, -1.8, 0.42], [-1.2, -1.6, 0.3], [2.2, -0.4, 0.22]].forEach(([x, z, r]) => {
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(r), rockMat);
      rk.position.set(x, r * 0.5, z);
      rk.rotation.set(Math.random(), Math.random(), Math.random());
      this.root.add(rk);
    });
    // 斷柱 + 火盆
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.5, 8), flat(0x6a6474));
    pillar.position.set(-1.55, 0.75, -0.7);
    this.root.add(pillar);
    const pillarCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), flat(0x7a7484));
    pillarCap.position.set(-1.55, 1.55, -0.7);
    this.root.add(pillarCap);
    this.brazier = createTorch({ light: true, height: 0.25 });
    this.brazier.group.position.set(-1.55, 1.55, -0.7);
    this.brazier.group.scale.setScalar(1.6);
    this.root.add(this.brazier.group);
    // 軍旗
    const poleMat = flat(0x3a2a1c);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.9, 6), poleMat);
    pole.position.set(1.45, 1.45, -0.5);
    this.root.add(pole);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), poleMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(1.45, 2.75, -0.5);
    this.root.add(bar);
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), flat(0xc9a24a, { metalness: 0.7, roughness: 0.3 }));
    finial.position.set(1.45, 2.95, -0.5);
    this.root.add(finial);
    const flagGeo = new THREE.PlaneGeometry(0.7, 1.15, 6, 8);
    flagGeo.translate(0, -0.575, 0);
    this.flag = new THREE.Mesh(flagGeo, flat(0x7a1f27, { side: THREE.DoubleSide, roughness: 0.85 }));
    this.flag.position.set(1.45, 2.74, -0.48);
    this.root.add(this.flag);
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), flat(0xc9a24a, { metalness: 0.6, roughness: 0.35 }));
    emblem.scale.z = 0.2;
    this.flag.add(emblem);
    emblem.position.set(0, -0.5, 0.02);
    this.flagBase = flagGeo.attributes.position.array.slice();

    // 勇者
    this.hero = createHero(heroGear());
    this.placeHero();

    this.embers = new Embers(this.scene, { count: 40, box: [5, 3.5, 3], center: [-1, 2.2, -0.4], color: 0xffb060, size: 0.08, speed: 0.45 });
    this.motes = new Embers(this.scene, { count: 30, box: [10, 4, 6], center: [0, 2, -1], color: 0xe8d29a, size: 0.05, speed: 0.15 });

    this.W = 1;
    this.H = 1;
    this.dist = 14;
    this.target = new THREE.Vector3(0, 1.1, 0);
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  placeHero() {
    this.hero.group.scale.setScalar(1.6);
    this.hero.group.position.set(0, 0.04, 0.25);
    this.hero.group.rotation.y = 0.35;
    this.root.add(this.hero.group);
  }

  refreshHero(gear) {
    this.root.remove(this.hero.group);
    this.hero = createHero(gear);
    this.placeHero();
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.layout();
  }

  setRects({ stage }) {
    this.rect = stage;
    this.layout();
  }

  dirAt(a) { return new THREE.Vector3(Math.sin(a), 0.2, Math.cos(a)).normalize(); }

  layout() {
    const r = this.rect;
    if (!r) return;
    centerOnRect(this.camera, r, this.W, this.H);
    const pts = [
      new THREE.Vector3(-1.9, 0, -0.7), new THREE.Vector3(1.8, 0, -0.5),
      new THREE.Vector3(-1.9, 2.2, -0.7), new THREE.Vector3(1.8, 3.0, -0.5),
      new THREE.Vector3(0, 1.75, 0.25), new THREE.Vector3(0, -0.2, 1.4),
    ];
    this.dist = fitCameraDistance(this.camera, this.target, this.dirAt(0.4), pts, r, this.W, this.H, 4) * 1.06;
  }

  update(dt, t) {
    const a = this.reduced ? 0.4 : 0.4 + Math.sin(t * 0.12) * 0.16;
    this.camera.position.copy(this.target).addScaledVector(this.dirAt(a), this.dist);
    this.camera.lookAt(this.target);
    this.hero.update(dt, t, 0);
    this.brazier.update(dt, t);
    this.embers.update(dt, t);
    this.motes.update(dt, t);
    // 軍旗飄動
    const pos = this.flag.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = this.flagBase[i * 3], y = this.flagBase[i * 3 + 1];
      const k = (x + 0.35) / 0.7;
      pos.setZ(i, Math.sin(t * 2.4 + x * 5 + y * 2) * 0.07 * (0.3 + k));
    }
    pos.needsUpdate = true;
  }
}
