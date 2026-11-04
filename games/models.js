/* 低多邊形 3D 模型：全部用基本幾何體砌，唔使外部模型檔 */
import { THREE } from './engine.js';
import { makeGlow, blobShadow } from './fx.js';

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, flatShading: true, ...opts });

/* ===================== 勇者 ===================== */
export function createHero() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = std(0xf3c9a0, { flatShading: false, roughness: 0.6 });
  const tunic = std(0x2f6fd6, { roughness: 0.6 });
  const capeMat = std(0xd23b3b, { side: THREE.DoubleSide });
  const metal = std(0xdfe5ef, { metalness: 0.55, roughness: 0.3 });
  const gold = std(0xf5c842, { metalness: 0.6, roughness: 0.3 });
  const leather = std(0x5a3a22);
  const black = new THREE.MeshBasicMaterial({ color: 0x14141c });

  for (const s of [-1, 1]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.19), leather);
    boot.position.set(0.09 * s, 0.075, 0.02);
    body.add(boot);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.38, 8), tunic);
  torso.position.y = 0.33;
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.055, 8), leather);
  belt.position.y = 0.25;
  body.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), gold);
  buckle.position.set(0, 0.25, 0.21);
  body.add(buckle);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 14), skin);
  head.position.y = 0.67;
  body.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), black);
    eye.position.set(0.065 * s, 0.665, 0.158);
    eye.scale.y = 1.3;
    body.add(eye);
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), metal);
  helm.position.y = 0.685;
  body.add(helm);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.022, 6, 18), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.69;
  body.add(band);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 6), capeMat);
  plume.position.set(0, 0.93, -0.03);
  plume.rotation.x = -0.35;
  body.add(plume);

  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.44, 1, 4), capeMat);
  cape.position.set(0, 0.36, -0.215);
  cape.rotation.x = 0.16;
  body.add(cape);

  // 盾（左手，喺 +x）
  const shield = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), std(0x2457a6, { metalness: 0.3, roughness: 0.4 }));
  disc.rotation.z = Math.PI / 2;
  shield.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 18), gold);
  rim.rotation.y = Math.PI / 2;
  shield.add(rim);
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), gold);
  emblem.position.x = 0.03;
  shield.add(emblem);
  shield.position.set(0.26, 0.36, 0.03);
  body.add(shield);

  // 劍（右手，喺 -x）
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.018), metal);
  blade.position.y = 0.24;
  sword.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.045), gold);
  sword.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), leather);
  hilt.position.y = -0.06;
  sword.add(hilt);
  sword.position.set(-0.27, 0.28, 0.08);
  sword.rotation.z = 0.12;
  body.add(sword);

  const shadow = blobShadow(0.75, 0.5);
  root.add(shadow);

  let celebrate = 0;
  return {
    group: root,
    body,
    sword,
    update(dt, t, hop = 0) {
      const idle = Math.sin(t * 2.4) * 0.018;
      body.position.y = idle + hop;
      cape.rotation.x = 0.16 + Math.sin(t * 3.1) * 0.05 + hop * 1.5;
      shadow.scale.setScalar(1 - hop * 1.6);
      if (celebrate > 0) {
        celebrate = Math.max(0, celebrate - dt);
        const k = celebrate / 1.4;
        body.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.25 * k;
        sword.rotation.z = 0.12 - Math.sin((1 - k) * Math.PI) * 2.6;
        sword.position.y = 0.28 + Math.sin((1 - k) * Math.PI) * 0.3;
      }
    },
    celebrate() { celebrate = 1.4; },
  };
}

