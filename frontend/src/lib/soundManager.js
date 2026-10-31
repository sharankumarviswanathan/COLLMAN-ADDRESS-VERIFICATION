/**
 * Professional Audio Feedback Engine for COLLMAN SERVICES
 * - Preloads and caches lightweight local audio files via Web Audio API.
 * - Graceful fallback to HTML5 Audio and synthesized waveforms.
 * - Handles browser autoplay restrictions with seamless first-gesture resume.
 * - Enforces intelligent debouncing & throttling to prevent sound overlapping.
 * - 100% non-blocking: never impedes UI responsiveness or business workflows.
 */

const STORAGE_KEY = 'collman_sound_enabled';

// Sound definitions with primary local URLs and synthesized backup params
const SOUND_DEFINITIONS = {
  click: {
    url: '/sounds/click.wav',
    synth: (ctx, out) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(500, t + 0.04);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.045);
    }
  },
  success: {
    url: '/sounds/success.wav',
    synth: (ctx, out) => {
      const t = ctx.currentTime;
      // Tone 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, t);
      gain1.gain.setValueAtTime(0.001, t);
      gain1.gain.linearRampToValueAtTime(0.14, t + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc1.connect(gain1);
      gain1.connect(out);
      osc1.start(t);
      osc1.stop(t + 0.18);

      // Tone 2: G5 (783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(783.99, t + 0.06);
      gain2.gain.setValueAtTime(0.001, t + 0.06);
      gain2.gain.linearRampToValueAtTime(0.15, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc2.connect(gain2);
      gain2.connect(out);
      osc2.start(t + 0.06);
      osc2.stop(t + 0.25);
    }
  },
  alert: {
    url: '/sounds/alert.wav',
    synth: (ctx, out) => {
      const t = ctx.currentTime;
      // Tone 1: F4 (349.23 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(349.23, t);
      gain1.gain.setValueAtTime(0.001, t);
      gain1.gain.linearRampToValueAtTime(0.13, t + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc1.connect(gain1);
      gain1.connect(out);
      osc1.start(t);
      osc1.stop(t + 0.13);

      // Tone 2: D4 (293.66 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(293.66, t + 0.07);
      gain2.gain.setValueAtTime(0.001, t + 0.07);
      gain2.gain.linearRampToValueAtTime(0.14, t + 0.085);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc2.connect(gain2);
      gain2.connect(out);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.23);
    }
  },
  confirm: {
    url: '/sounds/confirm.wav',
    synth: (ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.10);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  }
};

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.audioBuffers = new Map();
    this.audioElements = new Map();
    this.lastPlayedAt = {
      click: 0,
      success: 0,
      alert: 0,
      confirm: 0
    };
    this.isUnlocked = false;
    this.enabled = this.getInitialState();

    // Listen to cross-tab storage changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.enabled = e.newValue !== 'false';
        }
      });
      this.setupUnlockListeners();
      this.preload();
    }
  }

  getInitialState() {
    try {
      if (typeof window === 'undefined') return true;
      const val = localStorage.getItem(STORAGE_KEY);
      return val !== 'false'; // Default ON
    } catch {
      return true;
    }
  }

  isEnabled() {
    return Boolean(this.enabled);
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Could not persist sound setting:', e);
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.play('click');
    }
    return this.enabled;
  }

  getAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          this.audioCtx = new AudioContextClass();
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(0.65, this.audioCtx.currentTime); // Master subtle volume
          this.masterGain.connect(this.audioCtx.destination);
        } catch (e) {
          console.debug('Web Audio initialization note:', e);
        }
      }
    }
    return this.audioCtx;
  }

  setupUnlockListeners() {
    const unlock = () => {
      if (this.isUnlocked) return;
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            this.isUnlocked = true;
          }).catch(() => {});
        } else {
          this.isUnlocked = true;
        }
      }
      // Remove listeners once unlocked
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  async preload() {
    // Preload HTML5 audio elements as secondary fallback pool
    Object.entries(SOUND_DEFINITIONS).forEach(([key, def]) => {
      try {
        const audio = new Audio(def.url);
        audio.preload = 'auto';
        audio.volume = 0.35;
        this.audioElements.set(key, audio);
      } catch (e) {
        // ignore
      }
    });

    // Preload and decode Web Audio buffers for zero-latency playback
    const ctx = this.getAudioContext();
    if (!ctx) return;

    Object.entries(SOUND_DEFINITIONS).forEach(async ([key, def]) => {
      try {
        const res = await fetch(def.url);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          this.audioBuffers.set(key, audioBuf);
        }
      } catch (err) {
        // Will seamlessly fallback to synth or Audio element
        console.debug(`Preload buffer notice for ${key}:`, err);
      }
    });
  }

  play(type) {
    if (!this.enabled) return;
    const now = Date.now();

    // 1. Intelligent Throttling & Debouncing to avoid machine-gunning or overlap
    if (type === 'click') {
      // Don't play click if a major sound was played in the last 100ms
      if (
        now - this.lastPlayedAt.success < 120 ||
        now - this.lastPlayedAt.confirm < 120 ||
        now - this.lastPlayedAt.alert < 120
      ) {
        return;
      }
      // Throttle rapid clicks to max 1 per 65ms
      if (now - this.lastPlayedAt.click < 65) {
        return;
      }
    } else {
      // For success, alert, confirm: prevent duplicate within 250ms
      if (now - (this.lastPlayedAt[type] || 0) < 250) {
        return;
      }
    }

    this.lastPlayedAt[type] = now;

    // 2. Attempt Web Audio Buffer Playback (Primary, Lowest Latency)
    const ctx = this.getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const buffer = this.audioBuffers.get(type);
      if (buffer) {
        try {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.masterGain || ctx.destination);
          source.start(0);
          return;
        } catch (e) {
          console.debug('Buffer play failed, falling back:', e);
        }
      }

      // If buffer not yet decoded, use real-time Web Audio Synthesizer
      const def = SOUND_DEFINITIONS[type];
      if (def && typeof def.synth === 'function') {
        try {
          def.synth(ctx, this.masterGain || ctx.destination);
          return;
        } catch (sErr) {
          console.debug('Synth play failed:', sErr);
        }
      }
    }

    // 3. Fallback: HTML5 Audio Element Pool
    const el = this.audioElements.get(type);
    if (el) {
      try {
        el.currentTime = 0;
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay restriction or silent failure handled safely
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Convenience methods
  click() {
    this.play('click');
  }

  success() {
    this.play('success');
  }

  alert() {
    this.play('alert');
  }

  confirm() {
    this.play('confirm');
  }
}

export const soundManager = new SoundManager();
