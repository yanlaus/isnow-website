/* 音效：Web Audio 即時合成，零外部檔案 */
import { save } from './store.js';

let ctx = null;
let master = null;
let unlocked = false;
let noiseBuf = null;

function ensure() {
  if (save.muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, opts = {}) {
  const c = ensure();
  if (!c) return;
  const { type = 'square', vol = 0.4, slide = 0 } = opts;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(start, dur, { vol = 0.3, freq = 800, q = 0.8 } = {}) {
  const c = ensure();
  if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(freq, t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t0 + dur);
  filt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// 五聲音階：連續答啱一路升調，好似彈緊旋律
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0];
const noteAt = i => SCALE[i % 5] * Math.pow(2, Math.min(Math.floor(i / 5), 2));

export const Sound = {
  unlock() {
    const c = ensure();
    if (!c || unlocked) return;
    // iOS：喺用戶手勢內播一段無聲 buffer 先算真正解鎖
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  },
  setMuted(m) {
    if (ctx) { if (m) ctx.suspend(); else ctx.resume(); }
  },
  hit(i, crit) {
    tone(noteAt(i), 0, 0.12, { vol: 0.3 });
    tone(noteAt(i) * 2, 0.025, 0.09, { type: 'triangle', vol: crit ? 0.3 : 0.14 });
  },
  impact(crit) {
    noise(0, crit ? 0.28 : 0.18, { vol: crit ? 0.5 : 0.32, freq: crit ? 1400 : 900 });
    tone(crit ? 180 : 140, 0, 0.16, { type: 'square', vol: 0.18, slide: 0.5 });
  },
  miss()  { tone(150, 0, 0.24, { type: 'sawtooth', vol: 0.22, slide: 0.55 }); },
  tick()  { tone(660, 0, 0.1, { vol: 0.26 }); },
  go()    { tone(880, 0, 0.1, { vol: 0.3 }); tone(1318.5, 0.09, 0.3, { vol: 0.3 }); },
  rumble() { noise(0, 1.1, { vol: 0.35, freq: 220, q: 0.6 }); },
  step()  { tone(300, 0, 0.045, { type: 'triangle', vol: 0.2 }); },
  bump()  { tone(95, 0, 0.11, { vol: 0.2, slide: 0.8 }); },
  gem() {
    tone(1046.5, 0, 0.08, { type: 'triangle', vol: 0.4 });
    tone(1568, 0.07, 0.2, { type: 'triangle', vol: 0.4 });
  },
  explode() {
    noise(0, 1.2, { vol: 0.6, freq: 600, q: 0.5 });
    tone(110, 0, 0.6, { type: 'sawtooth', vol: 0.2, slide: 0.3 });
  },
  chest() {
    tone(392, 0, 0.1, { type: 'triangle', vol: 0.35 });
    tone(523.25, 0.1, 0.1, { type: 'triangle', vol: 0.35 });
    tone(783.99, 0.2, 0.35, { type: 'triangle', vol: 0.4 });
    noise(0.15, 0.5, { vol: 0.15, freq: 4000, q: 2 });
  },
  victory() {
    const seq = [[392, 0, 0.11], [523.25, 0.12, 0.11], [659.25, 0.24, 0.11], [783.99, 0.36, 0.28],
                 [659.25, 0.66, 0.11], [783.99, 0.78, 0.11], [1046.5, 0.9, 0.55]];
    seq.forEach(([f, s, d]) => {
      tone(f, s, d, { vol: 0.3 });
      tone(f / 2, s, d, { type: 'triangle', vol: 0.2 });
    });
  },
  /* 咒文水晶：每粒一個音高（五聲音階） */
  note(i, dur = 0.42) {
    const f = [392, 523.25, 659.25, 783.99, 880, 1046.5][i % 6];
    tone(f, 0, dur, { type: 'triangle', vol: 0.45 });
    tone(f * 2, 0, dur * 0.6, { type: 'sine', vol: 0.12 });
  },
  ultimate() {
    const c = ensure();
    if (!c) return;
    tone(220, 0, 0.5, { type: 'sawtooth', vol: 0.18, slide: 4 });
    noise(0.35, 0.9, { vol: 0.55, freq: 2500, q: 0.4 });
    tone(110, 0.4, 0.8, { type: 'square', vol: 0.22, slide: 0.4 });
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5 + i * 0.07, 0.3, { type: 'triangle', vol: 0.3 }));
  },
  flip()  { tone(520, 0, 0.07, { type: 'triangle', vol: 0.25 }); tone(780, 0.05, 0.08, { type: 'triangle', vol: 0.2 }); },
  close() { tone(330, 0, 0.08, { type: 'triangle', vol: 0.2, slide: 0.7 }); },
  bite() {
    noise(0, 0.25, { vol: 0.5, freq: 500, q: 1 });
    tone(90, 0, 0.3, { type: 'sawtooth', vol: 0.28, slide: 0.6 });
  },
  coin() {
    tone(1318.5, 0, 0.07, { type: 'square', vol: 0.18 });
    tone(1975.5, 0.06, 0.22, { type: 'square', vol: 0.16 });
  },
  pop()   { tone(600, 0, 0.09, { type: 'sine', vol: 0.3, slide: 1.8 }); },
  whack() {
    noise(0, 0.14, { vol: 0.55, freq: 1200, q: 0.9 });
    tone(200, 0, 0.12, { type: 'square', vol: 0.2, slide: 0.5 });
  },
  oops()  { tone(440, 0, 0.12, { type: 'sine', vol: 0.25 }); tone(392, 0.12, 0.18, { type: 'sine', vol: 0.22 }); },
  rune(i) { tone(SCALE[i % 5] * 0.5 * Math.pow(2, Math.min(Math.floor(i / 5), 3) * 0.25), 0, 0.14, { type: 'triangle', vol: 0.3 }); },
  shuffle() { for (let i = 0; i < 6; i++) noise(i * 0.06, 0.05, { vol: 0.25, freq: 2500 + i * 200, q: 3 }); },
  levelUp() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) =>
      tone(f, i * 0.085, 0.22, { type: 'triangle', vol: 0.42 }));
  },
};

export const buzz = pattern => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* 不支援 */ } };