/* ===================== 魔像 Boss ===================== */
export function createGolem({ rock, crystal, boss = false }) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const rockMat = std(rock, { roughness: 0.92 });
  const crystalMat = std(crystal, { emissive: crystal, emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.1 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: crystal });
  const parts = [];
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.userData.base = m.position.clone();
    rig.add(m);
    parts.push(m);
    return m;
  };

  for (const s of [-1, 1]) add(new THREE.DodecahedronGeometry(0.42), rockMat, 0.52 * s, 0.42, 0, 1, 1.05, 1);
  add(new THREE.DodecahedronGeometry(0.95), rockMat, 0, 1.48, 0, 1.15, 0.95, 0.8);
  const core = add(new THREE.OctahedronGeometry(0.3), crystalMat, 0, 1.52, 0.74, 1, 1.35, 1);
  const head = add(new THREE.DodecahedronGeometry(0.52), rockMat, 0, 2.58, 0.05, 1.05, 0.85, 0.9);
  const eyes = [];
  for (const s of [-1, 1]) eyes.push(add(new THREE.SphereGeometry(0.085, 10, 8), eyeMat, 0.18 * s, 2.62, 0.47, 1.2, 0.8, 1));
  for (const s of [-1, 1]) {
    add(new THREE.DodecahedronGeometry(0.46), rockMat, 1.18 * s, 2.02, 0);
    add(new THREE.OctahedronGeometry(0.2), crystalMat, 1.28 * s, 2.52, 0, 1, 2.2, 1);
  }
  const fists = [];
  for (const s of [-1, 1]) {
    const f = add(new THREE.DodecahedronGeometry(0.5), rockMat, 1.42 * s, 1.06, 0.22);
    f.userData.phase = s > 0 ? 0 : Math.PI;
    fists.push(f);
  }
  if (boss) {
    [[-0.32, 3.02, -0.25], [0, 3.18, 0], [0.32, 3.02, 0.25]].forEach(([x, y, rz]) => {
      const spike = add(new THREE.ConeGeometry(0.11, 0.5, 5), crystalMat, x, y, 0.05);
      spike.rotation.z = rz;
    });
  }

  const orbit = new THREE.Group();
  orbit.position.y = 1.9;
  rig.add(orbit);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + (i % 2) * 0.05), rockMat);
    r.position.set(Math.cos(a) * 1.85, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.0);
    orbit.add(r);
  }

  const coreGlow = makeGlow(crystal, 1.9, 0.9);
  coreGlow.position.copy(core.position).add(new THREE.Vector3(0, 0, 0.15));
  rig.add(coreGlow);
  const eyeGlows = eyes.map(e => {
    const g = makeGlow(crystal, 0.7, 0.9);
    g.position.copy(e.position).add(new THREE.Vector3(0, 0, 0.05));
    rig.add(g);
    return g;
  });
  const light = new THREE.PointLight(crystal, 10, 7, 2);
  light.position.set(0, 1.6, 1.4);
  rig.add(light);

  let flash = 0;
  let shake = 0;
  let tilt = 0;
  let pulse = 0;
  let dead = false;
  let deadT = 0;
  const v = new THREE.Vector3();

  return {
    group: root,
    core,
    corePos(target) { return core.getWorldPosition(target); },
    headPos(target) { return head.getWorldPosition(target); },
    hit(crit) {
      flash = crit ? 1.2 : 0.7;
      shake = crit ? 0.14 : 0.07;
      tilt = crit ? 0.2 : 0.1;
      pulse = 1;
    },
    defeat() {
      dead = true;
      deadT = 0;
      for (const p of parts) {
        v.copy(p.position).sub(new THREE.Vector3(0, 1.5, 0)).normalize();
        p.userData.vel = new THREE.Vector3(v.x * (3 + Math.random() * 3), 3 + Math.random() * 4, v.z * 2 + 2 + Math.random() * 2);
        p.userData.ang = new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
      }
      orbit.visible = false;
      flash = 2;
    },
    update(dt, t, hpRatio = 1) {
      if (!dead) {
        rig.position.y = Math.sin(t * 1.6) * 0.06;
        for (const f of fists) f.position.y = f.userData.base.y + Math.sin(t * 2 + f.userData.phase) * 0.1;
        orbit.rotation.y += dt * 0.9;
        // 血少時水晶閃爍
        const danger = hpRatio < 0.3 ? (0.5 + 0.5 * Math.sin(t * 14)) : 1;
        coreGlow.material.opacity = Math.min(1, (0.5 + 0.2 * Math.sin(t * 3)) * danger + pulse * 0.35);
        coreGlow.scale.setScalar(1.6 + pulse * 0.7);
        eyeGlows.forEach(g => { g.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.2); });
        light.intensity = 8 + pulse * 10;
        rig.position.x = Math.sin(t * 70) * shake;
        rig.rotation.x = -tilt;
        shake = Math.max(0, shake - dt * 0.6);
        tilt = Math.max(0, tilt - dt * 1.2);
        pulse = Math.max(0, pulse - dt * 4);
      } else {
        deadT += dt;
        for (const p of parts) {
          const { vel, ang } = p.userData;
          vel.y -= 9 * dt;
          p.position.addScaledVector(vel, dt);
          p.rotation.x += ang.x * dt; p.rotation.y += ang.y * dt; p.rotation.z += ang.z * dt;
          p.scale.multiplyScalar(Math.max(0, 1 - dt * 0.9));
        }
        const k = Math.max(0, 1 - deadT / 1.2);
        coreGlow.material.opacity = k;
        coreGlow.scale.setScalar(1.9 + (1 - k) * 6);
        eyeGlows.forEach(g => { g.material.opacity = k; });
        light.intensity = 40 * k;
        if (deadT > 2) rig.visible = false;
      }
      rockMat.emissive.setScalar(Math.min(1, flash) * 0.3);
      flash = Math.max(0, flash - dt * 7);
    },
  };
}

