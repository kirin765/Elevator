import {
  GAME_CONFIG,
  CHARACTER_CATALOG,
  PASSENGER_POSITIONS,
  HERO_SIZE,
  NPC_SIZE,
  clamp,
  randInt,
  randPick,
  makeRng,
  hashCode,
} from '../config.js';
import { RuntimeModel } from '../model/runtime-model.js';
import { HowlerAudioEngine } from '../audio/howler-audio.js';
import { AtlasCharacterFactory, normalizeModel } from '../characters/atlas-character-factory.js';
import { createRexUi } from '../ui/rex-ui-factory.js';

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
    this.modelConfig = GAME_CONFIG;
    this.runtime = null;
    this.audioEngine = null;
    this.characterFactory = null;
    this.ui = null;
    this.heroSeed = 1;
    this.rng = null;
    this.heroModel = null;
    this.characters = [];
    this.heroCharacter = null;
    this.passengerCharacters = [];
    this.passengerModels = [];
    this.currentMood = 'stable';
    this.manualStepping = false;
    this.nextImpulseAt = 0;
    this.motionTick = 0;
    this.lastRepairAt = 0;
    this.lastMissingSummaryAt = 0;
    this.lastMissingSummaryText = '';
    this.missingLog = new Set();
    this.audioUnlocked = false;
    this.gasCloud = null;
    this.gasCloudPulse = 0;
  }

  create() {
    this.runtime = new RuntimeModel(this.modelConfig);
    this.audioEngine = new HowlerAudioEngine();
    this.characterFactory = new AtlasCharacterFactory(this, this.modelConfig);
    this.heroSeed = hashCode(`${window.location.pathname}|hero`);

    this._drawBackdrop();
    this._createPhysicsWorld();

    this.ui = createRexUi(this, this.modelConfig);
    this._bindInput();

    this.heroModel = this._makeModel(makeRng(this.heroSeed), true);
    this._createCharacters();
    this.startIntro();
  }

  _drawBackdrop() {
    const width = this.scale.width;
    const height = this.scale.height;

    if (this.textures.exists('illustration')) {
      const art = this.add.image(width * 0.5, height * 0.5, 'illustration').setDepth(0);
      const scale = Math.max(width / art.width, height / art.height);
      art.setScale(scale);
      art.setAlpha(0.84);
    }

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x061126, 0.2).setDepth(0);
    this.add.rectangle(width * 0.5, height * 0.43, width * 0.84, height * 0.72, 0x2a4572, 0.9).setDepth(1);
    this.add.rectangle(width * 0.5, height * 0.43, width * 0.8, height * 0.68, 0x314f83, 0.74).setDepth(1);
    this.add.rectangle(width * 0.1, height * 0.43, 16, height * 0.74, 0xa9c0e2, 0.82).setDepth(1);
    this.add.rectangle(width * 0.9, height * 0.43, 16, height * 0.74, 0xa9c0e2, 0.82).setDepth(1);

    this.gasCloud = this.add.ellipse(width * 0.5, height * 0.32, width * 0.4, height * 0.19, 0xf6f0e8, 0.05)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  _createPhysicsWorld() {
    this.matter.world.setBounds(44, 106, this.scale.width - 88, this.scale.height - 220, 64, true, true, true, true);
  }

  _createCharacters() {
    const heroTopLeft = {
      x: Math.round(this.scale.width * 0.32 - HERO_SIZE.width * 0.5),
      y: Math.round(this.scale.height * 0.67 - HERO_SIZE.height * 0.5),
    };

    this.heroCharacter = this.characterFactory.createCharacter('hero', heroTopLeft.x, heroTopLeft.y);
    this._attachMatterBody(this.heroCharacter, heroTopLeft.x + HERO_SIZE.width * 0.5, heroTopLeft.y + HERO_SIZE.height * 0.5);
    this.characters.push(this.heroCharacter);

    this.passengerCharacters = [];
    for (let i = 0; i < this.modelConfig.npcCount; i += 1) {
      const pos = PASSENGER_POSITIONS[i % PASSENGER_POSITIONS.length];
      const topLeftX = Math.round(pos.x - NPC_SIZE.width * 0.5);
      const topLeftY = Math.round(pos.y - NPC_SIZE.height * 0.5);
      const passenger = this.characterFactory.createCharacter(`passenger-${i}`, topLeftX, topLeftY);
      this._attachMatterBody(passenger, pos.x, pos.y);
      passenger.container.setVisible(false);
      passenger.visible = false;
      this.passengerCharacters.push(passenger);
      this.characters.push(passenger);
    }
  }

  _repairCharacter(character, modelOverride) {
    if (!character) return;
    const safeModel = normalizeModel(modelOverride || this._makeModel(this.rng || makeRng(this.heroSeed + 77), character.role === 'hero'));
    const mood = this.currentMood || 'stable';
    this.characterFactory.updateCharacter(character, safeModel, mood);
    this._resetBodyToBase(character);
  }

  _attachMatterBody(character, centerX, centerY) {
    const body = this.matter.add.rectangle(centerX, centerY, character.width * 0.34, character.height * 0.56, {
      frictionAir: 0.06,
      friction: 0.01,
      restitution: 0.25,
      slop: 0.02,
      isSensor: true,
      inertia: Infinity,
      sleepThreshold: 0,
    });
    body.ignoreGravity = true;
    body.label = character.role;
    character.body = body;
    character.basePosition = { x: centerX, y: centerY };
    character.visible = true;
    character.container.setPosition(centerX - character.width * 0.5, centerY - character.height * 0.5);
  }

  _bindInput() {
    const holdTarget = this.ui.holdButton;
    const restartTarget = this.ui.restartButton;

    holdTarget.on('pointerdown', () => {
      this._unlockAudio();
      const started = this.runtime.onHoldStart();
      if (started) {
        this.ui.setHoldState(true);
      }
    });

    holdTarget.on('pointerup', () => {
      this.runtime.onHoldEnd();
      this.ui.setHoldState(false);
    });

    holdTarget.on('pointerout', () => {
      this.runtime.onHoldEnd();
      this.ui.setHoldState(false);
    });

    this.input.on('pointerup', () => {
      this.runtime.onHoldEnd();
      this.ui.setHoldState(false);
    });

    this.input.keyboard.on('keydown-SPACE', (event) => {
      event.preventDefault();
      this._unlockAudio();
      const started = this.runtime.onHoldStart();
      if (started) {
        this.ui.setHoldState(true);
      }
    });

    this.input.keyboard.on('keyup-SPACE', (event) => {
      event.preventDefault();
      this.runtime.onHoldEnd();
      this.ui.setHoldState(false);
    });

    restartTarget.on('pointerup', () => {
      this.startIntro();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.runtime.onHoldEnd();
        this.ui.setHoldState(false);
      }
    });
  }

  _unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.audioEngine.unlock();
  }

  startIntro() {
    this.runtime.startIntro();
    this.currentMood = 'stable';
    this.passengerModels = [];
    this.rng = null;
    this.nextImpulseAt = 0;
    this.motionTick = 0;
    this.lastRepairAt = 0;
    this.lastMissingSummaryAt = 0;
    this.lastMissingSummaryText = '';
    this.gasCloudPulse = 0;
    if (this.gasCloud) {
      this.gasCloud.setScale(0.9, 0.2);
      this.gasCloud.setAlpha(0.02);
      this.gasCloud.setRotation(0);
    }

    this.characterFactory.updateCharacter(this.heroCharacter, normalizeModel(this.heroModel), 'stable');
    this.heroCharacter.container.setVisible(true);
    this.heroCharacter.visible = true;
    this._resetBodyToBase(this.heroCharacter);

    this.passengerCharacters.forEach((passenger) => {
      passenger.container.setVisible(false);
      passenger.visible = false;
      this._resetBodyToBase(passenger);
    });

    this.audioEngine.stop();
    this.ui.setResultVisible(false);
    this.ui.setIntroVisible(true);
    this.ui.setHoldState(false);
    this._syncUi();
  }

  _beginRun() {
    const runSeed = Date.now();
    this.runtime.beginRun(runSeed);
    this.rng = makeRng(runSeed);
    this.nextImpulseAt = 0;
    this.lastRepairAt = 0;
    this.lastMissingSummaryAt = 0;
    this.lastMissingSummaryText = '';

    this.passengerModels = [];
    for (let i = 0; i < this.passengerCharacters.length; i += 1) {
      const model = this._makeModel(this.rng, false);
      this.passengerModels.push(model);
      const passenger = this.passengerCharacters[i];
      passenger.visible = true;
      passenger.container.setVisible(true);
      this.characterFactory.updateCharacter(passenger, normalizeModel(model), 'stable');
      this._resetBodyToBase(passenger);
    }

    this.characterFactory.updateCharacter(this.heroCharacter, normalizeModel(this.heroModel), 'stable');
    this._resetBodyToBase(this.heroCharacter);

    this.currentMood = 'stable';
    this.motionTick = 0;
    this.gasCloudPulse = 0;
    if (this.gasCloud) {
      this.gasCloud.setScale(0.9, 0.2);
      this.gasCloud.setAlpha(0.02);
    }
    this.ui.setIntroVisible(false);
    this.audioEngine.start();
    this._syncUi();
  }

  _resetBodyToBase(character) {
    if (!character?.body || !character?.basePosition) return;
    const body = character.body;
    const base = character.basePosition;
    this.matter.body.setPosition(body, { x: base.x, y: base.y });
    this.matter.body.setVelocity(body, { x: 0, y: 0 });
    this.matter.body.setAngularVelocity(body, 0);
    body.isSleeping = false;
    if (body.sleepCounter !== undefined) {
      body.sleepCounter = 0;
    }
    character.container.setPosition(base.x - character.width * 0.5, base.y - character.height * 0.5);
    character.container.setRotation(0);
  }

  _makeModel(rng, isHero = false) {
    const skinTint = randPick(rng, CHARACTER_CATALOG.skinTints);
    const hairColor = randPick(rng, CHARACTER_CATALOG.hairColors);
    const gender = rng() > 0.5 ? 'Man' : 'Woman';
    const maxHairStyle = gender === 'Man' ? 8 : 6;

    return {
      skinTint,
      hair: {
        color: hairColor,
        gender,
        style: randInt(rng, 1, maxHairStyle),
      },
      face: {
        eyebrowColor: randPick(rng, CHARACTER_CATALOG.eyebrowColors),
        eyeColor: randPick(rng, CHARACTER_CATALOG.eyeColors),
        noseStyle: randInt(rng, 1, 3),
        noseTint: skinTint,
        baseMouth: randPick(rng, CHARACTER_CATALOG.mouths),
      },
      shirt: {
        color: randPick(rng, CHARACTER_CATALOG.shirtColors),
        style: randInt(rng, 1, 8),
      },
      pants: {
        color: randPick(rng, CHARACTER_CATALOG.pantsColors),
        variant: this._pickPantVariant(rng),
      },
      shoes: {
        color: randPick(rng, CHARACTER_CATALOG.shoeColors),
        style: randInt(rng, 1, 5),
      },
      isHero,
    };
  }

  _pickPantVariant(rng) {
    const numeric = randInt(rng, 1, 4);
    const variant = randInt(rng, 0, 6);
    if (variant <= 3) return String(numeric);
    if (variant === 4) return '_long';
    if (variant === 5) return '_short';
    return '_shorter';
  }

  _triggerFeedback(level) {
    if (navigator.vibrate) {
      if (level === 'warn') navigator.vibrate(this.modelConfig.reactionProfile.warnVibration);
      if (level === 'danger') navigator.vibrate(this.modelConfig.reactionProfile.dangerVibration);
      if (level === 'panic') navigator.vibrate(this.modelConfig.reactionProfile.failVibration);
    }

    if (level === 'warn') this.audioEngine.beep(380, 0.07, 0.06);
    if (level === 'danger') this.audioEngine.beep(470, 0.09, 0.11);
    if (level === 'panic') this.audioEngine.beep(190, 0.2, 0.14);
  }

  _applyResult(resultType) {
    this.runtime.onHoldEnd();
    this.ui.setHoldState(false);

    if (resultType === 'success') {
      this.audioEngine.stop();
      this.audioEngine.cheer();
      this.ui.setResult('\ub3c4\ucc29!', '\ubaa9\ud45c\uce35\uc5d0 \ub3c4\ub2ec\ud588\uc2b5\ub2c8\ub2e4.');
      if (navigator.vibrate) navigator.vibrate(this.modelConfig.reactionProfile.successVibration);
      return;
    }

    this.audioEngine.stop();
    this.audioEngine.impact();
    const smellOverflow = this.runtime.state.smellLevel >= this.modelConfig.gasFailThreshold;
    this._triggerFeedback('panic');
    this.ui.setResult(
      '\uc2e4\ud328',
      smellOverflow
        ? '\ub2e4\ub978\uc0ac\ub78c\uc774 \ubc29\uadc0\ub97c \ub208\uce58\ucc58\ub2e4! \ub354 \uc774\uc0c1 \uc5f0\uae30\ud558\uba74 \uac8c\uc784\uc624\ubc84!'
        : '\ud55c\uacc4 \ucd08\uacfc\ub85c \ud3ed\ubc1c \uc9c1\uc804 \uc0c1\ud0dc!',
    );
    if (navigator.vibrate) navigator.vibrate(this.modelConfig.reactionProfile.failVibration);
  }

  _ensureMotionResponsiveness(body, index, risk) {
    if (!body) return;
    body.isSleeping = false;
    if (body.sleepCounter !== undefined) {
      body.sleepCounter = 0;
    }

    const now = this.time.now;
    const phaseBias = index * 1.57;
    const effectiveTravelMs = this.runtime.state.effectiveTravelMs || this.modelConfig.travelDurationMs;
    const progress = effectiveTravelMs
      ? (this.runtime.state.elapsedMs / effectiveTravelMs)
      : 0;

    const rideOffsetX = Math.sin(phaseBias + now * 0.0019 + progress * 16) * (risk === 'panic' ? 5.3 : risk === 'danger' ? 4.5 : risk === 'warn' ? 2.4 : 1.4);
    const rideOffsetY = Math.cos(phaseBias * 0.8 + now * 0.0017 + progress * 12) * (risk === 'panic' ? 3.1 : risk === 'danger' ? 2.6 : risk === 'warn' ? 1.6 : 0.8);

    body._elevatorOffsetX = rideOffsetX;
    body._elevatorOffsetY = rideOffsetY;
    body._risk = risk;
  }

  _applyPhysics(risk) {
    const now = this.time.now;
    const visibleChars = this.characters.filter((character) => character.visible);
    const maxDisplacement = risk === 'panic' ? 56 : risk === 'danger' ? 48 : risk === 'warn' ? 34 : 20;
    const impulseConfig = {
      stable: {
        spring: 0.00018,
        springY: 0.0002,
        jitter: 0.000015,
        interval: 210,
        mag: 0.00018,
      },
      warn: {
        spring: 0.00022,
        springY: 0.00024,
        jitter: 0.000028,
        interval: 140,
        mag: 0.00045,
      },
      danger: {
        spring: 0.00034,
        springY: 0.00038,
        jitter: 0.000042,
        interval: 80,
        mag: 0.0008,
      },
      panic: {
        spring: 0.00045,
        springY: 0.0005,
        jitter: 0.00006,
        interval: 55,
        mag: 0.0011,
      },
    };
    const current = impulseConfig[risk] || impulseConfig.stable;

    visibleChars.forEach((character, index) => {
      const body = character.body;
      const base = character.basePosition;
      if (!body || !base) return;

      this._ensureMotionResponsiveness(body, index, risk);

      const targetX = base.x + (body._elevatorOffsetX || 0);
      const targetY = base.y + (body._elevatorOffsetY || 0);
      const springX = (targetX - body.position.x) * current.spring;
      const springY = (targetY - body.position.y) * current.springY;
      body.force.x += springX;
      body.force.y += springY;
      body.force.x += Math.sin(now * 0.0024 + index * 1.2) * current.jitter;
      body.force.y += Math.cos(now * 0.0027 + index * 1.6) * (current.jitter * 0.8);
    });

    if ((risk === 'warn' || risk === 'danger' || risk === 'panic') && now >= this.nextImpulseAt) {
      const mag = current.mag;
      visibleChars.forEach((character) => {
        const body = character.body;
        if (!body) return;
        const jitter = Math.max(1, this.motionTick) % 4;
        const fx = (Math.random() - 0.5) * mag * (1.2 + (risk === 'danger' ? 0.4 : 0));
        const fy = (Math.random() - 0.5) * mag * 0.6 * jitter;
        body.force.x += fx;
        body.force.y += fy;
      });

      this.nextImpulseAt = now + (risk === 'panic' ? 40 : (risk === 'warn' ? current.interval : current.interval + 20));
      if (risk === 'danger' || risk === 'panic') {
        this.cameras.main.shake(45, 0.0014);
      }
    }

    visibleChars.forEach((character) => {
      const body = character.body;
      const base = character.basePosition;
      if (!body || !base) return;

      const targetX = base.x + (body._elevatorOffsetX || 0);
      const targetY = base.y + (body._elevatorOffsetY || 0);
      const dx = body.position.x - targetX;
      const dy = body.position.y - targetY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxDisplacement) {
        const ratio = maxDisplacement / dist;
        this.matter.body.setPosition(body, { x: targetX + dx * ratio, y: targetY + dy * ratio });
        this.matter.body.setVelocity(body, { x: body.velocity.x * 0.72, y: body.velocity.y * 0.72 });
      }

      character.container.setPosition(
        body.position.x - character.width * 0.5,
        body.position.y - character.height * 0.5,
      );
      character.container.setRotation(0);
    });

    this.motionTick += 1;
  }

  _syncMood(risk) {
    if (risk === this.currentMood) return;
    this.currentMood = risk;
    this.characterFactory.updateCharacter(this.heroCharacter, normalizeModel(this.heroModel), risk);
    for (let i = 0; i < this.passengerCharacters.length; i += 1) {
      if (!this.passengerCharacters[i].visible || !this.passengerModels[i]) continue;
      this.characterFactory.updateCharacter(this.passengerCharacters[i], normalizeModel(this.passengerModels[i]), risk);
    }
  }

  _syncUi() {
    const state = this.runtime.state;
    const risk = this.runtime.riskFromGas();

    this.ui.setFloor(state.currentFloor, state.targetFloor);
    this.ui.setBars(state.pressure, state.smellLevel, state.soundLevel);
    this.ui.setRisk(risk);
    this.ui.setTargetRange(this.modelConfig.minTargetFloor, this.modelConfig.maxTargetFloor, state.targetFloor);
    this._updateGasVisual(risk, state);

    if (state.phase === 'intro') {
      const remaining = Math.max(0, this.modelConfig.introDurationMs - state.introElapsedMs);
      const countdown = Math.max(1, Math.ceil(remaining / 1000));
      this.ui.setIntroCountdown(countdown);
      this.ui.setIntroVisible(true);
    }
  }

  _updateGasVisual(risk, state) {
    if (!this.gasCloud) return;
    const smellRatio = clamp(state.smellLevel / 100, 0, 1);
    const dangerRatio = (state.smellLevel - (this.modelConfig.gasWarnThreshold || 70)) / Math.max(1, 100 - (this.modelConfig.gasWarnThreshold || 70));
    const drift = Math.sin((this.time.now + (state.elapsedMs || 0)) * 0.0015) * 8;
    const baseScaleX = 0.96 + smellRatio * 0.8 + Math.abs(drift) * 0.002;
    const baseScaleY = 0.3 + smellRatio * 0.6 + Math.abs(drift) * 0.001;
    const alpha = clamp(0.02 + smellRatio * 0.42, 0, 0.52);
    this.gasCloud.setScale(baseScaleX, baseScaleY);
    this.gasCloud.setAlpha(alpha);
    this.gasCloud.setX(this.scale.width * 0.5 + drift);
    if (risk === 'danger' || risk === 'panic') {
      this.gasCloud.setTintFill(risk === 'panic' ? 0xffd9e1 : 0xffd4be);
      this.gasCloud.setStrokeStyle(2, risk === 'panic' ? 0xff5f7a : 0xffa56b, 0.38);
    } else {
      this.gasCloud.setTintFill(0xf7f1e6);
      this.gasCloud.setStrokeStyle(0);
    }
    this.gasCloudPulse += (dangerRatio || 0) * 0.7;
    this.gasCloud.setRotation(this.gasCloudPulse * 0.002);
  }

  _summarizeMissingParts(stats) {
    if (!stats) return '';
    const lines = [];
    const ratio = stats.partsTotal ? ((stats.partsMissing / stats.partsTotal) * 100).toFixed(1) : '0.0';
    const layoutState = stats.layoutCollapsed ? 'collapsed' : 'stable';
    lines.push(`missing=${stats.partsMissing}/${stats.partsTotal} (${ratio}%), layout=${layoutState}`);

    const missingByRole = stats.missingByRole || {};
    const missingByClass = stats.missingByCategory || {};
    const roleEntries = Object.entries(missingByRole).sort((a, b) => b[1] - a[1]);
    if (roleEntries.length) {
      lines.push('by-role=' + roleEntries.map(([role, count]) => `${role}:${count}`).join(', '));
    }

    const classEntries = Object.entries(missingByClass)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    if (classEntries.length) {
      lines.push('by-category=' + classEntries.map((entry) => `${entry.category}:${entry.count}`).join(', '));
    }

    const topMissing = (stats.topMissing || [])
      .filter((entry) => entry && entry.className)
      .slice(0, 4)
      .map((entry) => `${entry.className} × ${entry.count}`);
    if (topMissing.length) {
      lines.push('top=' + topMissing.join(', '));
    }

    return lines.join(' | ');
  }

  _autoRepairIfNeeded(stats) {
    if (!stats || this.runtime?.state?.phase !== 'running') return;
    if (this.time.now < this.lastRepairAt + 2500) return;

    const totalVisible = stats.partsTotal || 0;
    const missing = stats.partsMissing || 0;
    const layoutCollapsed = stats.layoutCollapsed || false;
    if (totalVisible <= 0) return;

    const missingRatio = missing / totalVisible;
    if (missingRatio < 0.16 && !layoutCollapsed) {
      return;
    }

    const summary = this._summarizeMissingParts(stats);
    console.warn(`[Atlas] Auto-repair triggered (${summary || 'missing parts detected'})`);

    this.lastRepairAt = this.time.now;

    const hero = this.characters.find((entry) => entry?.role === 'hero');
    if (hero) {
      this._repairCharacter(hero, normalizeModel({}));
    }

    this.passengerCharacters.forEach((passenger) => {
      if (passenger.visible) {
        this._repairCharacter(passenger, normalizeModel({}));
      }
    });

    this.missingLog.clear();
  }

  _refreshCharacterStatsWarnings() {
    const stats = this.characterFactory.collectStats(this.characters.filter((character) => character.visible));
    stats.missingFrames.forEach((missingKey) => {
      if (this.missingLog.has(missingKey)) return;
      this.missingLog.add(missingKey);
      console.warn(`[Atlas] Missing frame ${missingKey}`);
    });

    const now = this.time.now;
    if (now < this.lastMissingSummaryAt + 3500) return;
    this.lastMissingSummaryAt = now;

    const summaryText = this._summarizeMissingParts(stats);
    if (summaryText && summaryText !== this.lastMissingSummaryText) {
      this.lastMissingSummaryText = summaryText;
      console.warn(`[Atlas] Missing summary => ${summaryText}`);
    }
  }

  _stepGame(dtMs) {
    const events = this.runtime.update(dtMs);

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event.type === 'introComplete') {
        this._beginRun();
      } else if (event.type === 'warn' || event.type === 'gasWarn') {
        this._triggerFeedback('warn');
      } else if (event.type === 'danger' || event.type === 'gasDanger') {
        this._triggerFeedback('danger');
      } else if (event.type === 'success' || event.type === 'fail') {
        this._applyResult(event.type);
      }
    }

    const risk = this.runtime.riskFromGas();
    this._syncMood(risk);
    this._syncUi();

    if (this.runtime.state.phase === 'running') {
      this.audioEngine.setContinuousSound(this.runtime.state.soundLevel, this.runtime.state.isHolding);
      this._applyPhysics(risk);
    }

    const characterStats = this.characterFactory.collectStats(this.characters.filter((character) => character.visible));
    this._autoRepairIfNeeded(characterStats);
    this._refreshCharacterStatsWarnings();
  }

  update(_, delta) {
    if (this.manualStepping) return;
    this._stepGame(delta);
  }

  advanceTime(ms) {
    this.manualStepping = true;
    const step = 1000 / 60;
    let remaining = Math.max(0, Number(ms) || 0);
    while (remaining > 0) {
      const batch = Math.min(step, remaining);
      this._stepGame(batch);
      remaining -= batch;
    }
    this.manualStepping = false;
  }

  renderGameToText() {
    const state = this.runtime.state;
    const risk = this.runtime.riskFromGas();

    const activeBodies = this.characters.filter((character) => character.visible && character.body);
    const avgVelocity = activeBodies.length
      ? activeBodies.reduce((sum, character) => {
        const v = character.body.velocity;
        return sum + Math.hypot(v.x, v.y);
      }, 0) / activeBodies.length
      : 0;

    const characterStats = this.characterFactory.collectStats(this.characters.filter((character) => character.visible));

    return JSON.stringify({
      engine: 'phaser',
      phase: state.phase,
      floor: state.currentFloor,
      targetFloor: state.targetFloor,
      effectiveTravelMs: Math.round(state.effectiveTravelMs || this.modelConfig.travelDurationMs),
      elapsedMs: Math.round(state.elapsedMs),
      remainingMs: Math.max(0, (state.effectiveTravelMs || this.modelConfig.travelDurationMs) - state.elapsedMs),
      pressure: Math.round(state.pressure),
      smellLevel: Math.round(state.smellLevel),
      soundLevel: Math.round(state.soundLevel),
      risk,
      isHolding: state.isHolding,
      physics: {
        mode: 'matter',
        bodyCount: activeBodies.length,
        avgVelocity: Number(avgVelocity.toFixed(4)),
      },
      characterStats,
      ui: {
        system: 'rexui',
        holdButtonPressed: state.isHolding,
      },
      runSeed: state.runSeed,
    });
  }
}
