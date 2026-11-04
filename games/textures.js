/* 文字貼圖：數字石磚、麻雀牌面、石碑刻字（CanvasTexture，有快取） */
import { THREE } from './engine.js';

const numberTextures = new Map();
export function numberTexture(n) {
  if (numberTextures.has(n)) return numberTextures.get(n);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const fs = n >= 10 ? 140 : 170;
  g.font = `900 ${fs}px Montserrat, "Noto Sans TC", "PingFang HK", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 20;
  g.strokeStyle = 'rgba(5, 12, 30, .92)';
  g.strokeText(String(n), 128, 138);
  g.fillStyle = '#ffffff';
  g.fillText(String(n), 128, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  numberTextures.set(n, tex);
  return tex;
}