/* ===================== 寶箱 ===================== */
export function createChest() {
  const root = new THREE.Group();
  const wood = std(0x9a5f2c, { roughness: 0.8 });
  const goldMat = std(0xf5c842, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2a00 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44), wood);
  base.position.y = 0.18;
  root.add(base);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.38, 0.46), goldMat);
    b.position.set(0.2 * s, 0.18, 0);
    root.add(b);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), goldMat);
  lock.position.set(0, 0.3, 0.235);
  root.add(lock);

  const pivot = new THREE.Group();
  pivot.position.set(0, 0.36, -0.22);
  root.add(pivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 14, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2;
  lid.position.z = 0.22;
  pivot.add(lid);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, 0.065, 14, 1, false, 0, Math.PI), goldMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(0.2 * s, 0, 0.22);
    pivot.add(b);
  }

  const inner = makeGlow(0xffd36b, 1.0, 0.0);
  inner.position.set(0, 0.42, 0);
  root.add(inner);
  const beacon = makeGlow(0xffc24a, 2.4, 0.55);
  beacon.position.set(0, 0.5, 0);
  root.add(beacon);
  const light = new THREE.PointLight(0xffc860, 5, 4.5, 2);
  light.position.set(0, 1.0, 0.4);
  root.add(light);

  let openT = -1;
  return {
    group: root,
    open() { openT = 0; },
    update(dt, t) {
      beacon.material.opacity = 0.42 + 0.18 * Math.sin(t * 3);
      beacon.scale.setScalar(2.2 + 0.25 * Math.sin(t * 3));
      if (openT >= 0) {
        openT = Math.min(1.5, openT + dt);
        const k = Math.min(1, openT / 0.45);
        pivot.rotation.x = -1.9 * (1 - Math.pow(1 - k, 3));
        inner.material.opacity = Math.min(1, openT * 2);
        inner.scale.setScalar(1 + openT * 2.5);
        light.intensity = 5 + Math.sin(Math.min(1, openT) * Math.PI) * 30;
      }
    },
  };
}

