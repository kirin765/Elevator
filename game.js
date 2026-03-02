const GameConfig = {
  targetFloor: 10,
  travelDurationMs: 25000,
  pressureMax: 100,
  pressureRisePerSec: 8,
  pressureReleasePerSec: 20,
  warnThreshold: 70,
  dangerThreshold: 90,
  assetBaseUrl: './assets/characters',
  assetMode: 'atlas',
  assetPack: {
    pngBase: './assets/kenney_modular-characters/PNG',
    atlas: {
      skin: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_skin.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_skin.xml',
      },
      face: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_face.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_face.xml',
      },
      shirts: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_shirts.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_shirts.xml',
      },
      pants: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_pants.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_pants.xml',
      },
      shoes: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_shoes.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_shoes.xml',
      },
      hair: {
        image: './assets/kenney_modular-characters/Spritesheet/sheet_hair.png',
        map: './assets/kenney_modular-characters/Spritesheet/sheet_hair.xml',
      },
    },
  },
  usePaletteFallback: true,
  debugMissingParts: true,
  npcCount: 3,
  characterScale: 0.75,
  imageExtOrder: ['png'],
  reactionProfile: {
    warnVibration: [60],
    dangerVibration: [80, 70, 80],
    failVibration: [150, 70, 170, 70, 230],
    successVibration: [30, 40, 30, 40, 30],
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const randPick = (rng, arr) => arr[randInt(rng, 0, arr.length - 1)];
const hashCode = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
};
const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) & 0xffffffff) / 4294967296;
  };
};

class SpriteAtlasLoader {
  constructor(atlasConfig) {
    this.atlasConfig = atlasConfig || {};
    this.states = new Map();
  }

  preloadAll() {
    const keys = Object.keys(this.atlasConfig);
    const tasks = keys.map((category) => {
      const state = this._ensureState(category);
      return state?.promise || Promise.resolve();
    });
    return Promise.all(tasks);
  }

  getFrame(category, name) {
    if (!category || !name) {
      return { status: 'invalid', ready: true, found: false, reason: 'invalid' };
    }

    const state = this._ensureState(category);
    if (!state) {
      return { status: 'missing', ready: true, found: false, reason: 'missing-config' };
    }

    if (state.status === 'loading') {
      return { status: 'loading', ready: false, found: false, reason: 'loading', promise: state.promise };
    }

    if (state.status === 'failed') {
      return { status: 'failed', ready: true, found: false, reason: 'load-failed', error: state.error };
    }

    const frame = state.frames.get(name);
    if (!frame) {
      return { status: 'missing', ready: true, found: false, reason: 'missing-frame' };
    }

    return {
      status: 'ready',
      ready: true,
      found: true,
      frame,
      image: state.image,
      imageSrc: state.image?.src || '',
    };
  }

  _ensureState(category) {
    if (this.states.has(category)) {
      return this.states.get(category);
    }

    const config = this.atlasConfig[category];
    if (!config || !config.image || !config.map) {
      return null;
    }

    const state = {
      status: 'loading',
      frames: new Map(),
      image: null,
      promise: null,
      error: null,
    };

    state.promise = Promise.all([this._loadImage(config.image), this._loadXml(config.map)]).then(([image, map]) => {
      state.image = image;
      state.frames = map;
      state.status = 'ready';
      return state;
    }).catch((error) => {
      state.status = 'failed';
      state.error = error;
      throw error;
    });

    this.states.set(category, state);
    return state;
  }

  async _loadImage(url) {
    const image = new Image();
    return new Promise((resolve, reject) => {
      const done = () => {
        image.decoding = 'async';
        image.loading = 'eager';
        resolve(image);
      };
      image.onload = done;
      image.onerror = () => reject(new Error(`Atlas image load failed: ${url}`));
      image.src = url;
    });
  }

  async _loadXml(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Atlas xml load failed: ${url} (${response.status})`);
    }

    const text = await response.text();
    const xml = new window.DOMParser().parseFromString(text, 'application/xml');
    const parserError = xml.getElementsByTagName('parsererror');
    if (parserError && parserError.length > 0) {
      throw new Error(`Atlas xml parse failed: ${url}`);
    }

    const frames = new Map();
    const nodes = Array.from(xml.querySelectorAll('SubTexture'));
    nodes.forEach((node) => {
      const name = node.getAttribute('name');
      if (!name) {
        return;
      }
      const x = Number.parseInt(node.getAttribute('x'), 10);
      const y = Number.parseInt(node.getAttribute('y'), 10);
      const width = Number.parseInt(node.getAttribute('width'), 10);
      const height = Number.parseInt(node.getAttribute('height'), 10);
      if (![x, y, width, height].every(Number.isFinite)) {
        return;
      }
      frames.set(name, { x, y, width, height });
    });

    return frames;
  }
}

class AtlasFrameRasterizer {
  constructor() {
    this.cache = new Map();
  }

  get(category, frameName, image, frame) {
    if (!category || !frameName || !image || !frame) {
      return '';
    }
    const key = `${category}:${frameName}:${frame.x},${frame.y},${frame.width},${frame.height}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    ctx.clearRect(0, 0, frame.width, frame.height);
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    const dataUrl = canvas.toDataURL('image/png');
    this.cache.set(key, dataUrl);
    return dataUrl;
  }

  clear() {
    this.cache.clear();
  }
}

class FartAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.tone = null;
    this.toneGain = null;
    this.noiseSource = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.started = false;
  }

  _createContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  start() {
    this._createContext();
    if (!this.ctx) {
      return;
    }

    if (this.started) {
      this.master?.gain?.setTargetAtTime(1, this.ctx.currentTime, 0.12);
      return;
    }

    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const noise = buffer.getChannelData(0);
    for (let i = 0; i < noise.length; i += 1) {
      noise[i] = Math.random() * 2 - 1;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    this.tone = this.ctx.createOscillator();
    this.tone.type = 'square';
    this.tone.frequency.value = 130;

    this.toneGain = this.ctx.createGain();
    this.toneGain.gain.value = 0;
    this.tone.connect(this.toneGain).connect(this.master);

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 900;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSource.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);

    this.tone.start();
    this.noiseSource.start();
    this.started = true;
  }

  setContinuousSound(level, isHolding) {
    if (!this.started || !this.ctx || !this.master) {
      return;
    }
    const clamped = clamp(level / 100, 0, 1);
    const now = this.ctx.currentTime;
    const freq = isHolding ? 150 + clamped * 210 : 90 + clamped * 140;
    const gain = 0.01 + clamped * (isHolding ? 0.54 : 0.31);
    const noiseLevel = 0.001 + clamped * (isHolding ? 0.055 : 0.028);

    this.master.gain.setTargetAtTime(1, now, 0.06);
    this.tone.frequency.setTargetAtTime(freq, now, 0.08);
    this.toneGain.gain.setTargetAtTime(gain, now, 0.08);
    this.noiseGain.gain.setTargetAtTime(noiseLevel, now, 0.08);
  }

  stop() {
    if (!this.started || !this.ctx || !this.master) {
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, now, 0.1);
  }

  beep(freq = 320, duration = 0.14, level = 0.18) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, level), this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
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

