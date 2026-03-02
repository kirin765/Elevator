export class HowlerAudioEngine {
  constructor() {
    this.ctx = window.Howler?.ctx || null;
    this.master = null;
    this.tone = null;
    this.toneGain = null;
    this.noiseSource = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.started = false;
  }

  _ensureContext() {
    this.ctx = window.Howler?.ctx || this.ctx;
    if (!this.ctx) {
      return null;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    this._ensureContext();
  }

  start() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    if (this.started) {
      this.master?.gain?.setTargetAtTime(1, ctx.currentTime, 0.12);
      return;
    }

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noise = buffer.getChannelData(0);
    for (let i = 0; i < noise.length; i += 1) {
      noise[i] = Math.random() * 2 - 1;
    }

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.tone = ctx.createOscillator();
    this.tone.type = 'square';
    this.tone.frequency.value = 130;

    this.toneGain = ctx.createGain();
    this.toneGain.gain.value = 0;
    this.tone.connect(this.toneGain).connect(this.master);

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 900;

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;

    this.noiseSource.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);

    this.tone.start();
    this.noiseSource.start();

    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.12);
    this.started = true;
  }

  stop() {
    const ctx = this._ensureContext();
    if (!ctx || !this.started) return;
    this.master?.gain?.setTargetAtTime(0, ctx.currentTime, 0.09);
    this.setContinuousSound(0, false);
  }

  setContinuousSound(level, isHolding) {
    const ctx = this._ensureContext();
    if (!ctx || !this.started) return;

    const clamped = Math.max(0, Math.min(level / 100, 1));
    const freq = isHolding ? 150 + clamped * 210 : 90 + clamped * 140;
    const gain = 0.01 + clamped * (isHolding ? 0.54 : 0.31);
    const noiseLevel = 0.001 + clamped * (isHolding ? 0.055 : 0.028);

    this.tone.frequency.setTargetAtTime(freq, ctx.currentTime, 0.06);
    this.toneGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.08);
    this.noiseFilter.frequency.setTargetAtTime(500 + clamped * 1500, ctx.currentTime, 0.08);
    this.noiseGain.gain.setTargetAtTime(noiseLevel, ctx.currentTime, 0.08);
  }

  beep(freq = 420, duration = 0.12, level = 0.08) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, level), ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  impact() {
    this.beep(520, 0.18, 0.16);
    this.beep(260, 0.1, 0.12);
  }

  cheer() {
    this.beep(430, 0.11, 0.1);
    this.beep(560, 0.11, 0.1);
    this.beep(700, 0.12, 0.1);
  }
}
