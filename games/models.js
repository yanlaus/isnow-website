/* 低多邊形 3D 模型：全部用基本幾何體砌，唔使外部模型檔 */
import { THREE } from './engine.js';
import { makeGlow, blobShadow } from './fx.js';

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, flatShading: true, ...opts });

/* ===================== 勇者（正常比例騎士，頭身約 1:6） ===================== */
export function createHero() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = std(0xd9ad88, { roughness: 0.65 });
  const steel = std(0x9aa3b2, { metalness: 0.65, roughness: 0.35 });
  const darkSteel = std(0x4f5766, { metalness: 0.55, roughness: 0.45 });
  const navy = std(0x23314f, { roughness: 0.75 });
  const crimson = std(0x7a1f27, { roughness: 0.8, side: THREE.DoubleSide });
  const gold = std(0xc9a24a, { metalness: 0.75, roughness: 0.3 });
  const leather = std(0x3e2a1c, { roughness: 0.85 });
  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // 腳：靴、腿、脛甲
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.085, 0.09, 0.15), leather, 0.065 * s, 0.045, 0.02);
    add(new THREE.CylinderGeometry(0.042, 0.038, 0.34, 7), darkSteel, 0.065 * s, 0.26, 0);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.025), steel, 0.065 * s, 0.22, 0.042);
  }
  // 戰袍下擺 + 腰帶
  add(new THREE.CylinderGeometry(0.115, 0.165, 0.2, 8), navy, 0, 0.44, 0);
  add(new THREE.CylinderGeometry(0.122, 0.122, 0.045, 8), leather, 0, 0.535, 0);
  add(new THREE.BoxGeometry(0.05, 0.045, 0.02), gold, 0, 0.535, 0.12);
  // 胸甲 + 金邊領
  add(new THREE.CylinderGeometry(0.14, 0.118, 0.27, 8), steel, 0, 0.69, 0);
  const collar = add(new THREE.TorusGeometry(0.105, 0.016, 5, 14), gold, 0, 0.82, 0);
  collar.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.018, 0.2, 0.012), gold, 0, 0.69, 0.138);
  // 肩甲 + 手臂 + 護手
  for (const s of [-1, 1]) {
    const pauldron = add(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), steel, 0.165 * s, 0.78, 0);
    pauldron.rotation.z = -0.35 * s;
    const trim = add(new THREE.TorusGeometry(0.068, 0.01, 4, 12), gold, 0.172 * s, 0.762, 0);
    trim.rotation.x = Math.PI / 2;
    trim.rotation.y = 0.35 * s;
    const arm = add(new THREE.CylinderGeometry(0.034, 0.03, 0.27, 6), darkSteel, 0.19 * s, 0.62, 0.01);
    arm.rotation.z = 0.08 * s;
    add(new THREE.BoxGeometry(0.06, 0.07, 0.06), steel, 0.205 * s, 0.47, 0.02);
  }
  // 頭、頭盔（護鼻、冠飾、羽飾）
  add(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 6), skin, 0, 0.845, 0);
  add(new THREE.SphereGeometry(0.078, 12, 10), skin, 0, 0.905, 0.005);
  const helm = add(new THREE.SphereGeometry(0.088, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), steel, 0, 0.915, 0);
  helm.scale.set(1, 1.08, 1.05);
  add(new THREE.BoxGeometry(0.016, 0.07, 0.016), steel, 0, 0.9, 0.086);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.06, 0.07), steel, 0.08 * s, 0.88, 0.02);
  add(new THREE.BoxGeometry(0.016, 0.03, 0.17), gold, 0, 1.0, -0.01);
  const plume = add(new THREE.ConeGeometry(0.03, 0.2, 6), crimson, 0, 1.03, -0.09);
  plume.rotation.x = -1.15;

  // 披風（肩到小腿）
  const capeGeo = new THREE.PlaneGeometry(0.34, 0.66, 2, 8);
  capeGeo.translate(0, -0.33, 0);
  const cape = add(capeGeo, crimson, 0, 0.8, -0.13);
  cape.rotation.x = 0.1;
  const capeBase = capeGeo.attributes.position.array.slice();

  // 鳶形盾（左手，喺 +x）
  const kite = new THREE.Shape();
  kite.moveTo(0, 0.17);
  kite.quadraticCurveTo(0.12, 0.16, 0.12, 0.06);
  kite.quadraticCurveTo(0.1, -0.08, 0, -0.18);
  kite.quadraticCurveTo(-0.1, -0.08, -0.12, 0.06);
  kite.quadraticCurveTo(-0.12, 0.16, 0, 0.17);
  const shield = new THREE.Group();
  const face = new THREE.Mesh(new THREE.ExtrudeGeometry(kite, { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 }), navy);
  shield.add(face);
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.24, 0.012), gold);
  cross1.position.set(0, -0.01, 0.042);
  shield.add(cross1);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.012), gold);
  cross2.position.set(0, 0.06, 0.042);
  shield.add(cross2);
  shield.position.set(0.235, 0.58, 0.05);
  shield.rotation.y = 0.55;
  body.add(shield);

  // 長劍（右手，喺 -x），劍尖向上
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.5, 0.012), std(0xd5dbe4, { metalness: 0.8, roughness: 0.2 }));
  blade.position.y = 0.3;
  sword.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.06, 4), blade.material);
  tip.position.y = 0.58;
  tip.rotation.y = Math.PI / 4;
  sword.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.03), gold);
  guard.position.y = 0.045;
  sword.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6), leather);
  sword.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), gold);
  pommel.position.y = -0.05;
  sword.add(pommel);
  sword.position.set(-0.215, 0.45, 0.07);
  sword.rotation.z = 0.06;
  body.add(sword);

  const shadow = blobShadow(0.62, 0.5);
  root.add(shadow);

  const capePos = capeGeo.attributes.position;
  let celebrate = 0;
  return {
    group: root,
    body,
    sword,
    update(dt, t, hop = 0) {
      const idle = Math.sin(t * 2) * 0.01;
      body.position.y = idle + hop;
      // 披風隨風擺動（越近下擺越大）
      for (let i = 0; i < capePos.count; i++) {
        const y = capeBase[i * 3 + 1];
        const k = -y / 0.66;
        capePos.setZ(i, capeBase[i * 3 + 2] - k * k * (0.06 + hop * 0.6) - Math.sin(t * 2.6 + k * 2 + capeBase[i * 3] * 4) * 0.025 * k);
      }
      capePos.needsUpdate = true;
      shadow.scale.setScalar(1 - hop * 1.6);
      if (celebrate > 0) {
        celebrate = Math.max(0, celebrate - dt);
        const k = celebrate / 1.4;
        body.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.18 * k;
        sword.rotation.z = 0.06 - Math.sin((1 - k) * Math.PI) * 2.6;
        sword.position.y = 0.45 + Math.sin((1 - k) * Math.PI) * 0.3;
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
export function createChest({ beacon: withBeacon = true, light: withLight = true, mimic = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const wood = std(mimic ? 0x8a4f2a : 0x9a5f2c, { roughness: 0.8 });
  const goldMat = std(0xf5c842, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2a00 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44), wood);
  base.position.y = 0.18;
  body.add(base);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.38, 0.46), goldMat);
    b.position.set(0.2 * s, 0.18, 0);
    body.add(b);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), goldMat);
  lock.position.set(0, 0.3, 0.235);
  body.add(lock);

  const pivot = new THREE.Group();
  pivot.position.set(0, 0.36, -0.22);
  body.add(pivot);
  const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 14, 1, false, 0, Math.PI), wood);
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.z = 0.22;
  pivot.add(lidMesh);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, 0.065, 14, 1, false, 0, Math.PI), goldMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(0.2 * s, 0, 0.22);
    pivot.add(b);
  }

  // 假寶箱：牙齒同紅眼，打開先見到
  const mimicParts = [];
  if (mimic) {
    const tooth = std(0xfff6e0, { roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const x = -0.24 + i * 0.096;
      const lower = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), tooth);
      lower.position.set(x, 0.4, 0.2);
      body.add(lower);
      const upper = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), tooth);
      upper.rotation.x = Math.PI;
      upper.position.set(x, -0.04, 0.44);
      pivot.add(upper);
    }
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), std(0xd2405a, { roughness: 0.5 }));
    tongue.scale.set(1.3, 0.3, 1);
    tongue.position.set(0, 0.36, 0.02);
    body.add(tongue);
    for (const s of [-1, 1]) {
      const eye = makeGlow(0xff2a2a, 0.34, 0);
      eye.position.set(0.1 * s, 0.5, -0.05);
      body.add(eye);
      mimicParts.push(eye);
    }
  }

  const inner = makeGlow(mimic ? 0xff4040 : 0xffd36b, 1.0, 0.0);
  inner.position.set(0, 0.42, 0);
  body.add(inner);
  let beaconSprite = null;
  if (withBeacon) {
    beaconSprite = makeGlow(0xffc24a, 2.4, 0.55);
    beaconSprite.position.set(0, 0.5, 0);
    root.add(beaconSprite);
  }
  let pl = null;
  if (withLight) {
    pl = new THREE.PointLight(0xffc860, 5, 4.5, 2);
    pl.position.set(0, 1.0, 0.4);
    root.add(pl);
  }

  let target = 0;   // 蓋目標：0 合埋，1 打開
  let lid = 0;
  let burst = 0;
  let biteT = -1;
  let shake = 0;
  return {
    group: root,
    get isOpen() { return target > 0.5; },
    open(withBurst = true) { target = 1; if (withBurst) burst = 1; },
    close() { target = 0; },
    bite() { biteT = 0; target = 1; shake = 0.5; },
    setGlow(v) { if (beaconSprite) beaconSprite.visible = v; },
    update(dt, t) {
      if (beaconSprite) {
        beaconSprite.material.opacity = 0.42 + 0.18 * Math.sin(t * 3);
        beaconSprite.scale.setScalar(2.2 + 0.25 * Math.sin(t * 3));
      }
      if (biteT >= 0) {
        // 咬三下：蓋快速開合 + 彈跳
        biteT += dt;
        target = Math.floor(biteT / 0.12) % 2 === 0 ? 1 : 0.15;
        body.position.y = Math.abs(Math.sin(biteT * 16)) * 0.12;
        if (biteT > 0.75) { biteT = -1; target = 0; body.position.y = 0; }
      }
      const speed = biteT >= 0 ? 30 : 9;
      lid += (target - lid) * Math.min(1, dt * speed);
      pivot.rotation.x = -1.9 * lid;
      inner.material.opacity = Math.min(1, lid * 1.2) * (mimic ? 0.8 : 1);
      inner.scale.setScalar(1 + lid * 1.2 + burst * 1.5);
      mimicParts.forEach(e => { e.material.opacity = lid * (0.75 + 0.25 * Math.sin(t * 10)); });
      if (pl) pl.intensity = 5 + burst * 30;
      burst = Math.max(0, burst - dt * 1.6);
      if (shake > 0) {
        body.rotation.z = Math.sin(t * 60) * 0.08 * (shake / 0.5);
        shake = Math.max(0, shake - dt);
        if (shake === 0) body.rotation.z = 0;
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

/* ===================== 村民（打怪、道具店客人） =====================
   成人比例、大地色衣著；disguise：魔物扮村民 — 灰紫膚色、紅眼發光（魔王級要睇清楚） */
export function createVillager({ shirt = 0x6b5a3a, hat = 0x4a3a2a, skin = 0xd9ad88, disguise = false, style } = {}) {
  const root = new THREE.Group();
  const look = style != null ? style : Math.floor(Math.random() * 3);   // 0 闊邊帽、1 兜帽、2 頭巾＋鬚
  const skinMat = std(disguise ? 0x8e7f9c : skin, { roughness: 0.65 });
  const cloth = std(shirt, { roughness: 0.85 });
  const dark = std(0x2a2018, { roughness: 0.9 });

  // 身體：長袍 + 披肩
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 0.5, 9), cloth);
  robe.position.y = -0.31;
  root.add(robe);
  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.14, 9), std(hat, { roughness: 0.85 }));
  mantle.position.y = -0.07;
  root.add(mantle);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 7), skinMat);
  neck.position.y = 0.01;
  root.add(neck);
  // 頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skinMat);
  head.scale.set(0.92, 1.05, 0.95);
  head.position.y = 0.17;
  root.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 5), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.15, 0.155);
  root.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(disguise ? 0.026 : 0.018, 8, 6), new THREE.MeshBasicMaterial({ color: disguise ? 0xff2a2a : 0x1a1410 }));
    eye.position.set(0.055 * s, 0.195, 0.135);
    root.add(eye);
    if (disguise) {
      const g = makeGlow(0xff2a2a, 0.3, 0.95);
      g.position.set(0.055 * s, 0.195, 0.16);
      root.add(g);
    }
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), dark);
    brow.position.set(0.055 * s, 0.232, 0.138);
    brow.rotation.z = (disguise ? 0.35 : -0.1) * s;
    root.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), dark);
  mouth.position.set(0, 0.1, 0.148);
  root.add(mouth);

  if (look === 0) {
    // 闊邊毛氈帽
    const hatMat = std(hat, { roughness: 0.9 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.3, 0.025, 16), hatMat);
    brim.position.y = 0.31;
    brim.rotation.x = -0.08;
    root.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.14, 12), hatMat);
    crown.position.y = 0.39;
    root.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.03, 12), dark);
    band.position.y = 0.34;
    root.add(band);
  } else if (look === 1) {
    // 兜帽
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), std(hat, { roughness: 0.9, side: THREE.DoubleSide }));
    hood.position.set(0, 0.19, -0.03);
    hood.rotation.x = -0.35;
    root.add(hood);
  } else {
    // 頭巾 + 鬍鬚
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), std(hat, { roughness: 0.9 }));
    wrap.position.y = 0.2;
    root.add(wrap);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), std(disguise ? 0x3a3040 : 0x5a4a3a, { roughness: 1 }));
    beard.position.set(0, 0.14, 0.04);
    beard.scale.set(1, 1.1, 0.9);
    root.add(beard);
  }
  return { group: root };
}

