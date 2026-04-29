// v3.9.0：音频系统（WebAudio 合成骨架，无需外部资源）
// localStorage key: sp_audio_v1
const KEY = 'sp_audio_v1';

export interface AudioSettings {
  master: number; // 0-1
  sfx: number;
  bgm: number;
}

const DEFAULT: AudioSettings = { master: 0.7, sfx: 0.8, bgm: 0.4 };

let settings: AudioSettings = load();

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let bgmNodes: { osc1: OscillatorNode; osc2: OscillatorNode; lfo: OscillatorNode } | null = null;
let bgmRunning = false;

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw);
    return { ...DEFAULT, ...p };
  } catch {
    return { ...DEFAULT };
  }
}

function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor() as AudioContext;
    masterGain = ctx.createGain(); masterGain.gain.value = settings.master; masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = settings.sfx; sfxGain.connect(masterGain);
    bgmGain = ctx.createGain(); bgmGain.gain.value = settings.bgm; bgmGain.connect(masterGain);
    return ctx;
  } catch {
    return null;
  }
}

export type SfxId = 'deploy' | 'shoot' | 'hit' | 'wave_clear' | 'wave_fail' | 'click' | 'event' | 'achievement';

interface SfxPreset { freq: number; type: OscillatorType; dur: number; sweep?: number; gain?: number; }

const SFX_PRESETS: Record<SfxId, SfxPreset> = {
  deploy:      { freq: 440, type: 'sine',     dur: 0.18, sweep: 220, gain: 0.25 },
  shoot:       { freq: 880, type: 'square',   dur: 0.05, sweep: -200, gain: 0.12 },
  hit:         { freq: 220, type: 'sawtooth', dur: 0.10, gain: 0.20 },
  wave_clear:  { freq: 523, type: 'triangle', dur: 0.45, sweep: 440, gain: 0.30 },
  wave_fail:   { freq: 220, type: 'sawtooth', dur: 0.6,  sweep: -120, gain: 0.30 },
  click:       { freq: 700, type: 'square',   dur: 0.04, gain: 0.15 },
  event:       { freq: 520, type: 'sine',     dur: 0.25, sweep: 120, gain: 0.22 },
  achievement: { freq: 740, type: 'triangle', dur: 0.55, sweep: 540, gain: 0.30 },
};

export function playSfx(id: SfxId): void {
  const c = ensureCtx();
  if (!c || !sfxGain) return;
  const p = SFX_PRESETS[id];
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.freq, now);
  if (p.sweep) osc.frequency.linearRampToValueAtTime(Math.max(40, p.freq + p.sweep), now + p.dur);
  g.gain.setValueAtTime(p.gain ?? 0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.connect(g).connect(sfxGain);
  osc.start(now); osc.stop(now + p.dur + 0.02);
}

export function startBgm(): void {
  const c = ensureCtx();
  if (!c || !bgmGain || bgmRunning) return;
  const osc1 = c.createOscillator(); osc1.type = 'sine';     osc1.frequency.value = 110;
  const osc2 = c.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 165;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
  const lfoGain = c.createGain(); lfoGain.gain.value = 6;
  lfo.connect(lfoGain).connect(osc1.frequency);
  const mix = c.createGain(); mix.gain.value = 0.15;
  osc1.connect(mix); osc2.connect(mix); mix.connect(bgmGain);
  osc1.start(); osc2.start(); lfo.start();
  bgmNodes = { osc1, osc2, lfo };
  bgmRunning = true;
}

export function stopBgm(): void {
  if (!bgmRunning || !bgmNodes) return;
  try { bgmNodes.osc1.stop(); bgmNodes.osc2.stop(); bgmNodes.lfo.stop(); } catch {}
  bgmNodes = null;
  bgmRunning = false;
}

export function isBgmRunning(): boolean { return bgmRunning; }

export function getAudioSettings(): AudioSettings { return { ...settings }; }

export function setAudioSetting(k: keyof AudioSettings, v: number): void {
  settings[k] = Math.max(0, Math.min(1, v));
  save();
  if (!ctx) return;
  if (k === 'master' && masterGain) masterGain.gain.value = settings.master;
  if (k === 'sfx' && sfxGain) sfxGain.gain.value = settings.sfx;
  if (k === 'bgm' && bgmGain) bgmGain.gain.value = settings.bgm;
}
