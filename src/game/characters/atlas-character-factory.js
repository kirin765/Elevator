import {
  CHARACTER_LAYOUT,
  FACE_LAYOUT_ON_HEAD,
  CHARACTER_CATALOG,
  HERO_SIZE,
  NPC_SIZE,
  clamp,
} from '../config.js';

const PART_ORDER = [
  { className: 'skin-head', category: 'skin' },
  { className: 'skin-neck', category: 'skin' },
  { className: 'skin-arm', category: 'skin' },
  { className: 'skin-leg', category: 'skin' },
  { className: 'shirt', category: 'shirts' },
  { className: 'pants', category: 'pants' },
  { className: 'shoes', category: 'shoes' },
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

const slug = (value) => `${value || ''}`.toLowerCase().replace(/ /g, '');
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
const FACE_LAYOUT_BY_CLASS = {
  'face-eyebrows': 'eyebrows',
  'face-eyes-left': 'eyesLeft',
  'face-eyes-right': 'eyesRight',
  'face-nose': 'nose',
  'face-mouth': 'mouth',
};

export class AtlasCharacterFactory {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.pngBase = config.assetPack.pngBase;
    this.dynamicLoads = new Map();
    this.atlasCutCache = new Map();
  }

  createCharacter(role, x, y) {
    const size = role === 'hero' ? HERO_SIZE : NPC_SIZE;
    const container = this.scene.add.container(x, y).setDepth(role === 'hero' ? 20 : 15);
    container.setData('role', role);

    const parts = new Map();
    PART_ORDER.forEach((partInfo) => {
      const layout = CHARACTER_LAYOUT[partInfo.className];
      const part = this.scene.add.image(layout.x * size.width, layout.y * size.height, 'missing-part');
      part.setOrigin(0, 0);
      part.setDepth(layout.z || 0);
      part.setData('className', partInfo.className);
      part.setData('mode', 'missing');
      part.setData('missingKey', '');
      part.setData('slotX', layout.x * size.width);
      part.setData('slotY', layout.y * size.height);
      part.setData('slotW', layout.w * size.width);
      part.setData('slotH', layout.h * size.height);
      part.setData('role', role);
      this._fitPartToSlot(part, layout.w * size.width, layout.h * size.height);
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
      const pngPath = this._resolvePngPath(partInfo.className, model, mood);
      this._applyPartTexture(part, partInfo.category, pngPath);
    });

    this._updateFaceLayout(character);

    PART_ORDER.forEach((partInfo) => {
      if (!partInfo.className.startsWith('face-')) return;
      const part = character.parts.get(partInfo.className);
      if (!part) return;
      const pngPath = this._resolvePngPath(partInfo.className, model, mood);
      this._applyPartTexture(part, partInfo.category, pngPath);
    });
  }

  collectStats(characters) {
    const missingFrames = [];
    const oversizedParts = [];
    let partsTotal = 0;
    let partsMissing = 0;
    let distortedParts = 0;
    let layoutCollapsed = false;

    characters.forEach((character) => {
      if (!character) return;
      PART_ORDER.forEach((partInfo) => {
        const part = character.parts.get(partInfo.className);
        if (!part) return;
        partsTotal += 1;

        if (Math.abs((part.scaleX || 0) - (part.scaleY || 0)) > 0.0001) {
          distortedParts += 1;
        }

        const slotW = Number(part.getData('slotW')) || 0;
        const slotH = Number(part.getData('slotH')) || 0;
        const overWidth = slotW > 0 && part.displayWidth > slotW * 1.1;
        const overHeight = slotH > 0 && part.displayHeight > slotH * 1.1;
        if (overWidth || overHeight) {
          oversizedParts.push(`${character.role}.${partInfo.className}`);
        }

        const mode = part.getData('mode');
        if (mode === 'missing') {
          partsMissing += 1;
          const miss = part.getData('missingKey');
          if (miss && !missingFrames.includes(miss)) {
            missingFrames.push(miss);
          }
        }
      });

      const coreClasses = ['skin-head', 'shirt', 'pants', 'shoes'];
      const points = coreClasses
        .map((className) => character.parts.get(className))
        .filter((part) => part && part.getData('mode') !== 'missing')
        .map((part) => ({ x: part.x, y: part.y }));

      if (points.length >= 3) {
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanY = Math.max(...ys) - Math.min(...ys);
        if (spanX < character.width * 0.12 && spanY < character.height * 0.12) {
          layoutCollapsed = true;
        }
      }
    });

    return {
      mode: 'atlas',
      partsTotal,
      partsRendered: Math.max(0, partsTotal - partsMissing),
      partsMissing,
      missingFrames,
      distortedParts,
      oversizedParts,
      layoutCollapsed,
    };
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

  _fitPartToSlot(part, slotW, slotH) {
    const safeSlotW = Math.max(1, Number(slotW) || 1);
    const safeSlotH = Math.max(1, Number(slotH) || 1);
    const srcW = Math.max(1, part.width || part.frame?.width || 1);
    const srcH = Math.max(1, part.height || part.frame?.height || 1);
    const scale = Math.max(0.0001, Math.min(safeSlotW / srcW, safeSlotH / srcH));
    part.setScale(scale, scale);
    part.setData('slotW', safeSlotW);
    part.setData('slotH', safeSlotH);
  }

  _setPartSlot(part, slotX, slotY, slotW, slotH) {
    part.setPosition(slotX, slotY);
    part.setData('slotX', slotX);
    part.setData('slotY', slotY);
    this._fitPartToSlot(part, slotW, slotH);
  }

  _updateFaceLayout(character) {
    const headPart = character.parts.get('skin-head');
    if (!headPart) return;

    const headX = headPart.x;
    const headY = headPart.y;
    const headW = headPart.displayWidth;
    const headH = headPart.displayHeight;
    if (headW <= 0 || headH <= 0) return;

    Object.entries(FACE_LAYOUT_BY_CLASS).forEach(([className, layoutName]) => {
      const part = character.parts.get(className);
      const relative = FACE_LAYOUT_ON_HEAD[layoutName];
      if (!part || !relative) return;
      const slotX = headX + headW * relative.x;
      const slotY = headY + headH * relative.y;
      const slotW = headW * relative.w;
      const slotH = headH * relative.h;
      this._setPartSlot(part, slotX, slotY, slotW, slotH);
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

  _applyPartTexture(part, category, pngPath) {
    const atlasResolved = this._resolveAtlasFrame(category, pngPath);
    if (atlasResolved && atlasResolved.frame) {
      const cutTextureKey = this._getOrCreateCutTexture(category, atlasResolved.atlasKey, atlasResolved.frame);
      if (cutTextureKey) {
        part.setTexture(cutTextureKey);
        this._fitPartToSlot(part, part.getData('slotW'), part.getData('slotH'));
        part.setData('mode', 'atlas');
        part.setData('missingKey', '');
        return;
      }
    }

    const missingLabel = `${category}:${(atlasResolved?.missing || []).join('|') || this._extractFilename(pngPath)}`;
    this._applyPngFallback(part, pngPath, missingLabel);
  }

  _applyPngFallback(part, pngPath, missingLabel) {
    const key = `png-${this._withoutExtension(this._extractFilename(pngPath)).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (this.scene.textures.exists(key)) {
      part.setTexture(key);
      this._fitPartToSlot(part, part.getData('slotW'), part.getData('slotH'));
      part.setData('mode', 'png');
      part.setData('missingKey', '');
      return;
    }

    const existingLoad = this.dynamicLoads.get(key);
    if (existingLoad) {
      existingLoad.push(part);
      return;
    }

    this.dynamicLoads.set(key, [part]);

    const onComplete = () => {
      const targets = this.dynamicLoads.get(key) || [];
      const hasTexture = this.scene.textures.exists(key);
      targets.forEach((targetPart) => {
        if (hasTexture) {
          targetPart.setTexture(key);
          this._fitPartToSlot(targetPart, targetPart.getData('slotW'), targetPart.getData('slotH'));
          targetPart.setData('mode', 'png');
          targetPart.setData('missingKey', '');
        } else {
          targetPart.setTexture('missing-part');
          targetPart.setData('mode', 'missing');
          targetPart.setData('missingKey', missingLabel);
        }
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

  _resolvePngPath(className, model, mood) {
    if (className === 'skin-head') return this._path(['Skin', `Tint ${model.skinTint}`, `tint${model.skinTint}_head.png`]);
    if (className === 'skin-neck') return this._path(['Skin', `Tint ${model.skinTint}`, `tint${model.skinTint}_neck.png`]);
    if (className === 'skin-arm') return this._path(['Skin', `Tint ${model.skinTint}`, `tint${model.skinTint}_arm.png`]);
    if (className === 'skin-leg') return this._path(['Skin', `Tint ${model.skinTint}`, `tint${model.skinTint}_leg.png`]);

    if (className === 'shirt') {
      const prefix = model.shirt.color === 'Yellow' ? 'shirtYellow' : `${slug(model.shirt.color)}Shirt`;
      return this._path(['Shirts', model.shirt.color, `${prefix}${model.shirt.style}.png`]);
    }

    if (className === 'pants') {
      const prefix = model.pants.color.replace(/ /g, '');
      return this._path(['Pants', model.pants.color, `pants${prefix}${model.pants.variant}.png`]);
    }

    if (className === 'shoes') {
      const color = model.shoes.color;
      const prefix = color === 'Brown 1' ? 'brown' : color === 'Brown 2' ? 'brown2' : slug(color);
      return this._path(['Shoes', color, `${prefix}Shoe${model.shoes.style}.png`]);
    }

    if (className === 'hair') {
      const color = model.hair.color;
      return this._path(['Hair', color, `${slug(color)}${model.hair.gender}${model.hair.style}.png`]);
    }

    if (className === 'face-eyes-left' || className === 'face-eyes-right') {
      return this._path(['Face', 'Eyes', `eye${model.face.eyeColor}_large.png`]);
    }

    if (className === 'face-eyebrows') {
      const variant = mood === 'danger' ? 3 : mood === 'warn' ? 2 : 1;
      return this._path(['Face', 'Eyebrows', `${model.face.eyebrowColor}Brow${variant}.png`]);
    }

    if (className === 'face-nose') {
      return this._path(['Face', 'Nose', `Tint ${model.face.noseTint}`, `tint${model.face.noseTint}Nose${model.face.noseStyle}.png`]);
    }

    if (className === 'face-mouth') {
      const base = model.face.baseMouth || CHARACTER_CATALOG.mouths[0];
      const mouth = mood === 'danger' ? 'mouth_sad' : mood === 'warn' ? 'mouth_oh' : base;
      return this._path(['Face', 'Mouth', `${mouth}.png`]);
    }

    return this._path(['missing.png']);
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
