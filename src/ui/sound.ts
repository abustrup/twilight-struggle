// ============================================================================
// sound.ts — Lightweight Web Audio sound effects, synthesized at runtime.
// No audio asset files: every effect is generated from oscillators / noise, so
// it works offline, adds nothing to the bundle, and is easy to tune.
//
// The AudioContext is created lazily on the first playSound() call (which always
// happens inside a user gesture — a click — so browser autoplay policies are
// satisfied). Mute state persists in localStorage.
// ============================================================================

const STORAGE_KEY = 'twilight-struggle.muted';

let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean): void {
  muted = m;
  try { localStorage.setItem(STORAGE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach((l) => l(m));
}
export function toggleMuted(): boolean { setMuted(!muted); return muted; }
export function onMuteChange(l: (m: boolean) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
  return ctx;
}

interface ToneOpts { freq: number; dur: number; type?: OscillatorType; gain?: number; delay?: number; slideTo?: number }
function tone(c: AudioContext, o: ToneOpts): void {
  const { freq, dur, type = 'sine', gain = 0.18, delay = 0, slideTo } = o;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

interface NoiseOpts { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; delay?: number }
function noise(c: AudioContext, o: NoiseOpts): void {
  const { dur, gain = 0.25, type = 'lowpass', freq = 1000, delay = 0 } = o;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export type SoundName =
  | 'place' | 'placeUS' | 'placeUSSR' | 'ui' | 'select' | 'card' | 'confirm'
  | 'coup' | 'realign' | 'space' | 'defconDown' | 'defconUp' | 'vp'
  | 'win' | 'lose' | 'error' | 'headline' | 'undo';

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  switch (name) {
    case 'placeUS':
      tone(c, { freq: 620, dur: 0.09, type: 'triangle', gain: 0.14 });
      tone(c, { freq: 930, dur: 0.07, type: 'triangle', gain: 0.08, delay: 0.02 });
      break;
    case 'placeUSSR':
      tone(c, { freq: 540, dur: 0.09, type: 'triangle', gain: 0.14 });
      tone(c, { freq: 810, dur: 0.07, type: 'triangle', gain: 0.08, delay: 0.02 });
      break;
    case 'place':
      tone(c, { freq: 600, dur: 0.08, type: 'triangle', gain: 0.13 });
      break;
    case 'ui':
      tone(c, { freq: 320, dur: 0.045, type: 'square', gain: 0.05 });
      break;
    case 'select':
      tone(c, { freq: 480, dur: 0.06, type: 'sine', gain: 0.1 });
      break;
    case 'confirm':
      tone(c, { freq: 520, dur: 0.08, type: 'sine', gain: 0.12 });
      tone(c, { freq: 780, dur: 0.11, type: 'sine', gain: 0.1, delay: 0.06 });
      break;
    case 'card':
      tone(c, { freq: 180, dur: 0.13, type: 'sine', gain: 0.16 });
      noise(c, { dur: 0.08, gain: 0.05, freq: 2500, type: 'highpass' });
      break;
    case 'headline':
      tone(c, { freq: 300, dur: 0.18, type: 'sawtooth', gain: 0.08, slideTo: 540 });
      break;
    case 'coup':
      noise(c, { dur: 0.45, gain: 0.3, freq: 900 });
      tone(c, { freq: 90, dur: 0.4, type: 'sine', gain: 0.22, slideTo: 40 });
      break;
    case 'realign':
      noise(c, { dur: 0.18, gain: 0.14, freq: 1600 });
      tone(c, { freq: 240, dur: 0.16, type: 'sawtooth', gain: 0.1, slideTo: 160 });
      break;
    case 'space':
      tone(c, { freq: 260, dur: 0.5, type: 'sine', gain: 0.16, slideTo: 1100 });
      noise(c, { dur: 0.5, gain: 0.05, freq: 1200, type: 'bandpass' });
      break;
    case 'defconDown':
      tone(c, { freq: 300, dur: 0.5, type: 'sawtooth', gain: 0.14, slideTo: 150 });
      tone(c, { freq: 150, dur: 0.5, type: 'square', gain: 0.06, delay: 0.05 });
      break;
    case 'defconUp':
      tone(c, { freq: 400, dur: 0.3, type: 'sine', gain: 0.12, slideTo: 720 });
      break;
    case 'vp':
      tone(c, { freq: 660, dur: 0.12, type: 'sine', gain: 0.12 });
      tone(c, { freq: 990, dur: 0.16, type: 'sine', gain: 0.1, delay: 0.07 });
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, dur: 0.28, type: 'triangle', gain: 0.14, delay: i * 0.11 }));
      break;
    case 'lose':
      [440, 370, 294, 220].forEach((f, i) => tone(c, { freq: f, dur: 0.34, type: 'sine', gain: 0.14, delay: i * 0.14 }));
      break;
    case 'error':
      tone(c, { freq: 140, dur: 0.16, type: 'sawtooth', gain: 0.12 });
      break;
    case 'undo':
      tone(c, { freq: 460, dur: 0.08, type: 'sine', gain: 0.1, slideTo: 300 });
      break;
  }
}