class GameEngine {
  constructor(config, elements, audio) {
    this.config = {
      ...config,
      assetMode: config.assetMode === 'png' ? 'png' : 'atlas',
    };
    this.imageExtOrder = Array.isArray(config.imageExtOrder) && config.imageExtOrder.length
      ? [...new Set(config.imageExtOrder.map((value) => `${value}`.replace(/^\./, '').trim()).filter(Boolean))]
      : ['png'];
    this._atlasLoader = this.config.assetMode === 'atlas' ? new SpriteAtlasLoader(this.config.assetPack?.atlas) : new SpriteAtlasLoader({});
    this._atlasRasterizer = new AtlasFrameRasterizer();
    this._atlasLoadInit = this._atlasLoader.preloadAll();
    this._atlasLoadInit.catch(() => {});
    this._pngBase = this.config.assetPack?.pngBase || this.config.assetBaseUrl;
    this._pendingAtlasRetries = new Set();
    this._missingLog = new Set();
    this._failedAssetUrls = new Set();
    this._partCategoryByClass = {
      'skin-head': 'skin',
      'skin-neck': 'skin',
      'skin-arm': 'skin',
      'skin-leg': 'skin',
      shirt: 'shirts',
      pants: 'pants',
      shoes: 'shoes',
      'face-eyes-left': 'face',
      'face-eyes-right': 'face',
      'face-nose': 'face',
      'face-mouth': 'face',
      'face-eyebrows': 'face',
      hair: 'hair',
    };
    this._criticalPartGroups = {
      face: new Set(['face-eyes-left', 'face-eyes-right', 'face-nose', 'face-mouth', 'face-eyebrows']),
      upper: new Set(['skin-arm', 'shirt']),
      lower: new Set(['skin-leg', 'pants', 'shoes']),
    };
    this._atlasOffsetFixes = {
      'skin-head': { x: -1, y: 0 },
      'skin-neck': { x: 0, y: -1 },
    };
    this.el = elements;
    this.audio = audio;
    this.state = this._createInitialState();
    this.warningGiven = false;
    this.dangerGiven = false;
    this.finished = false;
    this.introDurationMs = 3000;
    this.heroSeed = hashCode(`${window.location.pathname}|hero`);
    this.rngState = Date.now();
    this.rng = makeRng(this.rngState);
    this._heroModel = null;
    this._characterTemplates = new Map();
    this._passengerNodes = [];
    this._loadStats = {
      mode: this.config.assetMode,
      partsTotal: 0,
      partsRendered: 0,
      partsMissing: 0,
      successRate: 0,
      layoutCollapsed: false,
      invalidGeometryParts: [],
      missingParts: [],
      criticalMissing: [],
    };
    this._missingPixel =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

    this.characterCatalog = {
      skinTints: [1, 2, 3, 4, 5, 6, 7, 8],
      hairColors: ['Black', 'Blonde', 'Brown 1', 'Brown 2', 'Grey', 'Red', 'Tan', 'White'],
      eyeColors: ['Black', 'Blue', 'Brown', 'Green', 'Pine'],
      eyebrowColors: ['black', 'blonde', 'brown1', 'brown2', 'grey', 'red', 'tan', 'white'],
      mouths: ['mouth_glad', 'mouth_happy', 'mouth_oh', 'mouth_straight', 'mouth_sad', 'mouth_teethLower', 'mouth_teethUpper'],
      shirtColors: ['Blue', 'Green', 'Grey', 'Navy', 'Pine', 'Red', 'White', 'Yellow'],
      pantsColors: ['Blue 1', 'Blue 2', 'Brown', 'Green', 'Grey', 'Light Blue', 'Navy', 'Pine', 'Red', 'Tan', 'White', 'Yellow'],
      shoeColors: ['Black', 'Blue', 'Brown 1', 'Brown 2', 'Grey', 'Red', 'Tan'],
    };

    this._createHeroNode();
    this._createPassengerNodes();
  }

  _pickSafe(array, value, fallback) {
    return array.includes(value) ? value : fallback;
  }

  _normalizeModel(model) {
    const safe = model || {};
    const safeSkin = Number.isFinite(Number.parseInt(safe.skinTint, 10))
      ? clamp(Number.parseInt(safe.skinTint, 10), 1, 8)
      : this.characterCatalog.skinTints[0];
    const safeGender = safe.hair?.gender === 'Woman' ? 'Woman' : 'Man';
    const maxHairStyle = safeGender === 'Woman' ? 6 : 8;

    const normalized = {
      ...safe,
      skinTint: safeSkin,
      hair: {
        color: this._pickSafe(this.characterCatalog.hairColors, safe.hair?.color, this.characterCatalog.hairColors[0]),
        gender: safeGender,
        style: clamp(Number.parseInt(safe.hair?.style, 10) || 1, 1, maxHairStyle),
      },
      face: {
        eyebrowColor: this._pickSafe(this.characterCatalog.eyebrowColors, safe.face?.eyebrowColor, this.characterCatalog.eyebrowColors[0]),
        eyeColor: this._pickSafe(this.characterCatalog.eyeColors, safe.face?.eyeColor, this.characterCatalog.eyeColors[0]),
        noseStyle: clamp(Number.parseInt(safe.face?.noseStyle, 10) || 1, 1, 3),
        noseTint: clamp(Number.parseInt(safe.face?.noseTint, 10) || safeSkin, 1, 8),
        baseMouth: this._pickSafe(this.characterCatalog.mouths, safe.face?.baseMouth, this.characterCatalog.mouths[0]),
      },
      shirt: {
        color: this._pickSafe(this.characterCatalog.shirtColors, safe.shirt?.color, this.characterCatalog.shirtColors[0]),
        style: clamp(Number.parseInt(safe.shirt?.style, 10) || 1, 1, 8),
      },
      pants: {
        color: this._pickSafe(this.characterCatalog.pantsColors, safe.pants?.color, this.characterCatalog.pantsColors[0]),
        variant: this._normalizePantsVariant(safe.pants?.variant),
      },
      shoes: {
        color: this._pickSafe(this.characterCatalog.shoeColors, safe.shoes?.color, this.characterCatalog.shoeColors[0]),
        style: clamp(Number.parseInt(safe.shoes?.style, 10) || 1, 1, 5),
      },
    };

    return normalized;
  }

  _normalizeSafePantsValue(value) {
    const asNum = Number.parseInt(`${value || ''}`.trim(), 10);
    if (asNum >= 1 && asNum <= 4) return `${asNum}`;
    return '1';
  }

