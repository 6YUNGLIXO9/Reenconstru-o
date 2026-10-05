// Áudio procedural (WebAudio) com canais separados: geral, música, efeitos, diálogos, ambiente.
import { getSettings } from './save';

let ctx: AudioContext | null = null;
let master: GainNode, gains: Record<string, GainNode> = {};
let noiseBuf: AudioBuffer | null = null;
let musicNodes: AudioNode[] = [];
let ambTimer: any = null;
let ambTheme = '';

function init() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch { return null; }
  master = ctx.createGain(); master.connect(ctx.destination);
  for (const k of ['music', 'sfx', 'dialog', 'ambient']) { gains[k] = ctx.createGain(); gains[k].connect(master); }
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return ctx;
}
export function applyVolumes() {
  if (!ctx) return;
  const a = getSettings().audio;
  const m = a.mute ? 0 : a.master / 100;
  master.gain.value = m;
  gains.music.gain.value = (a.music / 100) * 0.5;
  gains.sfx.gain.value = a.sfx / 100;
  gains.dialog.gain.value = a.dialog / 100;
  gains.ambient.gain.value = (a.ambient / 100) * 0.6;
}
export function resume() { const c = init(); if (c && c.state === 'suspended') c.resume(); }

function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, f2?: number, ch = 'sfx', delay = 0) {
  const c = init(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(gains[ch]); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol = 0.3, ft: BiquadFilterType = 'lowpass', f0 = 1000, f1 = 300, ch = 'sfx', delay = 0, q = 1) {
  const c = init(); if (!c || !noiseBuf) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = ft; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(gains[ch]); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export function sfx(n: string) {
  if (!ctx) return;
  switch (n) {
    case 'slash': noise(0.22, 0.35, 'bandpass', 600, 2400, 'sfx', 0, 0.8); break;
    case 'heavy': noise(0.4, 0.55, 'bandpass', 300, 1500, 'sfx', 0, 0.6); tone(70, 0.35, 'sawtooth', 0.25, 40); break;
    case 'hit': noise(0.15, 0.5, 'lowpass', 1800, 200); tone(120, 0.12, 'square', 0.2, 60); break;
    case 'hitHeavy': noise(0.3, 0.7, 'lowpass', 2200, 120); tone(60, 0.3, 'sawtooth', 0.4, 28); break;
    case 'clang': tone(900, 0.25, 'square', 0.15, 700); tone(1350, 0.2, 'triangle', 0.15); noise(0.08, 0.3, 'highpass', 3000, 3000); break;
    case 'cannon': noise(0.6, 0.9, 'lowpass', 2500, 80); tone(90, 0.5, 'sawtooth', 0.5, 25); break;
    case 'explosion': noise(0.9, 0.9, 'lowpass', 1800, 60); tone(55, 0.7, 'sine', 0.6, 22); break;
    case 'bolt': tone(1200, 0.08, 'square', 0.12, 400); noise(0.07, 0.2, 'highpass', 2500, 1500); break;
    case 'reload': tone(500, 0.05, 'square', 0.1); tone(700, 0.05, 'square', 0.1, undefined, 'sfx', 0.12); break;
    case 'step': noise(0.07, 0.12, 'lowpass', 500, 200); break;
    case 'dodge': noise(0.3, 0.3, 'bandpass', 400, 1500, 'sfx', 0, 0.5); break;
    case 'hurt': tone(220, 0.25, 'sawtooth', 0.3, 110, 'dialog'); noise(0.12, 0.4, 'lowpass', 900, 200); break;
    case 'die': tone(180, 0.6, 'sawtooth', 0.3, 50, 'dialog'); break;
    case 'roar': tone(90, 1.2, 'sawtooth', 0.5, 50, 'dialog'); tone(135, 1.2, 'square', 0.25, 70, 'dialog'); noise(1.0, 0.3, 'lowpass', 800, 150, 'dialog'); break;
    case 'bossDie': tone(70, 2, 'sawtooth', 0.5, 25, 'dialog'); noise(1.8, 0.6, 'lowpass', 1500, 60); break;
    case 'rage': tone(60, 1.2, 'sawtooth', 0.45, 180, 'dialog'); noise(1.0, 0.4, 'bandpass', 200, 1800); break;
    case 'heal': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'sine', 0.15, undefined, 'sfx', i * 0.07)); break;
    case 'summon': tone(110, 1, 'sine', 0.4, 330); noise(0.8, 0.3, 'bandpass', 300, 1200); break;
    case 'magic': tone(660, 0.5, 'sine', 0.2, 1320); tone(990, 0.5, 'triangle', 0.1, 1980); break;
    case 'wave': noise(0.6, 0.4, 'bandpass', 200, 1200, 'sfx', 0, 2); tone(80, 0.5, 'sine', 0.3, 160); break;
    case 'blink': tone(1500, 0.2, 'sine', 0.2, 200); noise(0.2, 0.25, 'highpass', 4000, 1000); break;
    case 'warn': tone(300, 0.15, 'square', 0.08, 220); break;
    case 'ui': tone(440, 0.06, 'square', 0.06, 660, 'sfx'); break;
    case 'buy': tone(660, 0.1, 'triangle', 0.15); tone(990, 0.2, 'triangle', 0.15, undefined, 'sfx', 0.08); break;
    case 'pickup': tone(880, 0.1, 'sine', 0.2); tone(1320, 0.25, 'sine', 0.2, undefined, 'sfx', 0.08); break;
    case 'behelit': tone(220, 1.5, 'sine', 0.4, 110, 'dialog'); tone(223, 1.5, 'sine', 0.4, 112, 'dialog'); noise(1.2, 0.4, 'bandpass', 400, 4000, 'sfx', 0, 3); break;
    case 'eclipse': for (let i = 0; i < 6; i++) tone(55 * (1 + i * 0.5), 5, 'sawtooth', 0.12, 40 * (1 + i * 0.5), 'music'); noise(5, 0.4, 'lowpass', 400, 80, 'ambient'); break;
    case 'gust': noise(0.8, 0.45, 'bandpass', 400, 2500, 'sfx', 0, 1.5); break;
    case 'win': [392, 494, 587, 784].forEach((f, i) => tone(f, 0.8, 'triangle', 0.2, undefined, 'music', i * 0.18)); break;
    case 'lose': [330, 262, 196, 131].forEach((f, i) => tone(f, 1, 'sawtooth', 0.15, undefined, 'music', i * 0.3)); break;
  }
}

