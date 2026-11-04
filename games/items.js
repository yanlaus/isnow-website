/* 道具模型：形狀同顏色都唔同，唔會淨靠顏色分辨（寶箱記憶、道具店共用） */
import { THREE } from './engine.js';

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, flatShading: true, ...opts }));
  }
  return mats.get(key);
}
const GOLD = () => mat(0xf5c842, { metalness: 0.7, roughness: 0.3, emissive: 0x4a3200 });
const SILVER = () => mat(0xe3e8f0, { metalness: 0.6, roughness: 0.25 });

function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

const BUILDERS = {
  sword() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.42, 0.025), SILVER(), 0, 0.08));
    const tip = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), SILVER(), 0, 0.34);
    tip.rotation.y = Math.PI / 4;
    tip.scale.z = 0.35;
    g.add(tip);
    g.add(mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), GOLD(), 0, -0.14));
    g.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 6), mat(0x6b3a1e), 0, -0.22));
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), GOLD(), 0, -0.29));
    g.rotation.z = 0.5;
    return g;
  },
  shield() {
    const g = new THREE.Group();
    const d = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16), mat(0x2457c4, { metalness: 0.3 }));
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const rim = mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 20), GOLD());
    g.add(rim);
    const boss = mesh(new THREE.OctahedronGeometry(0.08), GOLD(), 0, 0, 0.05);
    g.add(boss);
    return g;
  },
  potion() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.17, 14, 10), mat(0xe8304a, { roughness: 0.15, emissive: 0x5a0010, transparent: true, opacity: 0.92 }), 0, -0.06));
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 10), mat(0xd9eef7, { roughness: 0.1, transparent: true, opacity: 0.8 }), 0, 0.14));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.07, 8), mat(0x8a5a32), 0, 0.24));
    return g;
  },
  crown() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14, 1, true), mat(0xf5c842, { metalness: 0.7, roughness: 0.3, emissive: 0x4a3200, side: THREE.DoubleSide }), 0, -0.06));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 4), GOLD(), Math.cos(a) * 0.19, 0.07, Math.sin(a) * 0.19));
      g.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), mat(0xff2d55, { emissive: 0x550012 }), Math.cos(a) * 0.19, 0.16, Math.sin(a) * 0.19));
    }
    g.rotation.x = 0.35;
    return g;
  },
  key() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 14), GOLD(), 0, 0.17));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.3, 0.04), GOLD(), 0, -0.04));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.045, 0.04), GOLD(), 0.05, -0.15));
    g.add(mesh(new THREE.BoxGeometry(0.075, 0.045, 0.04), GOLD(), 0.04, -0.07));
    g.rotation.z = -0.4;
    return g;
  },
  scroll() {
    const g = new THREE.Group();
    const paper = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 12), mat(0xf3e6c4, { roughness: 0.9 }));
    paper.rotation.z = Math.PI / 2;
    g.add(paper);
    for (const s of [-1, 1]) {
      const cap = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), mat(0x7a3a1a), 0.22 * s);
      cap.rotation.z = Math.PI / 2;
      g.add(cap);
    }
    const ribbon = mesh(new THREE.TorusGeometry(0.093, 0.02, 4, 14), mat(0xd23b3b));
    ribbon.rotation.y = Math.PI / 2;
    g.add(ribbon);
    g.rotation.z = 0.25;
    return g;
  },
  ring() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 20), GOLD()));
    g.add(mesh(new THREE.OctahedronGeometry(0.09), mat(0x9ff3ff, { emissive: 0x2a8cff, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.05 }), 0, 0.2));
    g.rotation.x = 0.3;
    return g;
  },
  helmet() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), SILVER(), 0, -0.08));
    const band = mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 18), GOLD(), 0, -0.08);
    band.rotation.x = Math.PI / 2;
    g.add(band);
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), SILVER(), 0, -0.16, 0.19));
    const plume = mesh(new THREE.ConeGeometry(0.06, 0.24, 6), mat(0xd23b3b), 0, 0.2, -0.02);
    plume.rotation.x = -0.4;
    g.add(plume);
    return g;
  },
  boot() {
    const g = new THREE.Group();
    const brown = mat(0x7b4a26, { roughness: 0.8 });
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), brown, 0, 0.04));
    g.add(mesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), brown, 0, -0.12, 0.07));
    g.add(mesh(new THREE.BoxGeometry(0.17, 0.05, 0.17), mat(0x3a2414), 0, 0.2));
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.3), mat(0x2a1a10), 0, -0.18, 0.07));
    g.rotation.y = -0.6;
    return g;
  },
  apple() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0xd8262c, { roughness: 0.4 })));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4), mat(0x5a3a1a), 0, 0.17));
    const leaf = mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0x3fa34d), 0.05, 0.18);
    leaf.scale.set(1, 0.3, 0.6);
    g.add(leaf);
    return g;
  },
  bread() {
    const g = new THREE.Group();
    const loaf = mesh(new THREE.SphereGeometry(0.17, 12, 8), mat(0xd9984a, { roughness: 0.9 }));
    loaf.scale.set(1.4, 0.7, 0.9);
    g.add(loaf);
    return g;
  },
};

export const ITEM_KINDS = ['sword', 'shield', 'potion', 'crown', 'key', 'scroll', 'ring', 'helmet', 'boot'];

export function createItem(kind) {
  const inner = BUILDERS[kind]();
  const g = new THREE.Group();
  g.add(inner);
  g.userData.kind = kind;
  return g;
}