  _normalizePantsVariant(value) {
    const safe = `${value || ''}`.trim();
    if (safe === '_long' || safe === '_short' || safe === '_shorter') return safe;
    return this._normalizeSafePantsValue(safe);
  }

  _createInitialState() {
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
      characterState: {
        hero: null,
        passengers: [],
      },
      runSeed: null,
    };
  }

  _path(parts) {
    return parts.join('/');
  }

  _pngAssetPath(parts) {
    return this._path([this._pngBase, ...parts]);
  }

  _extractFilename(path) {
    if (!path) return '';
    const noQuery = `${path}`.split(/[?#]/)[0];
    const match = noQuery.match(/([^/\\]+)$/);
    return match ? match[1] : noQuery;
  }

  _withoutExtension(fileName) {
    return `${fileName || ''}`.replace(/\.[^./\\?#]+$/, '');
  }

  _slug(value) {
    return `${value || ''}`.toLowerCase().replace(/ /g, '');
  }

  resolvePartImage(category, partPath) {
    const sourceName = this._extractFilename(partPath);
    const frameName = this._withoutExtension(sourceName);
    const atlasNameCandidates = [];
    [sourceName, frameName].forEach((name) => {
      if (name && !atlasNameCandidates.includes(name)) {
        atlasNameCandidates.push(name);
      }
    });
    const candidate = {
      category,
      partPath,
      frameName,
      atlasNameCandidates,
      debugCategory: `${category}:${frameName}`,
    };

    if (this.config.assetMode === 'atlas' && this.config.usePaletteFallback !== false) {
      for (let i = 0; i < atlasNameCandidates.length; i += 1) {
        const atlasName = atlasNameCandidates[i];
        const resolved = this._atlasLoader.getFrame(category, atlasName);
        if (resolved.ready === false) {
          if (this._pendingAtlasRetries) {
            const retryKey = `${candidate.debugCategory}:${atlasNameCandidates.join('|')}`;
            const pending = this._pendingAtlasRetries.has(retryKey);
            if (!pending && resolved.promise) {
              this._pendingAtlasRetries.add(retryKey);
              resolved.promise.finally(() => {
                this._pendingAtlasRetries.delete(retryKey);
              });
            }
          }
          return {
            ...candidate,
            mode: 'atlas',
            pending: true,
            promise: resolved.promise,
          };
        }
        if (resolved.found) {
          return {
            ...candidate,
            mode: 'atlas',
            atlasFrameName: atlasName,
            src: resolved.imageSrc,
            image: resolved.image,
            frame: resolved.frame,
            frameW: resolved.frame.width,
            frameH: resolved.frame.height,
            status: resolved.status,
          };
        }
      }

      if (this.config.debugMissingParts) {
        const label = `atlas-missing:${category}/${atlasNameCandidates.join('|') || frameName}`;
        if (!this._missingLog.has(label)) {
          this._missingLog.add(label);
          console.warn(`[Atlas] Missing frame for ${category}. tried=[${atlasNameCandidates.join(', ')}]`);
        }
      }
    }

    return this._buildPngRenderSpec(candidate);
  }

  _buildPngRenderSpec(candidate) {
    const base = this._withoutExtension(candidate.partPath);
    if (!base) {
      return {
        ...candidate,
        mode: 'missing',
        status: 'missing',
        reason: 'invalid-part-path',
      };
    }

    const candidates = this.imageExtOrder.map((ext) => `${base}.${ext}`);
    const unique = [];
    const seen = new Set();
    candidates.forEach((value) => {
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(value);
      }
    });
    const filtered = unique.filter((value) => !this._failedAssetUrls.has(value));
    return {
      ...candidate,
      mode: 'png',
      candidates: filtered,
      status: filtered.length ? 'ready' : 'missing',
    };
  }

  _skinFile(part, skinTint) {
    return this._pngAssetPath(['Skin', `Tint ${skinTint}`, `tint${skinTint}_${part}.png`]);
  }

  _hairFilePath(model) {
    const color = model.hair?.color || this.characterCatalog.hairColors[0];
    const gender = model.hair?.gender || 'Man';
    const style = model.hair?.style || 1;
    return this._pngAssetPath(['Hair', color, `${this._slug(color)}${gender}${style}.png`]);
  }

  _shirtFile(model) {
    const fallbackColor = this.characterCatalog.shirtColors[0] || 'Blue';
    const color = model?.shirt?.color || fallbackColor;
    const style = model?.shirt?.style || 1;
    const prefix = this._slug(color);
    return this._pngAssetPath(['Shirts', color, `${prefix}Shirt${style}.png`]);
  }

  _pantsFile(model) {
    const fallbackColor = this.characterCatalog.pantsColors[0] || 'Blue 1';
    const color = model?.pants?.color || fallbackColor;
    const prefix = color.replace(/ /g, '');
    const variant = model?.pants?.variant || '1';
    return this._pngAssetPath(['Pants', color, `pants${prefix}${variant}.png`]);
  }

  _shoesFile(model) {
    const fallbackColor = this.characterCatalog.shoeColors[0] || 'Black';
    const color = model?.shoes?.color || fallbackColor;
    const prefixColor = color === 'Brown 1' ? 'brown' : color === 'Brown 2' ? 'brown2' : this._slug(color);
    const style = model?.shoes?.style || 1;
    return this._pngAssetPath(['Shoes', color, `${prefixColor}Shoe${style}.png`]);
  }

  _faceEyesFile(model) {
    const fallbackColor = this.characterCatalog.eyeColors[0] || 'Black';
    const color = model?.face?.eyeColor || fallbackColor;
    return this._pngAssetPath(['Face', 'Eyes', `eye${color}_large.png`]);
  }

  _faceEyebrowsFile(model, variant = 1) {
    const fallbackColor = this.characterCatalog.eyebrowColors[0] || 'black';
    const color = model?.face?.eyebrowColor || fallbackColor;
    const safeVariant = clamp(variant, 1, 3);
    return this._pngAssetPath(['Face', 'Eyebrows', `${color}Brow${safeVariant}.png`]);
  }

  _faceNoseFile(model) {
    const tint = model?.face?.noseTint || this.characterCatalog.skinTints[0];
    const style = model?.face?.noseStyle || 1;
    return this._pngAssetPath(['Face', 'Nose', `Tint ${tint}`, `tint${tint}Nose${style}.png`]);
  }

  _faceMouthFile(model, mood) {
    const fallback = this.characterCatalog.mouths[0] || 'mouth_happy';
    const baseMouth = model?.face?.baseMouth || fallback;
    const target = mood === 'danger' ? 'mouth_sad' : mood === 'warn' ? 'mouth_oh' : baseMouth;
    return this._pngAssetPath(['Face', 'Mouth', `${target}.png`]);
  }

  _normalizeRunSeed(value) {
    this.rngState = (this.rngState ^ (value * 0x9e3779b9)) >>> 0;
    return this.rngState;
  }

  _createCharacterNode() {
    const node = document.createElement('div');
    node.className = 'character';
    node.style.position = 'absolute';
    node.style.display = 'block';
    node.style.visibility = 'visible';
    node.style.opacity = '1';
    node.style.pointerEvents = 'none';
    node.style.height = '';
    node.style.minHeight = '146px';
    node.style.maxHeight = '230px';
    node.style.aspectRatio = '3 / 4';
    node.innerHTML = `
      <img class="part skin-head" alt="" />
      <img class="part skin-neck" alt="" />
      <img class="part skin-arm" alt="" />
      <img class="part skin-leg" alt="" />
      <img class="part shirt" alt="" />
      <img class="part pants" alt="" />
      <img class="part shoes" alt="" />
      <img class="part face-eyes-left" alt="" />
      <img class="part face-eyes-right" alt="" />
      <img class="part face-nose" alt="" />
      <img class="part face-mouth" alt="" />
      <img class="part face-eyebrows" alt="" />
      <img class="part hair" alt="" />
    `;

    node.querySelectorAll('img').forEach((part) => {
      part.loading = 'eager';
      part.decoding = 'async';
      part.style.display = 'block';
      part.style.position = 'absolute';
      part.style.opacity = '1';
      part.style.pointerEvents = 'none';
    });

    return node;
  }

  _createHeroNode() {
    this.el.heroSlot.innerHTML = '';
    const heroNode = this._createCharacterNode();
    heroNode.classList.add('hero');
    heroNode.style.width = 'clamp(132px, 36%, 196px)';
    heroNode.style.height = 'clamp(176px, 33vh, 230px)';
    heroNode.style.setProperty('--x', '32%');
    heroNode.style.setProperty('--y', '67%');
    heroNode.style.setProperty('--scale', `${this.config.characterScale + 0.22}`);
    this.el.heroSlot.appendChild(heroNode);
    this._characterTemplates.set('hero', heroNode);
  }

  _createPassengerNodes() {
    this.el.passengerPool.innerHTML = '';
    this._passengerNodes = [];
    for (let index = 0; index < this.config.npcCount; index += 1) {
      const npc = this._createCharacterNode();
      npc.style.width = 'clamp(110px, 30%, 176px)';
      npc.style.height = 'clamp(146px, 31vh, 210px)';
      npc.style.setProperty('--scale', `${this.config.characterScale}`);
      npc.style.display = 'none';
      this.el.passengerPool.appendChild(npc);
      this._passengerNodes.push(npc);
    }
  }

  _normalizeRenderSpec(className, renderSpec) {
    if (!renderSpec) {
      return null;
    }
    if (typeof renderSpec === 'string') {
      const category = this._partCategoryByClass[className];
      return this.resolvePartImage(category, renderSpec);
    }
    if (renderSpec.mode) {
      return renderSpec;
    }
    const category = renderSpec.category || this._partCategoryByClass[className];
    const partPath = renderSpec.path || renderSpec.partPath;
    if (!category || !partPath) {
      return null;
    }
    return this.resolvePartImage(category, partPath);
  }

  _setMissingPart(part, reason = 'missing') {
    part.removeAttribute('src');
    part.src = this._missingPixel;
    part.style.opacity = reason === 'pending' ? '0.25' : '0.22';
    part.style.background = 'rgba(255, 255, 255, 0.18)';
    part.style.objectFit = 'contain';
    part.style.objectPosition = 'top left';
    part.style.transform = '';
    part.dataset.renderMode = 'missing';
    part.dataset.renderReason = reason;
    part.dataset.frameX = '';
    part.dataset.frameY = '';
    part.dataset.frameW = '';
    part.dataset.frameH = '';
    part.dataset.assetCandidates = '';
    part.dataset.assetIndex = '';

    if (this.config.debugMissingParts) {
      const className = part.className.split(' ').find((token) => token !== 'part') || part.className;
      const source = part.dataset.renderSource || '';
      const label = `missing-part:${className}/${source || reason}`;
      if (!this._missingLog.has(label)) {
        this._missingLog.add(label);
        console.warn(`[MissingPart] ${className} using placeholder. reason=${reason}`);
      }
    }
  }

  _setAtlasPart(characterNode, part, className, resolved) {
    part.dataset.renderMode = 'atlas';
    part.dataset.renderCategory = resolved.category;
    part.dataset.renderSource = resolved.partPath || '';
    part.dataset.renderReason = '';
    part.dataset.offsetApplied = '';
    part.dataset.atlasFrameName = resolved.atlasFrameName || resolved.frameName || '';

    if (!resolved.frame || !resolved.image) {
      if (this.config.usePaletteFallback) {
        this._setPart(characterNode, className, this._buildPngRenderSpec({
          category: resolved.category,
          partPath: resolved.partPath,
        }));
      } else {
        this._setMissingPart(part, 'missing-frame');
      }
      return;
    }

    const rasterSrc = this._atlasRasterizer.get(
      resolved.category,
      resolved.atlasFrameName || resolved.frameName || resolved.frame?.name || resolved.frameName || '',
      resolved.image,
      resolved.frame,
    );
    if (!rasterSrc) {
      if (this.config.usePaletteFallback) {
        this._setPart(characterNode, className, this._buildPngRenderSpec({
          category: resolved.category,
          partPath: resolved.partPath,
        }));
      } else {
        this._setMissingPart(part, 'atlas-raster-failed');
      }
      return;
    }

    part.style.opacity = '1';
    part.style.background = '';
    part.style.objectFit = 'contain';
    part.style.objectPosition = 'top left';
    part.style.transform = '';
    part.dataset.frameX = String(resolved.frame.x);
    part.dataset.frameY = String(resolved.frame.y);
    part.dataset.frameW = String(resolved.frame.width);
    part.dataset.frameH = String(resolved.frame.height);

    if (resolved.promise && !resolved.image.complete) {
      resolved.promise.finally(() => {
        if (part.isConnected) {
          this._setPart(characterNode, className, this.resolvePartImage(resolved.category, resolved.partPath));
        }
      });
    }

    part.dataset.assetCandidates = '';
    part.dataset.assetIndex = '';
    part.src = rasterSrc;
  }

  _setPngPart(part, className, resolved) {
    if (!resolved || !resolved.candidates || !resolved.candidates.length) {
      this._setMissingPart(part, 'missing-path');
      return;
    }

    part.dataset.renderMode = 'png';
    part.dataset.renderCategory = resolved.category;
    part.dataset.renderSource = resolved.partPath || '';
    part.dataset.renderReason = '';
    part.style.opacity = '1';
    part.style.background = '';
    part.style.objectFit = 'contain';
    part.style.objectPosition = 'top left';
    part.dataset.frameX = '';
    part.dataset.frameY = '';
    part.dataset.frameW = '';
    part.dataset.frameH = '';
    part.dataset.assetCandidates = resolved.candidates.join('||');
    part.dataset.assetIndex = '0';
    part.src = resolved.candidates[0];
  }

  _handlePartError(part, characterNode, className) {
    const mode = part.dataset.renderMode;
    const category = part.dataset.renderCategory;
    const source = part.dataset.renderSource || '';

    if (mode === 'atlas') {
      const fallback = this.resolvePartImage(category, source);
      if (fallback.mode === 'png') {
        this._setPngPart(part, className, fallback);
        return;
      }
      this._setMissingPart(part, 'missing-atlas');
      if (this.config.debugMissingParts) {
        const label = `atlas-image-fail:${category}/${part.dataset.frameX || ''}`;
        if (!this._missingLog.has(label)) {
          this._missingLog.add(label);
          console.warn(`[Atlas] image load failed for ${category}`);
        }
      }
      return;
    }

    if (mode === 'png') {
      const candidates = part.dataset.assetCandidates ? part.dataset.assetCandidates.split('||') : [];
      if (!candidates.length) {
        this._setMissingPart(part, 'missing');
        return;
      }
      const currentUrl = part.currentSrc || part.src;
      if (currentUrl) {
        this._failedAssetUrls.add(currentUrl);
      }
      const current = Number(part.dataset.assetIndex || 0);
      const next = current + 1;
      if (next < candidates.length) {
        part.dataset.assetIndex = String(next);
        if (this._failedAssetUrls.has(candidates[next])) {
          this._setMissingPart(part, 'missing');
          return;
        }
        part.src = candidates[next];
        return;
      }
      this._setMissingPart(part, 'missing');
    }
  }

  _setPart(characterNode, className, renderSpec) {
    const part = characterNode.querySelector(`.${className}`);
    if (!part) return;

    const resolved = this._normalizeRenderSpec(className, renderSpec);
    if (!resolved) {
      this._setMissingPart(part, 'missing-spec');
      return;
    }

    if (!part.dataset.boundError) {
      part.dataset.boundError = '1';
      part.addEventListener('error', () => this._handlePartError(part, characterNode, className));
    }

    if (resolved.mode === 'atlas' && resolved.pending) {
      part.dataset.renderMode = 'atlas';
      part.dataset.renderCategory = resolved.category;
      part.dataset.renderSource = resolved.partPath;
      part.style.opacity = '0.35';
      part.style.background = 'rgba(255, 255, 255, 0.14)';
      part.style.objectFit = 'contain';
      part.style.objectPosition = 'top left';
      part.style.transform = '';
      if (resolved.promise) {
        resolved.promise.finally(() => {
          if (part.isConnected) {
            this._setPart(characterNode, className, this.resolvePartImage(resolved.category, resolved.partPath));
          }
        });
      }
      return;
    }

    if (resolved.mode === 'atlas') {
      this._setAtlasPart(characterNode, part, className, resolved);
      return;
    }

    if (resolved.mode === 'png') {
      this._setPngPart(part, className, resolved);
      return;
    }

    this._setMissingPart(part, 'missing');
  }

  _evaluateLoadStats() {
    const heroNode = this._characterTemplates.get('hero');
    const passengerNodes = this._passengerNodes.map((node, index) => ({ node, role: `passenger-${index}` }));
    const characters = [{ node: heroNode, role: 'hero' }, ...passengerNodes];

    let totalParts = 0;
    let totalRendered = 0;
    let totalMissing = 0;
    let heroPartCount = 0;
    let heroCollapsedCount = 0;
    const missingParts = [];
    const criticalMissing = [];
    const invalidGeometryParts = [];

    characters.forEach((entry) => {
      const node = entry.node;
      if (!node) {
        return;
      }
      if (entry.role.startsWith('passenger-') && node.style.display === 'none') {
        return;
      }
      const partNodes = Array.from(node.querySelectorAll('.part'));
      const partStates = new Map();
      const nodeRect = node.getBoundingClientRect();
      totalParts += partNodes.length;
      partNodes.forEach((part) => {
        const className = part.className.split(' ').find((token) => token !== 'part');
        const hasAsset = part.complete && part.naturalWidth > 0 && part.naturalHeight > 0 && part.src !== this._missingPixel;
        const rect = part.getBoundingClientRect();
        const isCollapsedGeometry =
          Math.abs(rect.left - nodeRect.left) < 1 &&
          Math.abs(rect.top - nodeRect.top) < 1 &&
          Math.abs(rect.width - nodeRect.width) < 1 &&
          Math.abs(rect.height - nodeRect.height) < 1;
        if (isCollapsedGeometry) {
          invalidGeometryParts.push(`${entry.role}.${className}`);
          if (entry.role === 'hero') {
            heroCollapsedCount += 1;
          }
        }
        if (entry.role === 'hero') {
          heroPartCount += 1;
        }
        if (hasAsset) {
          totalRendered += 1;
          partStates.set(className, true);
        } else {
          totalMissing += 1;
          missingParts.push({
            role: entry.role,
            part: className,
            mode: part.dataset.renderMode || 'missing',
            reason: part.dataset.renderReason || 'not-ready',
          });
          partStates.set(className, false);
        }
      });

      Object.entries({
        face: this._criticalPartGroups.face,
        upper: this._criticalPartGroups.upper,
        lower: this._criticalPartGroups.lower,
      }).forEach(([groupName, groupParts]) => {
        const groupMissing = Array.from(groupParts).some((partName) => partStates.get(partName) === false);
        if (groupMissing) {
          criticalMissing.push(`${entry.role}.${groupName}`);
        }
      });
    });

    this._loadStats = {
      mode: this.config.assetMode,
      partsTotal: totalParts,
      partsRendered: totalRendered,
      partsMissing: totalMissing,
      successRate: totalParts ? Math.round((totalRendered / totalParts) * 100) : 0,
      layoutCollapsed: heroPartCount > 0 ? heroCollapsedCount >= Math.ceil(heroPartCount * 0.6) : false,
      invalidGeometryParts,
      missingParts,
      criticalMissing,
      sampleParts: missingParts.slice(0, 12),
    };
  }

  _setCharacterModel(characterNode, model, mood = 'stable') {
    if (!characterNode || !model) return;
    const normalized = this._normalizeModel(model);
    this._setPart(characterNode, 'skin-head', this.resolvePartImage(this._partCategoryByClass['skin-head'], this._skinFile('head', normalized.skinTint)));
    this._setPart(characterNode, 'skin-neck', this.resolvePartImage(this._partCategoryByClass['skin-neck'], this._skinFile('neck', normalized.skinTint)));
    this._setPart(characterNode, 'skin-arm', this.resolvePartImage(this._partCategoryByClass['skin-arm'], this._skinFile('arm', normalized.skinTint)));
    this._setPart(characterNode, 'skin-leg', this.resolvePartImage(this._partCategoryByClass['skin-leg'], this._skinFile('leg', normalized.skinTint)));
    this._setPart(characterNode, 'shirt', this.resolvePartImage(this._partCategoryByClass.shirt, this._shirtFile(normalized)));
    this._setPart(characterNode, 'pants', this.resolvePartImage(this._partCategoryByClass.pants, this._pantsFile(normalized)));
    this._setPart(characterNode, 'shoes', this.resolvePartImage(this._partCategoryByClass.shoes, this._shoesFile(normalized)));
    this._setPart(
      characterNode,
      'face-eyebrows',
      this.resolvePartImage(
        this._partCategoryByClass['face-eyebrows'],
        this._faceEyebrowsFile(normalized, mood === 'danger' ? 3 : mood === 'warn' ? 2 : 1),
      ),
    );
    this._setPart(characterNode, 'face-eyes-left', this.resolvePartImage(this._partCategoryByClass['face-eyes-left'], this._faceEyesFile(normalized)));
    this._setPart(characterNode, 'face-eyes-right', this.resolvePartImage(this._partCategoryByClass['face-eyes-right'], this._faceEyesFile(normalized)));
    this._setPart(characterNode, 'face-mouth', this.resolvePartImage(this._partCategoryByClass['face-mouth'], this._faceMouthFile(normalized, mood)));
    this._setPart(characterNode, 'face-nose', this.resolvePartImage(this._partCategoryByClass['face-nose'], this._faceNoseFile(normalized)));
    this._setPart(characterNode, 'hair', this.resolvePartImage(this._partCategoryByClass.hair, this._hairFilePath(normalized)));

    this._evaluateLoadStats();
  }

  _makeModel(rng, isHero = false) {
    const skinTint = randPick(rng, this.characterCatalog.skinTints);
    const hairColor = randPick(rng, this.characterCatalog.hairColors);
    const gender = rng() > 0.5 ? 'Man' : 'Woman';
    const skinHairMax = gender === 'Man' ? 8 : 6;

    return {
      skinTint,
      hair: {
        color: hairColor,
        gender,
        style: randInt(rng, 1, skinHairMax),
      },
      face: {
        eyebrowColor: randPick(rng, this.characterCatalog.eyebrowColors),
        eyeColor: randPick(rng, this.characterCatalog.eyeColors),
        noseStyle: randInt(rng, 1, 3),
        noseTint: skinTint,
        baseMouth: randPick(rng, this.characterCatalog.mouths),
      },
      shirt: {
        color: randPick(rng, this.characterCatalog.shirtColors),
        style: randInt(rng, 1, 8),
      },
      pants: {
        color: randPick(rng, this.characterCatalog.pantsColors),
        variant: this._pickPantVariant(rng),
      },
      shoes: {
        color: randPick(rng, this.characterCatalog.shoeColors),
        style: randInt(rng, 1, 5),
      },
      isHero,
      seed: this._normalizeRunSeed(isHero ? this.heroSeed : this.rngState),
    };
  }

  _makeHeroModel() {
    return this._makeModel(makeRng(this.heroSeed), true);
  }

  _pickPantVariant(rng) {
    const numeric = randInt(rng, 1, 4);
    const variant = randInt(rng, 0, 6);
    if (variant <= 3) return String(numeric);
    if (variant === 4) return '_long';
    if (variant === 5) return '_short';
    return '_shorter';
  }

  _placeCharacter(node, pos) {
    node.style.left = `${pos.x}%`;
    node.style.top = `${pos.y}%`;
    node.style.display = '';
    node.style.opacity = '1';
    node.style.visibility = 'visible';
  }

  _repairCharacterNode(node, fallbackHeight = '170px') {
    if (!node) {
      return;
    }

    node.style.position = 'absolute';
    node.style.pointerEvents = 'none';
    node.style.visibility = 'visible';

    const rect = node.getBoundingClientRect();
    if (rect.height <= 1 || rect.width <= 1) {
      node.style.height = fallbackHeight;
      node.style.display = node.style.display === 'none' ? 'none' : '';
    }

    if (node.style.height) {
      const parsed = parseFloat(node.style.height);
      if (Number.isFinite(parsed) && parsed > 0) {
        node.style.minHeight = `${Math.max(120, Math.round(parsed * 0.65))}px`;
      }
    }
  }

  _refreshCharacterVisibility() {
    const heroNode = this._characterTemplates.get('hero');
    this._repairCharacterNode(heroNode, '176px');

    this._passengerNodes.forEach((node) => {
      if (node && node.style.display !== 'none') {
        this._repairCharacterNode(node, '170px');
      }
    });
  }

  _applyReactionVisual(phase) {
    this.el.reactionOrb.style.backgroundColor = phase === 'danger' ? '#ff6b86' : phase === 'warn' ? '#ffd06c' : '#8cefc5';
    this.el.reactionOrb.style.boxShadow =
      phase === 'danger'
        ? '0 0 12px rgba(255, 107, 134, 0.85)'
        : phase === 'warn'
          ? '0 0 12px rgba(255, 208, 108, 0.72)'
          : '0 0 10px rgba(140, 239, 197, 0.6)';
  }

  _riskFromPressure() {
    if (this.state.pressure >= this.config.dangerThreshold) return 'danger';
    if (this.state.pressure >= this.config.warnThreshold) return 'warn';
    return 'stable';
  }

  _syncPassengerExpressions(mood) {
    const heroNode = this._characterTemplates.get('hero');
    if (heroNode && this._heroModel) {
      this._setPart(
        heroNode,
        'face-eyebrows',
        this.resolvePartImage(
          this._partCategoryByClass['face-eyebrows'],
          this._faceEyebrowsFile(this._heroModel, mood === 'danger' ? 3 : mood === 'warn' ? 2 : 1),
        ),
      );
      this._setPart(
        heroNode,
        'face-mouth',
        this.resolvePartImage(this._partCategoryByClass['face-mouth'], this._faceMouthFile(this._heroModel, mood)),
      );
    }

    this._passengerNodes.forEach((node, index) => {
      if (node.style.display === 'none') return;
      const model = this.state.characterState.passengers[index];
      if (!model) return;
      this._setPart(
        node,
        'face-eyebrows',
        this.resolvePartImage(
          this._partCategoryByClass['face-eyebrows'],
          this._faceEyebrowsFile(model, mood === 'danger' ? 3 : mood === 'warn' ? 2 : 1),
        ),
      );
      this._setPart(
        node,
        'face-mouth',
        this.resolvePartImage(this._partCategoryByClass['face-mouth'], this._faceMouthFile(model, mood)),
      );
    });
    this._evaluateLoadStats();
  }

  _setPressUiRisk(risk) {
    if (risk === 'danger') {
      this.el.pressureBar.classList.add('danger');
      this.el.pressureBar.classList.remove('warning');
      this.el.elevator.classList.add('shake');
    } else if (risk === 'warn') {
      this.el.pressureBar.classList.add('warning');
      this.el.pressureBar.classList.remove('danger');
      this.el.elevator.classList.remove('shake');
    } else {
      this.el.pressureBar.classList.remove('warning', 'danger');
      this.el.elevator.classList.remove('shake');
    }
  }

  reset() {
    this.state = this._createInitialState();
    this.warningGiven = false;
    this.dangerGiven = false;
    this.finished = false;

    this.el.introOverlay.classList.remove('hidden');
    this.el.resultOverlay.classList.add('hidden');
    this.el.restartBtn.classList.add('hidden');
    this.el.releaseButton.classList.remove('disabled', 'pressed');
    this.el.releaseButton.textContent = 'HOLD';
    this.el.elevator.classList.remove('closed', 'shake');
    this._applyReactionVisual('stable');
    this.audio.stop();

    if (!this._heroModel) {
      this._heroModel = this._makeHeroModel();
    }
    const heroNode = this._characterTemplates.get('hero');
    if (heroNode) {
      this._setCharacterModel(heroNode, this._heroModel, 'stable');
      heroNode.style.display = '';
    }

    this.el.passengerPool.querySelectorAll('.character').forEach((person) => {
      person.style.display = 'none';
      person.style.opacity = '1';
      person.style.visibility = 'visible';
    });

    this._refreshCharacterVisibility();

    this.el.floorText.textContent = `${this.state.currentFloor}`;
    this.el.targetText.textContent = `${this.state.targetFloor}`;
    this.state.characterState.hero = this._heroModel;
    this.state.characterState.passengers = [];
    this.render();
  }

  startIntro() {
    this.reset();
  }

  startRun() {
    this.state.phase = 'running';
    this.state.elapsedMs = 0;
    this.state.introElapsedMs = 0;
    this.state.currentFloor = 1;
    this.state.smellLevel = 0;
    this.state.soundLevel = 0;
    this.state.isHolding = false;
    this.state.pressure = 14;

    this.state.runSeed = this._normalizeRunSeed(Date.now());
    this.rng = makeRng(this.state.runSeed);

    const heroNode = this._characterTemplates.get('hero');
    if (heroNode) {
      heroNode.style.display = '';
      heroNode.style.left = '32%';
      heroNode.style.top = '67%';
    }

    const passengers = [];
    const positions = [
      { x: 30, y: 58 },
      { x: 58, y: 58 },
      { x: 72, y: 62 },
      { x: 64, y: 72 },
    ];

    for (let i = 0; i < this.config.npcCount; i += 1) {
      const node = this._passengerNodes[i];
      if (!node) {
        continue;
      }
      const model = this._makeModel(this.rng, false);
      const pos = positions[i % positions.length];
      this._placeCharacter(node, pos);
      this._setCharacterModel(node, model, 'stable');
      passengers.push(model);
    }

    this.state.characterState.passengers = passengers;
    this._refreshCharacterVisibility();

    this.el.introOverlay.classList.add('hidden');
    this.el.elevator.classList.add('closed');
    this.audio.start();
    this.el.pressureBar.classList.remove('warning', 'danger');
    this._setPressUiRisk('stable');
    this._syncPassengerExpressions('stable');
    this._applyReactionVisual('stable');
    this.render();
  }

  onPressStart() {
    if (this.state.phase !== 'running' || this.finished || this.state.isHolding) {
      return;
    }
    if (!this.el.releaseButton.classList.contains('disabled')) {
      this.state.isHolding = true;
      this.el.releaseButton.textContent = '누르고 있음';
      this.el.releaseButton.classList.add('pressed');
    }

    if (!this.audio.started) {
      this.audio.start();
    }

    this.state.pressure = clamp(this.state.pressure - this.config.pressureReleasePerSec * 0.15, 0, this.config.pressureMax);
    this.state.smellLevel = clamp(this.state.smellLevel + 8, 0, 100);
    this.state.soundLevel = clamp(this.state.soundLevel + 12, 0, 100);
    this.audio.setContinuousSound(this.state.soundLevel, this.state.isHolding);
    this.render();
  }

  onPressEnd() {
    if (this.state.phase !== 'running' || this.finished) {
      this.state.isHolding = false;
      this.el.releaseButton.classList.remove('pressed');
      return;
    }

    if (this.state.isHolding) {
      this.state.isHolding = false;
      this.el.releaseButton.classList.remove('pressed');
      this.el.releaseButton.textContent = 'HOLD';
    }
  }

  update(dtMs) {
    if (this.state.phase === 'intro') {
      this.state.introElapsedMs += dtMs;
      if (this.state.introElapsedMs >= this.introDurationMs) {
        this.startRun();
      }
      return;
    }

    if (this.state.phase !== 'running' || this.finished) {
      return;
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

    if (
      !this.warningGiven &&
      previousPressure < this.config.warnThreshold &&
      this.state.pressure >= this.config.warnThreshold
    ) {
      this.warningGiven = true;
      this.triggerFeedback('warn');
    }

    if (
      !this.dangerGiven &&
      previousPressure < this.config.dangerThreshold &&
      this.state.pressure >= this.config.dangerThreshold
    ) {
      this.dangerGiven = true;
      this.triggerFeedback('danger');
    }

    if (this.state.pressure >= this.config.pressureMax) {
      this.fail();
      return;
    }

    if (this.state.elapsedMs >= this.config.travelDurationMs) {
      this.success();
      return;
    }

    this.audio.setContinuousSound(this.state.soundLevel, this.state.isHolding);
  }

  render() {
    if (this.state.phase === 'intro') {
      const remaining = Math.max(0, this.introDurationMs - this.state.introElapsedMs);
      const countdown = Math.max(1, Math.ceil(remaining / 1000));
      this.el.countdown.textContent = `${countdown}`;
      this.el.introOverlay.classList.remove('hidden');
      this.el.resultOverlay.classList.add('hidden');
      this.el.floorText.textContent = `${this.state.currentFloor}`;
      if (remaining < 900) {
        this.el.elevator.classList.remove('closed');
      }
      return;
    }

    this.el.introOverlay.classList.add('hidden');
    this._refreshCharacterVisibility();

    this.el.floorText.textContent = `${this.state.currentFloor}`;
    this.el.targetText.textContent = `${this.config.targetFloor}`;

    this.el.pressureBar.style.width = `${this.state.pressure}%`;
    this.el.smellBar.style.width = `${this.state.smellLevel}%`;
    this.el.soundBar.style.width = `${this.state.soundLevel}%`;

    const risk = this._riskFromPressure();
    this._setPressUiRisk(risk);
    this._syncPassengerExpressions(risk);
    this._applyReactionVisual(risk);

    if (risk === 'danger') {
      this.el.elevator.style.filter = 'saturate(1.1)';
      this.el.elevator.style.boxShadow = 'inset 0 0 0 1px rgba(255, 111, 143, 0.25)';
    } else {
      this.el.elevator.style.filter = '';
      this.el.elevator.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)';
    }
  }

  triggerFeedback(level) {
    if (navigator.vibrate) {
      if (level === 'warn') {
        navigator.vibrate(this.config.reactionProfile.warnVibration);
      } else if (level === 'danger') {
        navigator.vibrate(this.config.reactionProfile.dangerVibration);
      }
    }

    if (level === 'warn') {
      this.audio.beep(380, 0.07, 0.06);
    } else if (level === 'danger') {
      this.audio.beep(470, 0.09, 0.11);
    }
  }

  success() {
    this.finished = true;
    this.state.phase = 'success';
    this.audio.stop();
    this.audio.cheer();

    this.el.resultTitle.textContent = '도착!';
    this.el.resultMessage.textContent = '목표층에 도달했습니다.';
    this.el.resultOverlay.classList.remove('hidden');
    this.el.restartBtn.classList.remove('hidden');
    this.el.releaseButton.classList.add('disabled');
    this.el.elevator.classList.remove('shake');
    this._setPressUiRisk('stable');

    if (navigator.vibrate) {
      navigator.vibrate(this.config.reactionProfile.successVibration);
    }
  }

  fail() {
    this.finished = true;
    this.state.phase = 'fail';
    this.state.pressure = this.config.pressureMax;
    this.el.pressureBar.style.width = '100%';
    this.audio.stop();
    this.audio.impact();

    this.el.resultTitle.textContent = '실패';
    this.el.resultMessage.textContent = '한계 초과로 폭발 직전 상태!';
    this.el.resultOverlay.classList.remove('hidden');
    this.el.restartBtn.classList.remove('hidden');
    this.el.releaseButton.classList.add('disabled');
    this._setPressUiRisk('stable');
    this.el.elevator.classList.remove('shake');
    this._applyReactionVisual('danger');

    if (this.state.isHolding) {
      this.state.isHolding = false;
      this.el.releaseButton.classList.remove('pressed');
      this.el.releaseButton.textContent = 'HOLD';
    }

    if (navigator.vibrate) {
      navigator.vibrate(this.config.reactionProfile.failVibration);
    }
  }

  renderGameToText() {
    const heroNode = this._characterTemplates.get('hero');
    const visibleHeroImgs = heroNode
      ? Array.from(heroNode.querySelectorAll('img')).filter((part) => part.complete && part.naturalWidth > 0 && part.naturalHeight > 0).length
      : 0;
    this._evaluateLoadStats();
    const loadStats = this._loadStats || {};
    const critical = loadStats.criticalMissing || [];
    const heroWarnings = critical.filter((value) => `${value}`.startsWith('hero.'));
    const passengerWarnings = critical.filter((value) => `${value}`.startsWith('passenger-'));

    return JSON.stringify({
      phase: this.state.phase,
      floor: this.state.currentFloor,
      targetFloor: this.state.targetFloor,
      elapsedMs: Math.round(this.state.elapsedMs),
      remainingMs: Math.max(0, this.config.travelDurationMs - this.state.elapsedMs),
      pressure: Math.round(this.state.pressure),
      smellLevel: Math.round(this.state.smellLevel),
      soundLevel: Math.round(this.state.soundLevel),
      risk: this._riskFromPressure(),
      isHolding: this.state.isHolding,
      heroHeight: heroNode ? Math.round(heroNode.getBoundingClientRect().height) : 0,
      visibleHeroImgs,
      loadStats,
      characterIntegrity: {
        heroWarnings,
        passengerWarnings,
      },
      runSeed: this.state.runSeed,
    });
  }
}

function createElements() {
  return {
    elevator: document.getElementById('elevator'),
    floorText: document.getElementById('floorText'),
    targetText: document.getElementById('targetText'),
    pressureBar: document.getElementById('pressureBar'),
    smellBar: document.getElementById('smellBar'),
    soundBar: document.getElementById('soundBar'),
    releaseButton: document.getElementById('releaseButton'),
    restartBtn: document.getElementById('restartBtn'),
    introOverlay: document.getElementById('introOverlay'),
    resultOverlay: document.getElementById('resultOverlay'),
    countdown: document.getElementById('countdown'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    heroSlot: document.getElementById('heroSlot'),
    passengerPool: document.getElementById('passengerPool'),
    reactionOrb: document.getElementById('reactionOrb'),
  };
}

function bindInput(game) {
  const holdTarget = game.el.releaseButton;

  const startHold = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (game.state.phase !== 'running' || game.finished) {
      return;
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (event?.pointerId != null && holdTarget.setPointerCapture) {
      try {
        holdTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore pointer capture failure
      }
    }
    game.onPressStart();
  };

  const endHold = (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (event?.pointerId != null && holdTarget.releasePointerCapture) {
      try {
        holdTarget.releasePointerCapture(event.pointerId);
      } catch (err) {
        // ignore
      }
    }
    game.onPressEnd();
  };

  holdTarget.addEventListener('pointerdown', startHold);
  holdTarget.addEventListener('pointerup', endHold);
  holdTarget.addEventListener('pointercancel', endHold);
  holdTarget.addEventListener('pointerleave', endHold);

  holdTarget.addEventListener('touchstart', startHold, { passive: false });
  holdTarget.addEventListener('touchend', endHold);
  holdTarget.addEventListener('touchcancel', endHold);

  holdTarget.addEventListener('mousedown', startHold);
  holdTarget.addEventListener('mouseup', endHold);
  holdTarget.addEventListener('mouseleave', endHold);

  window.addEventListener('pointerup', endHold);

  game.el.restartBtn.addEventListener('click', () => {
    game.startIntro();
  });

  game.el.introOverlay.addEventListener('click', () => {
    if (game.state.phase === 'intro') {
      game.startRun();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.onPressEnd();
  });

  const isTyping = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || isTyping()) {
      return;
    }
    event.preventDefault();
    game.onPressStart();
  });

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' || isTyping()) {
      return;
    }
    event.preventDefault();
    game.onPressEnd();
  });
}

function bootstrap() {
  const elements = createElements();
  const audio = new FartAudio();
  const game = new GameEngine(GameConfig, elements, audio);

  bindInput(game);

  let lastTime = 0;
  const loop = (now) => {
    if (!lastTime) {
      lastTime = now;
    }
    const dt = now - lastTime;
    lastTime = now;

    game.update(dt);
    game.render();
    requestAnimationFrame(loop);
  };

  window.render_game_to_text = () => game.renderGameToText();
  window.advanceTime = (ms) => {
    const step = 1000 / 60;
    let remaining = Math.max(0, ms || 0);
    while (remaining > 0) {
      const batch = Math.min(step, remaining);
      game.update(batch);
      game.render();
      remaining -= batch;
    }
  };

  game.startIntro();
  requestAnimationFrame(loop);
}

bootstrap();