export function stopMusic() {
  musicNodes.forEach((n) => { try { (n as any).stop?.(); n.disconnect(); } catch { /* */ } });
  musicNodes = [];
  if (ambTimer) { clearInterval(ambTimer); ambTimer = null; }
}
export function startMusic(theme: string) {
  const c = init(); if (!c) return;
  if (ambTheme === theme && musicNodes.length) return;
  stopMusic(); ambTheme = theme;
  const dark = ['eclipse', 'valley', 'flesh', 'altar'].includes(theme);
  const base = dark ? 41.2 : theme === 'falconia' ? 98 : theme === 'camp' ? 55 : 48.99;
  const freqs = dark ? [base, base * 1.0595, base * 1.5, base * 2.118] : [base, base * 1.5, base * 2, base * 1.2599];
  freqs.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
    g.gain.value = 0.05 / (1 + i * 0.4);
    l.frequency.value = 0.05 + i * 0.03; lg.gain.value = 0.03; l.connect(lg); lg.connect(g.gain);
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = dark ? 500 : 700;
    o.connect(flt); flt.connect(g); g.connect(gains.music); o.start(); l.start();
    musicNodes.push(o, l);
  });
  // vento
  const w = c.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
  const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = dark ? 250 : 500; wf.Q.value = 0.7;
  const wg = c.createGain(); wg.gain.value = 0.35;
  const wl = c.createOscillator(), wlg = c.createGain(); wl.frequency.value = 0.12; wlg.gain.value = 0.2; wl.connect(wlg); wlg.connect(wg.gain);
  w.connect(wf); wf.connect(wg); wg.connect(gains.ambient); w.start(); wl.start();
  musicNodes.push(w, wl);
  ambTimer = setInterval(() => { // fogueiras e sons ambientes
    if (!ctx) return;
    noise(0.05, 0.15, 'highpass', 2000, 2000, 'ambient');
    if (Math.random() < 0.15) tone(dark ? 80 : 400 + Math.random() * 300, 0.6, 'sine', 0.05, undefined, 'ambient');
  }, 450);
}
