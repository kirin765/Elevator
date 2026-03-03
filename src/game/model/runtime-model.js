import { clamp, randInt } from '../config.js';

export class RuntimeModel {
  constructor(config) {
    this.config = config;
    this.warningGiven = false;
    this.dangerGiven = false;
    this.gasWarningGiven = false;
    this.gasDangerGiven = false;
    this.finished = false;
    this.state = this._initialState();
    this._runRng = null;
  }

  _initialState() {
    const maxFloor = this._resolveMaxTargetFloor();
    return {
      phase: 'intro',
      elapsedMs: 0,
      introElapsedMs: 0,
      pressure: 14,
      smellLevel: 0,
      soundLevel: 0,
      isHolding: false,
      currentFloor: 1,
      targetFloor: this.config.targetFloor || maxFloor,
      effectiveTravelMs: this.config.travelDurationMs,
      runSeed: null,
      gasDecayLingerMs: 0,
    };
  }

  startIntro() {
    this.state = this._initialState();
    this.warningGiven = false;
    this.dangerGiven = false;
    this.gasWarningGiven = false;
    this.gasDangerGiven = false;
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
    this.state.gasDecayLingerMs = 0;
    this.state.runSeed = Number.isFinite(seed) ? Number(seed) : Date.now();
    this._runRng = this._createSeedRng(this.state.runSeed);
    const minFloor = Number(this.config.minTargetFloor || 1);
    const maxFloor = this._resolveMaxTargetFloor();
    const maxValue = Math.max(minFloor, maxFloor);
    const minValue = Math.min(minFloor, maxFloor);
    const span = maxValue - minValue;
    const randomOffset = span > 0 ? randInt(this._runRng, minValue, maxValue) : minValue;
    this.state.targetFloor = clamp(randomOffset, minValue, maxValue);
    this.state.effectiveTravelMs = this._resolveEffectiveTravelMs(this.state.targetFloor);
    this.warningGiven = false;
    this.dangerGiven = false;
    this.gasWarningGiven = false;
    this.gasDangerGiven = false;
    this.finished = false;
  }

  _resolveMaxTargetFloor() {
    return Number(this.config.maxTargetFloor || this.config.targetFloor || 10);
  }

  _resolveEffectiveTravelMs(targetFloor) {
    const maxFloor = this._resolveMaxTargetFloor();
    const maxSafe = Math.max(1, maxFloor);
    const floorSafe = clamp(targetFloor || 0, 1, maxSafe);
    return Math.max(1, (this.config.travelDurationMs || 0) * (floorSafe / maxSafe));
  }

  _createSeedRng(seed) {
    let state = Number(seed) >>> 0;
    if (!Number.isFinite(state) || state <= 0) {
      state = 1;
    }
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let z = Math.imul(state ^ (state >>> 15), 1 | state);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return (((z ^ (z >>> 14)) >>> 0) / 4294967296);
    };
  }

  riskFromPressure() {
    if (this.state.pressure >= this.config.dangerThreshold) return 'danger';
    if (this.state.pressure >= this.config.warnThreshold) return 'warn';
    return 'stable';
  }

  riskFromGas() {
    if (this.state.smellLevel >= this.config.gasFailThreshold) return 'panic';
    if (this.state.smellLevel >= this.config.gasDangerThreshold) return 'danger';
    if (this.state.smellLevel >= this.config.gasWarnThreshold) return 'warn';
    return 'stable';
  }

  onHoldStart() {
    if (this.state.phase !== 'running' || this.finished || this.state.isHolding) {
      return false;
    }
    this.state.isHolding = true;
    this.state.pressure = clamp(this.state.pressure - this.config.pressureReleasePerSec * 0.15, 0, this.config.pressureMax);
    this.state.smellLevel = clamp(this.state.smellLevel + (this.config.fartGasBurst || 12), 0, 100);
    this.state.soundLevel = clamp(this.state.soundLevel + 12, 0, 100);
    this.state.gasDecayLingerMs = this.config.gasDecayLingerMs || 0;
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
    const previousSmell = this.state.smellLevel;
    this.state.elapsedMs += dtMs;
    if (this.state.gasDecayLingerMs > 0) {
      this.state.gasDecayLingerMs = Math.max(0, this.state.gasDecayLingerMs - dtMs);
    }

    if (this.state.isHolding) {
      this.state.pressure = clamp(this.state.pressure - this.config.pressureReleasePerSec * dt, 0, this.config.pressureMax);
      this.state.smellLevel = clamp(this.state.smellLevel + 35 * dt, 0, 100);
      this.state.soundLevel = clamp(this.state.soundLevel + 55 * dt, 0, 100);
    } else {
      this.state.pressure = clamp(this.state.pressure + this.config.pressureRisePerSec * dt, 0, this.config.pressureMax);
      if (this.state.gasDecayLingerMs <= 0) {
        this.state.smellLevel = clamp(
          this.state.smellLevel - (this.config.smellDrainPerSec || 14) * dt,
          0,
          100,
        );
      }
      this.state.soundLevel = clamp(this.state.soundLevel - 15 * dt, 0, 100);
    }

    this.state.soundLevel = clamp(this.state.soundLevel + this.state.pressure * 0.08 * dt, 0, 100);
    const effectiveTravelMs = Math.max(1, this.state.effectiveTravelMs || this.config.travelDurationMs);
    const floorSpan = Math.max(1, this.state.targetFloor - 1);
    this.state.currentFloor = clamp(
      Math.floor((this.state.elapsedMs / effectiveTravelMs) * floorSpan) + 1,
      1,
      this.state.targetFloor,
    );

    if (!this.warningGiven && previousPressure < this.config.warnThreshold && this.state.pressure >= this.config.warnThreshold) {
      this.warningGiven = true;
      events.push({ type: 'warn' });
    }

    if (!this.dangerGiven && previousPressure < this.config.dangerThreshold && this.state.pressure >= this.config.dangerThreshold) {
      this.dangerGiven = true;
      events.push({ type: 'danger' });
    }

    if (
      !this.gasWarningGiven &&
      previousSmell < this.config.gasWarnThreshold &&
      this.state.smellLevel >= this.config.gasWarnThreshold
    ) {
      this.gasWarningGiven = true;
      events.push({ type: 'gasWarn' });
    }

    if (
      !this.gasDangerGiven &&
      previousSmell < this.config.gasDangerThreshold &&
      this.state.smellLevel >= this.config.gasDangerThreshold
    ) {
      this.gasDangerGiven = true;
      events.push({ type: 'gasDanger' });
    }

    if (this.state.pressure >= this.config.pressureMax) {
      this.applyFail();
      events.push({ type: 'fail' });
      return events;
    }

    if (this.state.smellLevel >= this.config.gasFailThreshold) {
      this.applyFail();
      events.push({ type: 'fail', reason: 'gas' });
      return events;
    }

    if (this.state.currentFloor >= this.state.targetFloor) {
      this.applySuccess();
      events.push({ type: 'success' });
      return events;
    }

    return events;
  }
}
