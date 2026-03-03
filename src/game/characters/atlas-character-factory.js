import {
  CHARACTER_LAYOUT,
  LIMB_LAYOUT,
  FACE_LAYOUT_ON_HEAD,
  CHARACTER_CATALOG,
  HERO_SIZE,
  NPC_SIZE,
  clamp,
} from '../config.js';

const PART_ORDER = [
  { className: 'skin-leg-left', category: 'skin' },
  { className: 'skin-leg-right', category: 'skin' },
  { className: 'shoe-left', category: 'shoes' },
  { className: 'shoe-right', category: 'shoes' },
  { className: 'skin-arm-left', category: 'skin' },
  { className: 'shirt-arm-left', category: 'shirts' },
  { className: 'hand-left', category: 'skin' },
  { className: 'shirt', category: 'shirts' },
  { className: 'pants', category: 'pants' },
  { className: 'skin-neck', category: 'skin' },
  { className: 'skin-head', category: 'skin' },
  { className: 'skin-arm-right', category: 'skin' },
  { className: 'shirt-arm-right', category: 'shirts' },
  { className: 'hand-right', category: 'skin' },
  { className: 'face-eyes-left', category: 'face' },
  { className: 'face-eyes-right', category: 'face' },
  { className: 'face-nose', category: 'face' },
  { className: 'face-mouth', category: 'face' },
  { className: 'face-eyebrows', category: 'face' },
  { className: 'hair', category: 'hair' },
];

const ATLAS_KEYS = {
  skin: 'atlas-skin',
  face: 'atlas-face',
  shirts: 'atlas-shirts',
  pants: 'atlas-pants',
  shoes: 'atlas-shoes',
  hair: 'atlas-hair',
};

const FACE_LAYOUT_BY_CLASS = {
  'face-eyebrows': 'eyebrows',
  'face-eyes-left': 'eyesLeft',
  'face-eyes-right': 'eyesRight',
  'face-nose': 'nose',
  'face-mouth': 'mouth',
};

const slug = (value) => `${value || ''}`.toLowerCase().replace(/ /g, '');
const isMirroredPart = (className) => className.endsWith('-right');

const normalizePantsVariant = (value) => {
  const raw = `${value ?? ''}`.trim();
  if (raw === '_long' || raw === '_short' || raw === '_shorter') {
    return raw;
  }
  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 4) {
    return String(numeric);
  }
  return '1';
};

