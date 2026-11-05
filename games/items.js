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
const GOLD = () => mat(0xd4ad4e, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2800 });
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
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14, 1, true), mat(0xd4ad4e, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2800, side: THREE.DoubleSide }), 0, -0.06));
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
    for (let k = -1; k <= 1; k++) {
      const cut = mesh(new THREE.BoxGeometry(0.025, 0.02, 0.16), mat(0xf0d29a, { roughness: 0.9 }), k * 0.08, 0.11, 0);
      cut.rotation.set(0.15, 0.5, 0);
      g.add(cut);
    }
    return g;
  },
  candle() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.04, 14), GOLD(), 0, -0.2));
    const handle = mesh(new THREE.TorusGeometry(0.05, 0.014, 5, 12), GOLD(), 0.18, -0.18);
    g.add(handle);
    const wax = mat(0xefe4c8, { roughness: 0.7 });
    g.add(mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.32, 12), wax, 0, -0.02));
    g.add(mesh(new THREE.SphereGeometry(0.025, 6, 5), wax, 0.06, 0.06, 0.02));
    g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4), mat(0x2a2018), 0, 0.16));
    const flame = mesh(new THREE.ConeGeometry(0.035, 0.11, 8), new THREE.MeshBasicMaterial({ color: 0xffc46a }), 0, 0.23);
    g.add(flame);
    g.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), 0, 0.2));
    return g;
  },
  herb() {
    const g = new THREE.Group();
    const leaf = mat(0x4f8a3e, { roughness: 0.75 });
    const stem = mat(0x6a7a3a, { roughness: 0.8 });
    [-0.5, -0.22, 0.06, 0.32, 0.58].forEach((a, k) => {
      const s = new THREE.Group();
      s.add(mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 4), stem, 0, 0.0));
      const l = mesh(new THREE.SphereGeometry(0.06, 8, 6), k % 2 ? mat(0x5f9a48, { roughness: 0.75 }) : leaf, 0, 0.2);
      l.scale.set(0.7, 1.9, 0.35);
      s.add(l);
      for (const d of [-1, 1]) {
        const side = mesh(new THREE.SphereGeometry(0.04, 6, 5), leaf, d * 0.04, 0.07, 0);
        side.scale.set(1.5, 0.6, 0.35);
        side.rotation.z = d * 0.5;
        s.add(side);
      }
      s.position.y = 0.02;
      s.rotation.z = a * 0.7;
      g.add(s);
    });
    const tie = mesh(new THREE.TorusGeometry(0.035, 0.014, 5, 12), mat(0xa77a46, { roughness: 0.9 }), 0, -0.1);
    tie.rotation.x = Math.PI / 2;
    g.add(tie);
    g.position.y = -0.04;
    return g;
  },
  fish() {
    const g = new THREE.Group();
    const scale = mat(0x8ea4b4, { metalness: 0.45, roughness: 0.35 });
    const body = mesh(new THREE.SphereGeometry(0.15, 14, 10), scale);
    body.scale.set(1.75, 0.72, 0.5);
    g.add(body);
    const belly = mesh(new THREE.SphereGeometry(0.12, 12, 8), mat(0xdfe6ea, { metalness: 0.3, roughness: 0.4 }), 0.02, -0.035, 0);
    belly.scale.set(1.7, 0.45, 0.52);
    g.add(belly);
    const fin = mat(0x6e8294, { roughness: 0.5, side: THREE.DoubleSide });
    const tail = mesh(new THREE.ConeGeometry(0.1, 0.14, 4), fin, -0.3, 0, 0);
    tail.rotation.z = -Math.PI / 2;
    tail.scale.z = 0.25;
    g.add(tail);
    const dorsal = mesh(new THREE.ConeGeometry(0.05, 0.1, 3), fin, -0.02, 0.12, 0);
    dorsal.rotation.z = 0.5;
    dorsal.scale.z = 0.3;
    g.add(dorsal);
    for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), mat(0x16181c, { roughness: 0.2 }), 0.19, 0.025, 0.06 * s));
    g.rotation.set(0.15, -0.25, 0.12);
    return g;
  },
  cheese() {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.absarc(0, 0, 0.26, -0.45, 0.45, false);
    sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 8 });
    const w = mesh(geo, mat(0xf0c050, { roughness: 0.7 }));
    w.rotation.x = -Math.PI / 2;
    w.position.set(-0.12, -0.08, 0);
    g.add(w);
    const hole = mat(0xc99a34, { roughness: 0.9 });
    // 面上同圓邊上嘅窿
    [[0.0, 0.088, 0.02, 0.026, 'y'], [0.08, 0.088, -0.045, 0.02, 'y'], [0.1, 0.088, 0.05, 0.015, 'y'], [0.142, 0.01, -0.03, 0.024, 'x'], [0.14, -0.035, 0.05, 0.018, 'x']].forEach(([x, y, z, r, ax]) => {
      const h = mesh(new THREE.SphereGeometry(r, 8, 6), hole, x, y, z);
      h.scale[ax] = 0.4;
      g.add(h);
    });
    g.rotation.y = -0.6;
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
