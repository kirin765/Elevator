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
    this.missingLog = new Set();
    this.audioUnlocked = false;
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

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x061126, 1).setDepth(0);
    this.add.rectangle(width * 0.5, height * 0.43, width * 0.84, height * 0.72, 0x2a4572, 0.9).setDepth(1);
    this.add.rectangle(width * 0.5, height * 0.43, width * 0.8, height * 0.68, 0x314f83, 0.74).setDepth(1);
    this.add.rectangle(width * 0.1, height * 0.43, 16, height * 0.74, 0xa9c0e2, 0.82).setDepth(1);
    this.add.rectangle(width * 0.9, height * 0.43, 16, height * 0.74, 0xa9c0e2, 0.82).setDepth(1);
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

  _attachMatterBody(character, centerX, centerY) {
    const body = this.matter.add.rectangle(centerX, centerY, character.width * 0.34, character.height * 0.56, {
      frictionAir: 0.18,
      restitution: 0.2,
      slop: 0.02,
      isSensor: true,
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
    }

    if (level === 'warn') this.audioEngine.beep(380, 0.07, 0.06);
    if (level === 'danger') this.audioEngine.beep(470, 0.09, 0.11);
  }

  _applyResult(resultType) {
    this.runtime.onHoldEnd();
    this.ui.setHoldState(false);

    if (resultType === 'success') {
      this.audioEngine.stop();
      this.audioEngine.cheer();
      this.ui.setResult('도착!', '목표층에 도달했습니다.');
      if (navigator.vibrate) navigator.vibrate(this.modelConfig.reactionProfile.successVibration);
      return;
    }

    this.audioEngine.stop();
    this.audioEngine.impact();
    this.ui.setResult('실패', '한계 초과로 폭발 직전 상태!');
    if (navigator.vibrate) navigator.vibrate(this.modelConfig.reactionProfile.failVibration);
  }

  _applyPhysics(risk) {
    const now = this.time.now;
    const visibleChars = this.characters.filter((character) => character.visible);
    const maxDisplacement = risk === 'danger' ? 30 : risk === 'warn' ? 22 : 14;

    visibleChars.forEach((character, index) => {
      const body = character.body;
      const base = character.basePosition;
      const springX = (base.x - body.position.x) * 0.000012;
      const springY = (base.y - body.position.y) * 0.000014;
      body.force.x += springX;
      body.force.y += springY;

      if (risk === 'stable') {
        body.force.x += Math.sin(now * 0.0024 + index) * 0.000003;
      }
    });

    if ((risk === 'warn' || risk === 'danger') && now >= this.nextImpulseAt) {
      const mag = risk === 'warn' ? 0.00026 : 0.0006;
      visibleChars.forEach((character) => {
        const fx = (Math.random() - 0.5) * mag;
        const fy = (Math.random() - 0.5) * mag * 0.55;
        character.body.force.x += fx;
        character.body.force.y += fy;
      });

      this.nextImpulseAt = now + (risk === 'warn' ? 280 : 120);
      if (risk === 'danger') {
        this.cameras.main.shake(45, 0.0012);
      }
    }

    visibleChars.forEach((character) => {
      const body = character.body;
      const base = character.basePosition;
      const dx = body.position.x - base.x;
      const dy = body.position.y - base.y;
      const dist = Math.hypot(dx, dy);

      if (dist > maxDisplacement) {
        const ratio = maxDisplacement / dist;
        this.matter.body.setPosition(body, { x: base.x + dx * ratio, y: base.y + dy * ratio });
        this.matter.body.setVelocity(body, { x: body.velocity.x * 0.72, y: body.velocity.y * 0.72 });
      }

      character.container.setPosition(
        body.position.x - character.width * 0.5,
        body.position.y - character.height * 0.5,
      );
      character.container.setRotation(0);
    });
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
    const risk = this.runtime.riskFromPressure();

    this.ui.setFloor(state.currentFloor, state.targetFloor);
    this.ui.setBars(state.pressure, state.smellLevel, state.soundLevel);
    this.ui.setRisk(risk);

    if (state.phase === 'intro') {
      const remaining = Math.max(0, this.modelConfig.introDurationMs - state.introElapsedMs);
      const countdown = Math.max(1, Math.ceil(remaining / 1000));
      this.ui.setIntroCountdown(countdown);
      this.ui.setIntroVisible(true);
    }
  }

  _refreshCharacterStatsWarnings() {
    const stats = this.characterFactory.collectStats(this.characters.filter((character) => character.visible));
    stats.missingFrames.forEach((missingKey) => {
      if (this.missingLog.has(missingKey)) return;
      this.missingLog.add(missingKey);
      console.warn(`[Atlas] Missing frame ${missingKey}`);
    });
  }

  _stepGame(dtMs) {
    const events = this.runtime.update(dtMs);

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event.type === 'introComplete') {
        this._beginRun();
      } else if (event.type === 'warn' || event.type === 'danger') {
        this._triggerFeedback(event.type);
      } else if (event.type === 'success' || event.type === 'fail') {
        this._applyResult(event.type);
      }
    }

    const risk = this.runtime.riskFromPressure();
    this._syncMood(risk);
    this._syncUi();

    if (this.runtime.state.phase === 'running') {
      this.audioEngine.setContinuousSound(this.runtime.state.soundLevel, this.runtime.state.isHolding);
      this._applyPhysics(risk);
    }

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
    const risk = this.runtime.riskFromPressure();

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
      elapsedMs: Math.round(state.elapsedMs),
      remainingMs: Math.max(0, this.modelConfig.travelDurationMs - state.elapsedMs),
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
