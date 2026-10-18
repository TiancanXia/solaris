/**
 * SOLARIS — generative soundscape
 * A quiet, endless observatory: low solar drones, air, reverb, and rare bells.
 * No audio files — everything is synthesised after the user's gesture.
 */

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

const BODY_NOTES = {
  sun: 130.81,
  mercury: 523.25,
  venus: 349.23,
  earth: 392.0,
  mars: 293.66,
  jupiter: 196.0,
  saturn: 220.0,
  uranus: 466.16,
  neptune: 329.63,
};

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.enabled = false;
    this.bellTimer = null;
    this.pendingTimers = new Set();
    this.initialized = false;
  }

  _createImpulse(duration, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * duration));
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  _createNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  async init() {
    if (this.initialized) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('WebAudio unavailable');
    this.ctx = new AC();
    const ctx = this.ctx;
    this.initialized = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._createImpulse(6.5, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet);
    wet.connect(this.master);

    const bus = ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(this.master);
    const busWet = ctx.createGain();
    busWet.gain.value = 0.22;
    bus.connect(busWet);
    busWet.connect(this.reverb);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 0.7;
    droneFilter.connect(bus);

    // solar drones: D1, A1, D2, E2 with slow beating
    const voices = [
      { f: 36.71, type: 'sine', gain: 0.7 },
      { f: 55.0, type: 'sine', gain: 0.42 },
      { f: 73.42, type: 'triangle', gain: 0.16 },
      { f: 82.41, type: 'sine', gain: 0.18 },
      { f: 110.0, type: 'sine', gain: 0.08 },
    ];
    for (const v of voices) {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.f;
      osc.detune.value = (Math.random() - 0.5) * 7;
      const g = ctx.createGain();
      g.gain.value = v.gain;
      osc.connect(g);
      g.connect(droneFilter);
      osc.start();
    }

    // very slow filter breathing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.027;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);
    lfo.start();

    // air / solar wind
    const noise = ctx.createBufferSource();
    noise.buffer = this._createNoiseBuffer(6);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 880;
    bp.Q.value = 0.55;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(bus);
    noise.start();

    // gentle high shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1318.5;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.0025;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.043;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 0.0022;
    shimmerLfo.connect(shimmerLfoGain);
    shimmerLfoGain.connect(shimmerGain.gain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.master);
    shimmer.start();
    shimmerLfo.start();
  }

  async enable() {
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.enabled = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(0.17, now + 2.8);
    this._scheduleBells();
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    clearTimeout(this.bellTimer);
    this.bellTimer = null;
  }

  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    }
    await this.enable();
    return true;
  }

  _scheduleBells() {
    clearTimeout(this.bellTimer);
    if (!this.enabled) return;
    const delay = 12000 + Math.random() * 18000;
    this.bellTimer = setTimeout(() => {
      this._bell(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], 0.022 + Math.random() * 0.02);
      this._scheduleBells();
    }, delay);
  }

  _bell(freq, gain = 0.03, duration = 7) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = gain;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() * 2 - 1) * 0.65;
      bus.connect(panner);
      panner.connect(this.master);
      panner.connect(this.reverb);
    } else {
      bus.connect(this.master);
      bus.connect(this.reverb);
    }
    const partials = [
      { ratio: 1, level: 1 },
      { ratio: 2.003, level: 0.22 },
      { ratio: 3.98, level: 0.08 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.ratio;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(p.level, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration * (p.level > 0.5 ? 1 : 0.72));
      osc.connect(env);
      env.connect(bus);
      osc.start(now);
      osc.stop(now + duration + 0.2);
    }
  }

  bodyChime(key) {
    if (!this.enabled) return;
    const note = BODY_NOTES[key] ?? 392;
    this._bell(note, 0.035, 6.5);
    setTimeout(() => this._bell(note * 1.5, 0.014, 8), 240);
  }

  focusChime(key) {
    this.bodyChime(key);
  }
}
