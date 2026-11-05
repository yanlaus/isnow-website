/* 裝備屋：四個部位、各四件；金幣購買、等級解鎖；勇者即刻換裝 */
import { save, persist } from './store.js';
import { snapshot } from './engine.js';
import { buildSword, buildShield, buildCapeThumb, buildHelm } from './models.js';

export const SLOTS = [
  { id: 'sword', name: '劍', icon: 'sword' },
  { id: 'shield', name: '盾', icon: 'shield' },
  { id: 'cape', name: '披風', icon: 'cape' },
  { id: 'helm', name: '頭盔', icon: 'helm' },
];

export const GEAR = {
  sword: [
    { id: 'sword0', name: '鋼劍', price: 0, lv: 1, desc: '見習騎士嘅佩劍', spec: {} },
    { id: 'sword1', name: '秘銀劍', price: 150, lv: 2, desc: '輕巧鋒利，泛藍光', spec: { blade: 0xc4e2f2, len: 0.54, guard: 'wing', metal: 0xd4dae4, gem: 0x2a7fd0 } },
    { id: 'sword2', name: '星輝劍', price: 400, lv: 5, desc: '劍身映住星光', spec: { blade: 0xe6e0ff, len: 0.56, guard: 'wing', metal: 0xc9a24a, gem: 0x8a4cc8, emissive: 0x6a5acd, emissiveIntensity: 0.35, glow: 0xb9a8ff } },
    { id: 'sword3', name: '曙光聖劍', price: 900, lv: 10, desc: '傳說中照亮黎明嘅聖劍', spec: { blade: 0xfff1c8, len: 0.6, width: 0.036, guard: 'wing', metal: 0xe2c27a, gem: 0xe8b84a, emissive: 0xffc860, emissiveIntensity: 0.6, glow: 0xffd27a } },
  ],
  shield: [
    { id: 'shield0', name: '鳶形盾', price: 0, lv: 1, desc: '騎士團制式盾牌', spec: {} },
    { id: 'shield1', name: '王冠紋章盾', price: 120, lv: 2, desc: '刻有王冠紋章', spec: { shape: 'heater', face: 0x6a1a22, emblem: 'crown', rim: true } },
    { id: 'shield2', name: '銀月盾', price: 350, lv: 4, desc: '月光下會微微發亮', spec: { shape: 'round', face: 0xb8c4d4, faceMetal: 0.6, emblem: 'moon', metal: 0x3a4a78, rim: true } },
    { id: 'shield3', name: '聖光盾', price: 800, lv: 9, desc: '擋得住一切邪惡', spec: { shape: 'heater', face: 0xf0e6cc, emblem: 'sun', metal: 0xd4ad4e, rim: true, glow: 0xffd27a } },
  ],
  cape: [
    { id: 'cape0', name: '深紅披風', price: 0, lv: 1, desc: '勇者嘅象徵', spec: {} },
    { id: 'cape1', name: '皇家藍披風', price: 80, lv: 1, desc: '王國近衛隊嘅顏色', spec: { color: 0x1f3a7a, trim: 0xc9a24a } },
    { id: 'cape2', name: '墨黑金邊披風', price: 250, lv: 3, desc: '沉穩威嚴', spec: { color: 0x16161e, trim: 0xd4ad4e } },
    { id: 'cape3', name: '白金披風', price: 600, lv: 8, desc: '只有英雄先配披上', spec: { color: 0xe8e0cc, trim: 0xd4ad4e } },
  ],
  helm: [
    { id: 'helm0', name: '羽飾鋼盔', price: 0, lv: 1, desc: '紅羽飾嘅騎士盔', spec: {} },
    { id: 'helm1', name: '銀翼盔', price: 200, lv: 3, desc: '兩邊有銀色羽翼', spec: { steel: 0xd8dee8, crest: 0xd8dee8, plume: null, wings: 0xeef2f8 } },
    { id: 'helm2', name: '金冠戰盔', price: 500, lv: 6, desc: '戴上金冠，威風凜凜', spec: { crest: 0xd4ad4e, plume: 0x1f3a7a, crown: 0xd4ad4e } },
    { id: 'helm3', name: '龍角盔', price: 700, lv: 8, desc: '屠龍勇者嘅戰利品', spec: { steel: 0x3a3f4c, crest: 0x8a2a2a, plume: null, horns: 0xe8dcc0 } },
  ],
};

export const findGear = id => {
  for (const slot of Object.keys(GEAR)) {
    const it = GEAR[slot].find(g => g.id === id);
    if (it) return { slot, item: it };
  }
  return null;
};

/* 目前裝備 → createHero 用嘅 spec */
export function heroGear(equip = save.equip) {
  const out = {};
  for (const slot of Object.keys(GEAR)) {
    const it = GEAR[slot].find(g => g.id === equip[slot]) || GEAR[slot][0];
    out[slot] = it.spec;
  }
  return out;
}
export const gearKey = (equip = save.equip) => Object.keys(GEAR).map(s => equip[s]).join('-');

const BUILDERS = { sword: buildSword, shield: buildShield, cape: buildCapeThumb, helm: buildHelm };
export function gearThumb(slot, item) {
  return snapshot(`gear-${item.id}`, () => {
    const g = BUILDERS[slot](item.spec);
    if (slot === 'sword') g.rotation.z = -0.6;
    if (slot === 'shield') g.rotation.y = -0.35;
    if (slot === 'helm') g.rotation.y = 0.5;
    return g;
  }, 112);
}

export const owns = id => save.owned.includes(id);
export function gearState(item) {
  const slot = findGear(item.id).slot;
  if (save.equip[slot] === item.id) return 'equipped';
  if (owns(item.id)) return 'owned';
  if (save.level < item.lv) return 'locked';
  if ((save.gold || 0) < item.price) return 'poor';
  return 'buyable';
}
export function buyGear(id) {
  const f = findGear(id);
  if (!f || gearState(f.item) !== 'buyable') return false;
  save.gold -= f.item.price;
  save.owned.push(id);
  save.equip[f.slot] = id;
  persist();
  return true;
}
export function equipGear(id) {
  const f = findGear(id);
  if (!f || !owns(id)) return false;
  save.equip[f.slot] = id;
  persist();
  return true;
}