/* ===================== 寶石 ===================== */
export function createGem(color = 0x5ee7ff) {
  const root = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16),
    std(color, { emissive: color, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.15 }),
  );
  gem.scale.y = 1.4;
  gem.position.y = 0.42;
  root.add(gem);
  const glow = makeGlow(color, 0.8, 0.55);
  glow.position.y = 0.42;
  root.add(glow);
  const seed = Math.random() * 6;
  let collectT = -1;
  return {
    group: root,
    collect() { collectT = 0; },
    get collecting() { return collectT >= 0; },
    update(dt, t) {
      if (collectT >= 0) {
        collectT += dt;
        const k = Math.min(1, collectT / 0.45);
        gem.position.y = 0.42 + k * 1.2;
        glow.position.y = gem.position.y;
        gem.scale.setScalar((1 - k) * 1.4);
        glow.material.opacity = 0.9 * (1 - k);
        gem.rotation.y += dt * 18;
        if (k >= 1) root.visible = false;
        return;
      }
      gem.rotation.y = t * 1.6 + seed;
      gem.position.y = 0.42 + Math.sin(t * 2.4 + seed) * 0.06;
      glow.position.y = gem.position.y;
    },
  };
}

/* ===================== 火把 ===================== */
export function createTorch({ light = true, height = 1.1 } = {}) {
  const root = new THREE.Group();
  const stone = std(0x6c6478, { roughness: 0.95 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, height, 6), stone);
  pillar.position.y = height / 2;
  root.add(pillar);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.1, 0.13, 8), std(0x3a3340, { metalness: 0.5, roughness: 0.5 }));
  bowl.position.y = height + 0.05;
  root.add(bowl);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 7), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  flame.position.y = height + 0.26;
  root.add(flame);
  const glow = makeGlow(0xff8a2a, 1.3, 0.85);
  glow.position.y = height + 0.28;
  root.add(glow);
  let pl = null;
  if (light) {
    pl = new THREE.PointLight(0xff9a3c, 6, 6, 2);
    pl.position.y = height + 0.4;
    root.add(pl);
  }
  const seed = Math.random() * 10;
  return {
    group: root,
    update(dt, t) {
      const f = 0.85 + 0.15 * Math.sin(t * 13 + seed) * Math.sin(t * 7.3 + seed);
      flame.scale.set(1, f * 1.1, 1);
      glow.material.opacity = 0.7 * f;
      glow.scale.setScalar(1.2 + f * 0.25);
      if (pl) pl.intensity = 5 * f;
    },
  };
}

/* ===================== 漂浮水晶 ===================== */
export function createCrystal(color) {
  const root = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3),
    std(color, { emissive: color, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.2 }),
  );
  m.scale.y = 1.9;
  root.add(m);
  const glow = makeGlow(color, 1.6, 0.7);
  root.add(glow);
  const seed = Math.random() * 6;
  return {
    group: root,
    update(dt, t) {
      m.rotation.y = t * 0.8 + seed;
      root.position.y = root.userData.baseY + Math.sin(t * 1.3 + seed) * 0.2;
    },
  };
}

/* ===================== 浮空島（主選單）===================== */
export function createIsland() {
  const root = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.15, 0.32, 10), std(0x58b04f, { roughness: 0.9 }));
  grass.position.y = -0.16;
  root.add(grass);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 1.75, 0.55, 10), std(0x7a5232, { roughness: 1 }));
  dirt.position.y = -0.6;
  root.add(dirt);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.6, 10), std(0x6b5f6e, { roughness: 1 }));
  rock.rotation.x = Math.PI;
  rock.position.y = -2.17;
  root.add(rock);
  const bushMat = std(0x3f8f45, { roughness: 0.9 });
  [[-1.6, 0.6], [1.7, 0.2], [-0.8, -1.5], [1.2, -1.3], [0.2, 1.8]].forEach(([x, z], i) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 2) * 0.1), bushMat);
    b.position.set(x, 0.12, z);
    root.add(b);
  });
  const stoneMat = std(0x9a93a6, { roughness: 1 });
  [[1.5, 1.2], [-1.9, -0.4], [0.6, -1.8]].forEach(([x, z]) => {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), stoneMat);
    s.position.set(x, 0.05, z);
    root.add(s);
  });
  // 掛喺島底嘅水晶
  const hang = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), std(0x7ad7ff, { emissive: 0x2a8cff, emissiveIntensity: 0.8 }));
  hang.scale.y = 2;
  hang.position.set(0.6, -1.6, 0.9);
  root.add(hang);
  return { group: root };
}
