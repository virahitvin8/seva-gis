/**
 * SEVA.GIS Tactical Field Audio, Voice Guidance & Device Sensor Utilities
 * Zero proprietary assets: synthesizes crisp tactile audio cues via Web Audio API,
 * speaks distance/bearing navigation prompts via Web Speech API, and provides
 * torch/flashlight control helpers for Android WebView & mobile browsers.
 */

export type FieldAlertTone = 'fix-acquired' | 'fix-lost' | 'proximity' | 'speed-alert' | 'pin-drop';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a distinct Web Audio API synthesized tactical cue without external MP3 assets.
 */
export function playFieldTone(tone: FieldAlertTone): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const playBeep = (freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine', gainPeak = 0.16) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    switch (tone) {
      case 'fix-acquired':
        playBeep(660, 0, 0.11, 'sine');
        playBeep(880, 0.12, 0.16, 'sine');
        break;
      case 'fix-lost':
        playBeep(440, 0, 0.14, 'triangle');
        playBeep(293.66, 0.15, 0.22, 'triangle');
        break;
      case 'proximity':
        playBeep(987.77, 0, 0.12, 'sine', 0.2);
        playBeep(1318.51, 0.14, 0.12, 'sine', 0.2);
        playBeep(1567.98, 0.28, 0.24, 'sine', 0.2);
        break;
      case 'speed-alert':
        playBeep(784, 0, 0.14, 'square', 0.12);
        playBeep(784, 0.18, 0.14, 'square', 0.12);
        break;
      case 'pin-drop':
        playBeep(523.25, 0, 0.08, 'sine', 0.14);
        break;
    }
  } catch {
    // Ignore audio context autoplay errors until user gesture
  }
}

/**
 * Speaks tactical distance & direction guidance via browser/WebView TTS engine.
 */
export function speakFieldGuidance(text: string, langCode: 'en' | 'te' | 'hi' = 'en'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode === 'te' ? 'te-IN' : langCode === 'hi' ? 'hi-IN' : 'en-IN';
    utter.rate = 1.02;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech synthesis unavailable
  }
}

/**
 * Formats distance cleanly for voice guidance & UI callouts.
 */
export function formatGuidanceDistance(meters: number, unitSystem: 'metric' | 'imperial' | 'nautical' = 'metric'): string {
  if (unitSystem === 'imperial') {
    const feet = meters * 3.28084;
    if (feet >= 5280) return `${(feet / 5280).toFixed(2)} miles`;
    return `${Math.round(feet)} feet`;
  }
  if (unitSystem === 'nautical') {
    const nm = meters / 1852;
    if (nm >= 0.2) return `${nm.toFixed(2)} nm`;
    return `${Math.round(meters)} m`;
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Formats speed according to user unit system.
 */
export function formatSpeedUnit(kmh: number, unitSystem: 'metric' | 'imperial' | 'nautical' = 'metric'): string {
  if (unitSystem === 'imperial') return `${(kmh * 0.621371).toFixed(1)} mph`;
  if (unitSystem === 'nautical') return `${(kmh * 0.539957).toFixed(1)} kt`;
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Attempts to toggle native camera hardware torch via MediaStreamTrack constraints.
 * Returns whether hardware torch control succeeded (callers can use screen-torch fallback if false).
 */
export async function setCameraStreamTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    const capabilities = (track.getCapabilities?.() as any) || {};
    if (capabilities && 'torch' in capabilities) {
      await track.applyConstraints({ advanced: [{ torch: enabled } as any] });
      return true;
    }
  } catch {
    // Hardware torch not supported on this track
  }
  return false;
}