export class AtlasCharacterFactory {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.pngBase = config.assetPack.pngBase;
    this.dynamicLoads = new Map();
    this.atlasCutCache = new Map();
    this.fallbackWarnings = new Set();
  }

  createCharacter(role, x, y) {
    const size = role === 'hero' ? HERO_SIZE : NPC_SIZE;
    const container = this.scene.add.container(x, y).setDepth(role === 'hero' ? 20 : 15);
    container.setData('role', role);

    const parts = new Map();
    PART_ORDER.forEach((partInfo) => {
      const layout = this._getPartLayout(partInfo.className);
      if (!layout) return;

      const slot = {
        x: layout.x * size.width,
        y: layout.y * size.height,
        w: layout.w * size.width,
        h: layout.h * size.height,
      };

      const part = this.scene.add.image(0, 0, 'missing-part');
      part.setOrigin(0.5, 0.5);
      part.setDepth(layout.z || 0);
      part.setData('className', partInfo.className);
      part.setData('mode', 'missing');
      part.setData('missingKey', '');
      this._setPartSlot(part, slot, isMirroredPart(partInfo.className));
      parts.set(partInfo.className, part);
      container.add(part);
    });

    return {
      role,
      width: size.width,
      height: size.height,
      container,
      parts,
      model: null,
      mood: 'stable',
    };
  }

  updateCharacter(character, model, mood = 'stable') {
    character.model = model;
    character.mood = mood;

    PART_ORDER.forEach((partInfo) => {
      if (partInfo.className.startsWith('face-')) return;
      const part = character.parts.get(partInfo.className);
      if (!part) return;
      const spec = this._resolvePartPathSpec(partInfo.className, model, mood);
      this._applyPartTexture(part, partInfo.category, spec.path, spec.fallbackPath);
    });

    this._updateFaceLayout(character);

    PART_ORDER.forEach((partInfo) => {
      if (!partInfo.className.startsWith('face-')) return;
      const part = character.parts.get(partInfo.className);
      if (!part) return;
      const spec = this._resolvePartPathSpec(partInfo.className, model, mood);
      this._applyPartTexture(part, partInfo.category, spec.path, spec.fallbackPath);
    });
  }

  collectStats(characters) {
    const missingFrames = [];
    const oversizedParts = [];
    let partsTotal = 0;
    let partsMissing = 0;
    let distortedParts = 0;
    let layoutCollapsed = false;
    const missingByClass = {};
    const missingByCategory = {};
    const missingByRole = {};

    characters.forEach((character) => {
      if (!character) return;
      PART_ORDER.forEach((partInfo) => {
        const part = character.parts.get(partInfo.className);
        if (!part) return;
        partsTotal += 1;

        const sx = Math.abs(part.scaleX || 0);
        const sy = Math.abs(part.scaleY || 0);
        if (Math.abs(sx - sy) > 0.0001) {
          distortedParts += 1;
        }

        const slotW = Number(part.getData('slotW')) || 0;
        const slotH = Number(part.getData('slotH')) || 0;
        const overWidth = slotW > 0 && part.displayWidth > slotW * 1.1;
        const overHeight = slotH > 0 && part.displayHeight > slotH * 1.1;
        if (overWidth || overHeight) {
          oversizedParts.push(`${character.role}.${partInfo.className}`);
        }

        if (part.getData('mode') === 'missing') {
          partsMissing += 1;
          const miss = part.getData('missingKey');
          if (miss && !missingFrames.includes(miss)) {
            missingFrames.push(miss);
          }

          const category = partInfo.category;
          const className = partInfo.className;
          const role = character.role || 'unknown';
          missingByClass[className] = (missingByClass[className] || 0) + 1;
          missingByCategory[category] = (missingByCategory[category] || 0) + 1;
          if (!missingByRole[role]) missingByRole[role] = 0;
          missingByRole[role] += 1;
        }
      });

      const coreClasses = ['skin-head', 'shirt', 'pants', 'shoe-left', 'shoe-right'];
      const points = coreClasses
        .map((className) => character.parts.get(className))
        .filter((part) => part && part.getData('mode') !== 'missing')
        .map((part) => ({ x: part.x, y: part.y }));

      if (points.length >= 4) {
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanY = Math.max(...ys) - Math.min(...ys);
        if (spanX < character.width * 0.18 && spanY < character.height * 0.18) {
          layoutCollapsed = true;
        }
      }
    });

    const topMissing = Object.entries(missingByClass)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      mode: 'atlas',
      partsTotal,
      partsRendered: Math.max(0, partsTotal - partsMissing),
      partsMissing,
      missingFrames,
      missingByClass,
      missingByCategory,
      missingByRole,
      topMissing,
      distortedParts,
      oversizedParts,
      layoutCollapsed,
    };
  }

  _getPartLayout(className) {
    return LIMB_LAYOUT[className] || CHARACTER_LAYOUT[className] || null;
  }

  _extractFilename(path) {
    const clean = `${path || ''}`.split(/[?#]/)[0];
    const match = clean.match(/([^/\\]+)$/);
    return match ? match[1] : clean;
  }

  _withoutExtension(fileName) {
    return `${fileName || ''}`.replace(/\.[^./\\?#]+$/, '');
  }

  _resolveAtlasFrame(category, pngPath) {
    if (!category || !pngPath) return null;
    const atlasKey = ATLAS_KEYS[category];
    const texture = this.scene.textures.get(atlasKey);
    if (!texture) {
      return null;
    }

    const fileName = this._extractFilename(pngPath);
    const names = [fileName, this._withoutExtension(fileName)].filter(Boolean);
    for (let i = 0; i < names.length; i += 1) {
      const candidate = names[i];
      if (texture.has(candidate)) {
        return { atlasKey, frame: candidate };
      }
    }

    return {
      atlasKey,
      missing: names,
    };
  }

  _sanitizeKey(value) {
    return `${value}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  _fitPartToSlot(part, slotW, slotH, mirror = Boolean(part.getData('mirror'))) {
    const safeSlotW = Math.max(1, Number(slotW) || 1);
    const safeSlotH = Math.max(1, Number(slotH) || 1);
    const srcW = Math.max(1, part.width || part.frame?.width || 1);
    const srcH = Math.max(1, part.height || part.frame?.height || 1);
    const scale = Math.max(0.0001, Math.min(safeSlotW / srcW, safeSlotH / srcH));
    part.setScale(mirror ? -scale : scale, scale);
    part.setData('slotW', safeSlotW);
    part.setData('slotH', safeSlotH);
  }

  _setPartSlot(part, slot, mirror = false) {
    part.setData('slotX', slot.x);
    part.setData('slotY', slot.y);
    part.setData('slotW', slot.w);
    part.setData('slotH', slot.h);
    part.setData('mirror', mirror);
    part.setPosition(slot.x + slot.w * 0.5, slot.y + slot.h * 0.5);
    this._fitPartToSlot(part, slot.w, slot.h, mirror);
  }

  _updateFaceLayout(character) {
    const headPart = character.parts.get('skin-head');
    if (!headPart) return;

    const headW = headPart.displayWidth;
    const headH = headPart.displayHeight;
    if (headW <= 0 || headH <= 0) return;

    const headLeft = headPart.x - headW * 0.5;
    const headTop = headPart.y - headH * 0.5;

    Object.entries(FACE_LAYOUT_BY_CLASS).forEach(([className, layoutName]) => {
      const part = character.parts.get(className);
      const relative = FACE_LAYOUT_ON_HEAD[layoutName];
      if (!part || !relative) return;
      this._setPartSlot(
        part,
        {
          x: headLeft + headW * relative.x,
          y: headTop + headH * relative.y,
          w: headW * relative.w,
          h: headH * relative.h,
        },
        false,
      );
    });
  }

  _getOrCreateCutTexture(category, atlasKey, frameName) {
    const cacheKey = `${category}:${frameName}`;
    const cachedKey = this.atlasCutCache.get(cacheKey);
    if (cachedKey && this.scene.textures.exists(cachedKey)) {
      return cachedKey;
    }

    const texture = this.scene.textures.get(atlasKey);
    if (!texture) {
      return null;
    }
    const frame = texture.get(frameName);
    if (!frame) {
      return null;
    }
    const source = texture.getSourceImage();
    if (!source) {
      return null;
    }

    const cutW = Math.max(1, frame.cutWidth || frame.width || 1);
    const cutH = Math.max(1, frame.cutHeight || frame.height || 1);
    const textureKey = `atlas-cut-${this._sanitizeKey(category)}-${this._sanitizeKey(frameName)}`;

    if (this.scene.textures.exists(textureKey)) {
      this.atlasCutCache.set(cacheKey, textureKey);
      return textureKey;
    }

    const canvasTexture = this.scene.textures.createCanvas(textureKey, cutW, cutH);
    if (!canvasTexture) {
      return null;
    }

    const ctx = canvasTexture.context;
    ctx.clearRect(0, 0, cutW, cutH);
    ctx.drawImage(source, frame.cutX, frame.cutY, cutW, cutH, 0, 0, cutW, cutH);
    canvasTexture.refresh();
    this.atlasCutCache.set(cacheKey, textureKey);
    return textureKey;
  }

  _warnPartFallback(part, fromPath, toPath, source) {
    const className = part.getData('className') || 'part';
    const fromName = this._extractFilename(fromPath);
    const toName = this._extractFilename(toPath);
    const key = `${source}:${className}:${fromName}->${toName}`;
    if (this.fallbackWarnings.has(key)) return;
    this.fallbackWarnings.add(key);
    console.warn(`[Character] ${className} fallback (${source}): ${fromName} -> ${toName}`);
  }

  _setMissingPart(part, missingLabel) {
    this._fitPartToSlot(part, part.getData('slotW'), part.getData('slotH'), Boolean(part.getData('mirror')));
    part.setTexture('missing-part');
    part.setData('mode', 'missing');
    part.setData('missingKey', missingLabel);
  }

  _applyPartTexture(part, category, partPath, fallbackPath = '') {
    const paths = [partPath, fallbackPath].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);

    for (let i = 0; i < paths.length; i += 1) {
      const candidatePath = paths[i];
      const atlasResolved = this._resolveAtlasFrame(category, candidatePath);
      if (atlasResolved && atlasResolved.frame) {
        const cutTextureKey = this._getOrCreateCutTexture(category, atlasResolved.atlasKey, atlasResolved.frame);
        if (cutTextureKey) {
          part.setTexture(cutTextureKey);
          this._fitPartToSlot(part, part.getData('slotW'), part.getData('slotH'), Boolean(part.getData('mirror')));
          part.setData('mode', 'atlas');
          part.setData('missingKey', '');
          if (candidatePath !== partPath) {
            this._warnPartFallback(part, partPath, candidatePath, 'atlas');
          }
          return;
        }
      }
    }

    const missingNames = paths
      .map((path) => this._extractFilename(path))
      .filter(Boolean)
      .join('|');
    const missingLabel = `${category}:${missingNames || 'unknown'}`;
    this._applyPngFallback(part, partPath, missingLabel, fallbackPath);
  }

  _applyPngFallback(part, pngPath, missingLabel, fallbackPath = '') {
    if (!pngPath) {
      this._setMissingPart(part, missingLabel);
      return;
    }

    const key = `png-${this._withoutExtension(this._extractFilename(pngPath)).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (this.scene.textures.exists(key)) {
      part.setTexture(key);
      this._fitPartToSlot(part, part.getData('slotW'), part.getData('slotH'), Boolean(part.getData('mirror')));
      part.setData('mode', 'png');
      part.setData('missingKey', '');
      return;
    }

    const existingLoad = this.dynamicLoads.get(key);
    const entry = { part, missingLabel, fallbackPath, primaryPath: pngPath };
    if (existingLoad) {
      existingLoad.entries.push(entry);
      return;
    }

    this.dynamicLoads.set(key, { entries: [entry] });

    const onComplete = () => {
      const state = this.dynamicLoads.get(key);
      if (!state) return;
      const hasTexture = this.scene.textures.exists(key);
      state.entries.forEach((current) => {
        if (hasTexture) {
          current.part.setTexture(key);
          this._fitPartToSlot(
            current.part,
            current.part.getData('slotW'),
            current.part.getData('slotH'),
            Boolean(current.part.getData('mirror')),
          );
          current.part.setData('mode', 'png');
          current.part.setData('missingKey', '');
          return;
        }

        if (current.fallbackPath && current.fallbackPath !== current.primaryPath) {
          this._warnPartFallback(current.part, current.primaryPath, current.fallbackPath, 'png');
          this._applyPngFallback(current.part, current.fallbackPath, current.missingLabel, '');
          return;
        }

        this._setMissingPart(current.part, current.missingLabel);
      });
      this.dynamicLoads.delete(key);
    };

    this.scene.load.image(key, pngPath);
    this.scene.load.once(`filecomplete-image-${key}`, onComplete);
    this.scene.load.once(Phaser.Loader.Events.LOAD_ERROR, (fileObj) => {
      if (fileObj?.key === key) {
        onComplete();
      }
    });
    this.scene.load.start();
  }

  _skinFile(part, skinTint) {
    return this._path(['Skin', `Tint ${skinTint}`, `tint${skinTint}_${part}.png`]);
  }

  _hairFilePath(model) {
    const color = model.hair.color;
    return this._path(['Hair', color, `${slug(color)}${model.hair.gender}${model.hair.style}.png`]);
  }

  _shirtFile(model) {
    const prefix = model.shirt.color === 'Yellow' ? 'shirtYellow' : `${slug(model.shirt.color)}Shirt`;
    return this._path(['Shirts', model.shirt.color, `${prefix}${model.shirt.style}.png`]);
  }

  _resolveSleeveLength(style) {
    const safeStyle = clamp(Number.parseInt(style, 10) || 1, 1, 8);
    if (safeStyle <= 3) return 'long';
    if (safeStyle <= 6) return 'short';
    return 'shorter';
  }

  _resolveShirtArmPath(model) {
    const color = model.shirt.color;
    const sleeve = this._resolveSleeveLength(model.shirt.style);
    const prefix = color === 'Yellow' ? 'armYellow' : `${slug(color)}Arm`;
    return this._path(['Shirts', color, `${prefix}_${sleeve}.png`]);
  }

  _resolveHandPath(model) {
    return this._skinFile('hand', model.skinTint);
  }

  _pantsFile(model) {
    const prefix = model.pants.color.replace(/ /g, '');
    return this._path(['Pants', model.pants.color, `pants${prefix}${model.pants.variant}.png`]);
  }

  _shoesFile(model) {
    const color = model.shoes.color;
    const prefix = color === 'Brown 1' ? 'brown' : color === 'Brown 2' ? 'brown2' : slug(color);
    return this._path(['Shoes', color, `${prefix}Shoe${model.shoes.style}.png`]);
  }

  _faceEyesFile(model) {
    return this._path(['Face', 'Eyes', `eye${model.face.eyeColor}_large.png`]);
  }

  _faceEyebrowsFile(model, mood) {
    const variant = mood === 'danger' ? 3 : mood === 'warn' ? 2 : 1;
    return this._path(['Face', 'Eyebrows', `${model.face.eyebrowColor}Brow${variant}.png`]);
  }

  _faceNoseFile(model) {
    return this._path(['Face', 'Nose', `Tint ${model.face.noseTint}`, `tint${model.face.noseTint}Nose${model.face.noseStyle}.png`]);
  }

  _faceMouthFile(model, mood) {
    const base = model.face.baseMouth || CHARACTER_CATALOG.mouths[0];
    const mouth = mood === 'danger' ? 'mouth_sad' : mood === 'warn' ? 'mouth_oh' : base;
    return this._path(['Face', 'Mouth', `${mouth}.png`]);
  }

  _resolvePartPathSpec(className, model, mood) {
    const fallbackSkin = this._skinFile('head', 1);
    const fallbackHair = this._path(['Hair', 'Black', 'blackMan1.png']);
    const fallbackShirt = this._shirtFile({
      ...model,
      shirt: {
        ...model?.shirt,
        color: 'Blue',
        style: 1,
      },
    });
    const fallbackShirtArm = this._path(['Shirts', 'Blue', 'blueArm_short.png']);
    const fallbackPants = this._path(['Pants', 'Blue', 'pantsBlue11.png']);
    const fallbackShoes = this._path(['Shoes', 'Black', 'blackShoe1.png']);
    const fallbackFaceEyes = this._path(['Face', 'Eyes', 'eyeBlack_large.png']);
    const fallbackBrows = this._path(['Face', 'Eyebrows', 'blackBrow1.png']);
    const fallbackNose = this._path(['Face', 'Nose', 'Tint 1', 'tint1Nose1.png']);
    const fallbackMouth = this._path(['Face', 'Mouth', 'mouth_straight.png']);

    if (className === 'skin-head') return { path: this._skinFile('head', model.skinTint), fallbackPath: fallbackSkin };
    if (className === 'skin-neck') return { path: this._skinFile('neck', model.skinTint), fallbackPath: fallbackSkin };
    if (className === 'skin-arm-left' || className === 'skin-arm-right') {
      return { path: this._skinFile('arm', model.skinTint), fallbackPath: fallbackSkin };
    }
    if (className === 'shirt-arm-left' || className === 'shirt-arm-right') {
      return {
        path: this._resolveShirtArmPath(model),
        fallbackPath: fallbackShirtArm,
      };
    }
    if (className === 'hand-left' || className === 'hand-right') {
      return { path: this._resolveHandPath(model), fallbackPath: this._skinFile('hand', 1) };
    }
    if (className === 'skin-leg-left' || className === 'skin-leg-right') {
      return { path: this._skinFile('leg', model.skinTint), fallbackPath: this._skinFile('leg', 1) };
    }
    if (className === 'shoe-left' || className === 'shoe-right') {
      return { path: this._shoesFile(model), fallbackPath: fallbackShoes };
    }
    if (className === 'shirt') return { path: this._shirtFile(model), fallbackPath: fallbackShirt };
    if (className === 'pants') return { path: this._pantsFile(model), fallbackPath: fallbackPants };
    if (className === 'hair') return { path: this._hairFilePath(model), fallbackPath: fallbackHair };
    if (className === 'face-eyes-left' || className === 'face-eyes-right') {
      return { path: this._faceEyesFile(model), fallbackPath: fallbackFaceEyes };
    }
    if (className === 'face-eyebrows') {
      return { path: this._faceEyebrowsFile(model, mood), fallbackPath: fallbackBrows };
    }
    if (className === 'face-nose') return { path: this._faceNoseFile(model), fallbackPath: fallbackNose };
    if (className === 'face-mouth') return { path: this._faceMouthFile(model, mood), fallbackPath: fallbackMouth };
    return { path: this._path(['missing.png']), fallbackPath: fallbackSkin };
  }

  _path(parts) {
    return [this.pngBase, ...parts].join('/');
  }
}

export const normalizeModel = (model) => {
  const skinTint = clamp(Number.parseInt(model?.skinTint, 10) || 1, 1, 8);
  const gender = model?.hair?.gender === 'Woman' ? 'Woman' : 'Man';
  const maxHairStyle = gender === 'Woman' ? 6 : 8;

  return {
    skinTint,
    hair: {
      color: model?.hair?.color || CHARACTER_CATALOG.hairColors[0],
      gender,
      style: clamp(Number.parseInt(model?.hair?.style, 10) || 1, 1, maxHairStyle),
    },
    face: {
      eyebrowColor: model?.face?.eyebrowColor || CHARACTER_CATALOG.eyebrowColors[0],
      eyeColor: model?.face?.eyeColor || CHARACTER_CATALOG.eyeColors[0],
      noseStyle: clamp(Number.parseInt(model?.face?.noseStyle, 10) || 1, 1, 3),
      noseTint: clamp(Number.parseInt(model?.face?.noseTint, 10) || skinTint, 1, 8),
      baseMouth: model?.face?.baseMouth || CHARACTER_CATALOG.mouths[0],
    },
    shirt: {
      color: model?.shirt?.color || CHARACTER_CATALOG.shirtColors[0],
      style: clamp(Number.parseInt(model?.shirt?.style, 10) || 1, 1, 8),
    },
    pants: {
      color: model?.pants?.color || CHARACTER_CATALOG.pantsColors[0],
      variant: normalizePantsVariant(model?.pants?.variant),
    },
    shoes: {
      color: model?.shoes?.color || CHARACTER_CATALOG.shoeColors[0],
      style: clamp(Number.parseInt(model?.shoes?.style, 10) || 1, 1, 5),
    },
  };
};
