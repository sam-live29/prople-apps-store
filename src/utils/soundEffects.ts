/**
 * Production-Grade Royalty-Free Audio Synthesizer Engine
 * 
 * Configured strictly for Voice Search auditory cues (listening start chime and recognition earcon).
 * All non-voice ambient/install/tap sound effects have been removed.
 */

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundsMuted(muted: boolean) {
  isAudioMuted = muted;
}

export function isSoundsMuted(): boolean {
  return isAudioMuted;
}

/**
 * 1. Voice Search Listening Start Ping
 * Studio-grade acoustic chime with layered harmonics and analog low-pass filtering.
 * Clean, warm ascending major interval (G#5 -> C#6) with natural acoustic resonance.
 */
export function playVoiceListeningStartSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master warm filter to remove digital harshness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.Q.setValueAtTime(1.2, now);
  filter.connect(ctx.destination);

  // Note 1: G#5 (830.6 Hz) with overtone
  const playChimeNote = (freq: number, startTime: number, duration: number, peakVol: number) => {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    gain1.gain.setValueAtTime(0.0001, startTime);
    gain1.gain.exponentialRampToValueAtTime(peakVol, startTime + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(gain1);
    gain1.connect(filter);
    osc1.start(startTime);
    osc1.stop(startTime + duration + 0.02);

    // Warm second harmonic overtone (at 2x freq, -14dB)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    gain2.gain.setValueAtTime(0.0001, startTime);
    gain2.gain.exponentialRampToValueAtTime(peakVol * 0.22, startTime + 0.012);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

    osc2.connect(gain2);
    gain2.connect(filter);
    osc2.start(startTime);
    osc2.stop(startTime + duration * 0.7 + 0.02);
  };

  // Tone 1: G#5 (830.6 Hz)
  playChimeNote(830.61, now, 0.22, 0.16);

  // Tone 2: C#6 (1108.73 Hz) - ascends seamlessly after 80ms
  playChimeNote(1108.73, now + 0.08, 0.32, 0.20);
}

/**
 * 2. Voice Search Recognized & Captured
 * Studio-grade descending acoustic confirmation earcon (C#6 -> G#5 with warm root G#4).
 * Satisfying, authoritative, and acoustically polished.
 */
export function playVoiceRecognizedSound() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master warm acoustic filter
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, now);
  filter.Q.setValueAtTime(1.0, now);
  filter.connect(ctx.destination);

  const playWarmChime = (freq: number, startTime: number, duration: number, peakVol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakVol, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  };

  // High ping: C#6 (1108.73 Hz)
  playWarmChime(1108.73, now, 0.16, 0.15);

  // Resolving tone: G#5 (830.61 Hz)
  playWarmChime(830.61, now + 0.07, 0.28, 0.18);

  // Sub-warmth root tone: G#4 (415.3 Hz) for rich body
  playWarmChime(415.3, now + 0.07, 0.24, 0.08);
}

/**
 * 3. Native Broadcast Notification Chime
 * Polished, clear triple-tone harmonic alert (E5 -> G#5 -> B5) for incoming global platform broadcasts and test alerts.
 */
export function playNativeBroadcastChime() {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.Q.setValueAtTime(1.0, now);
  filter.connect(ctx.destination);

  const playNote = (freq: number, startTime: number, duration: number, peakVol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakVol, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  };

  playNote(659.25, now, 0.18, 0.16);         // E5
  playNote(830.61, now + 0.08, 0.22, 0.18);  // G#5
  playNote(987.77, now + 0.16, 0.32, 0.22);  // B5
}

// Deprecated non-voice sound stubs kept as safe no-ops
export function playDownloadStartSound(): void {}
export function playInstallCompleteSound(): void {}
export function playReviewSubmittedSound(): void {}
export function playUninstallSound(): void {}
export function playTactileTapSound(): void {}
