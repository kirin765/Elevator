import { clamp } from '../config.js';

export class RuntimeModel {
  constructor(config) {
    this.config = config;
    this.warningGiven = false;
    this.dangerGiven = false;
    this.finished = false;
    this.state = this._initialState();
  }

  _initialState() {
    return {
      phase: 'intro',
      elapsedMs: 0,
      introElapsedMs: 0,
      pressure: 14,
      smellLevel: 0,
      soundLevel: 0,
      isHolding: false,
      currentFloor: 1,
      targetFloor: this.config.targetFloor,
      runSeed: null,
    };
  }

  startIntro() {
    this.state = this._initialState();
    this.warningGiven = false;
    this.dangerGiven = false;
    this.finished = false;
  }

  beginRun(seed) {
    this.state.phase = 'running';
    this.state.elapsedMs = 0;
    this.state.introElapsedMs = 0;
    this.state.currentFloor = 1;
    this.state.smellLevel = 0;
    this.state.soundLevel = 0;
    this.state.isHolding = false;
    this.state.pressure = 14;
    this.state.runSeed = seed;
    this.warningGiven = false;
    this.dangerGiven = false;
    this.finished = false;
  }

  riskFromPressure() {
    if (this.state.pressure >= this.config.dangerThreshold) return 'danger';
    if (this.state.pressure >= this.config.warnThreshold) return 'warn';
    return 'stable';
  }

  onHoldStart() {
    if (this.state.phase !== 'running' || this.finished || this.state.isHolding) {
      return false;
    }
    this.state.isHolding = true;
    this.state.pressure = clamp(this.state.pressure - this.config.pressureReleasePerSec * 0.15, 0, this.config.pressureMax);
    this.state.smellLevel = clamp(this.state.smellLevel + 8, 0, 100);
    this.state.soundLevel = clamp(this.state.soundLevel + 12, 0, 100);
    return true;
  }

  onHoldEnd() {
    this.state.isHolding = false;
  }

  applySuccess() {
    this.finished = true;
    this.state.phase = 'success';
  }

  applyFail() {
    this.finished = true;
    this.state.phase = 'fail';
    this.state.pressure = this.config.pressureMax;
    this.state.isHolding = false;
  }

  update(dtMs) {
    const events = [];

    if (this.state.phase === 'intro') {
      this.state.introElapsedMs += dtMs;
      if (this.state.introElapsedMs >= this.config.introDurationMs) {
        events.push({ type: 'introComplete' });
      }
      return events;
    }

    if (this.state.phase !== 'running' || this.finished) {
      return events;
    }

    const dt = dtMs / 1000;
    const previousPressure = this.state.pressure;
    this.state.elapsedMs += dtMs;

    if (this.state.isHolding) {
      this.state.pressure = clamp(this.state.pressure - this.config.pressureReleasePerSec * dt, 0, this.config.pressureMax);
      this.state.smellLevel = clamp(this.state.smellLevel + 35 * dt, 0, 100);
      this.state.soundLevel = clamp(this.state.soundLevel + 55 * dt, 0, 100);
    } else {
      this.state.pressure = clamp(this.state.pressure + this.config.pressureRisePerSec * dt, 0, this.config.pressureMax);
      this.state.smellLevel = clamp(this.state.smellLevel - 18 * dt, 0, 100);
      this.state.soundLevel = clamp(this.state.soundLevel - 15 * dt, 0, 100);
    }

    this.state.soundLevel = clamp(this.state.soundLevel + this.state.pressure * 0.08 * dt, 0, 100);
    this.state.currentFloor = clamp(
      Math.floor((this.state.elapsedMs / this.config.travelDurationMs) * this.config.targetFloor) + 1,
      1,
      this.config.targetFloor,
    );

    if (!this.warningGiven && previousPressure < this.config.warnThreshold && this.state.pressure >= this.config.warnThreshold) {
      this.warningGiven = true;
      events.push({ type: 'warn' });
    }

    if (!this.dangerGiven && previousPressure < this.config.dangerThreshold && this.state.pressure >= this.config.dangerThreshold) {
      this.dangerGiven = true;
      events.push({ type: 'danger' });
    }

    if (this.state.pressure >= this.config.pressureMax) {
      this.applyFail();
      events.push({ type: 'fail' });
      return events;
    }

    if (this.state.elapsedMs >= this.config.travelDurationMs) {
      this.applySuccess();
      events.push({ type: 'success' });
      return events;
    }

    return events;
  }
}