/* ===================== 魔物「影魔」（打怪） ===================== */
export function createMonster() {
  const root = new THREE.Group();
  const hide = std(0x2b2233, { roughness: 0.45, metalness: 0.25 });
  const bone = std(0xd8cdb5, { roughness: 0.6 });
  const wingMat = std(0x3a2a48, { roughness: 0.7, side: THREE.DoubleSide });

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), hide);
  torso.scale.set(1.05, 1.15, 0.85);
  torso.position.y = -0.12;
  root.add(torso);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19), hide);
  head.scale.set(1, 0.9, 0.95);
  head.position.y = 0.22;
  root.add(head);
  // 胸口熔岩核
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xff6a2a }));
  core.position.set(0, -0.08, 0.25);
  core.scale.y = 1.6;
  root.add(core);
  const coreGlow = makeGlow(0xff5a1a, 0.45, 0.7);
  coreGlow.position.set(0, -0.08, 0.28);
  root.add(coreGlow);
  for (const s of [-1, 1]) {
    // 彎骨角
    const horn = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.026, 5, 10, Math.PI * 0.6), bone);
    horn.position.set(0.09 * s, 0.28, -0.02);
    horn.rotation.set(0, s > 0 ? 0 : Math.PI, 0.4);
    root.add(horn);
    // 斜長紅眼
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.02), new THREE.MeshBasicMaterial({ color: 0xff3a2a }));
    eye.position.set(0.062 * s, 0.24, 0.165);
    eye.rotation.z = -0.35 * s;
    root.add(eye);
    const glow = makeGlow(0xff3020, 0.38, 0.95);
    glow.position.set(0.062 * s, 0.24, 0.19);
    root.add(glow);
    // 獠牙
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 5), bone);
    fang.rotation.x = Math.PI;
    fang.position.set(0.035 * s, 0.13, 0.16);
    root.add(fang);
    // 爪
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.28, 6), hide);
    arm.position.set(0.31 * s, -0.12, 0.08);
    arm.rotation.z = 0.5 * s;
    root.add(arm);
    for (let k = -1; k <= 1; k++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.08, 4), bone);
      claw.position.set(0.39 * s + k * 0.02, -0.25, 0.12 + k * 0.025);
      claw.rotation.x = Math.PI;
      root.add(claw);
    }
    // 蝠翼
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.lineTo(0.42, 0.3);
    wing.lineTo(0.36, 0.05);
    wing.lineTo(0.3, 0.12);
    wing.lineTo(0.24, -0.06);
    wing.lineTo(0.16, 0.02);
    wing.lineTo(0, -0.14);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(wing), wingMat);
    w.position.set(0.12 * s, 0.02, -0.15);
    w.scale.x = s;
    w.rotation.y = -0.5 * s;
    root.add(w);
  }
  return { group: root };
}
