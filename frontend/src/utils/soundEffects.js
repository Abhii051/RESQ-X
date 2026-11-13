/**
 * RESQ-X Tactical Web Audio Synthesizer
 * Zero-dependency procedural audio synthesis using browser native Web Audio API
 */

let audioCtx = null;
let sfxEnabled = true;

// Restore audio preference if previously set
try {
  const saved = localStorage.getItem('resqx_sfx_enabled');
  if (saved !== null) {
    sfxEnabled = saved === 'true';
  }
} catch (e) {}

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled() {
  return sfxEnabled;
}

export function toggleSound() {
  sfxEnabled = !sfxEnabled;
  try {
    localStorage.setItem('resqx_sfx_enabled', String(sfxEnabled));
  } catch (e) {}
  if (sfxEnabled) {
    playBlip(900, 0.08);
  }
  return sfxEnabled;
}

export function setSoundEnabled(enabled) {
  sfxEnabled = Boolean(enabled);
  try {
    localStorage.setItem('resqx_sfx_enabled', String(sfxEnabled));
  } catch (e) {}
}

/**
 * Quick tactical blip for UI button clicks, filter changes, and entity selections
 */
export function playBlip(freq = 800, duration = 0.06) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

/**
 * Urgent dual-tone emergency siren for critical SOS intake or emergency escalation
 */
export function playAlertSound() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(659, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.45);
  } catch (e) {}
}

/**
 * Ascending chime chord [C5, E5, G5, C6] for successful allocations and unit dispatch
 */
export function playSuccessChime() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + (idx * 0.08);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch (e) {}
}

/**
 * Descending sawtooth warning pitch for ambulance breakdown, weather storm, or hospital saturation
 */
export function playGlitchDisruption() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.3);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.35);
  } catch (e) {}
}

/**
 * Resonant radar sonar ping
 */
export function playRadarPing() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.5);
  } catch (e) {}
}
