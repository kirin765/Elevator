export const GAME_CONFIG = {
  view: {
    width: 540,
    height: 960,
  },
  targetFloor: 10,
  travelDurationMs: 25000,
  introDurationMs: 3000,
  pressureMax: 100,
  pressureRisePerSec: 8,
  pressureReleasePerSec: 20,
  warnThreshold: 70,
  dangerThreshold: 90,
  npcCount: 3,
  characterScale: 1,
  imageExtOrder: ['png'],
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
  reactionProfile: {
    warnVibration: [60],
    dangerVibration: [80, 70, 80],
    failVibration: [150, 70, 170, 70, 230],
    successVibration: [30, 40, 30, 40, 30],
  },
};

export const CHARACTER_CATALOG = {
  skinTints: [1, 2, 3, 4, 5, 6, 7, 8],
  hairColors: ['Black', 'Blonde', 'Brown 1', 'Brown 2', 'Grey', 'Red', 'Tan', 'White'],
  eyeColors: ['Black', 'Blue', 'Brown', 'Green', 'Pine'],
  eyebrowColors: ['black', 'blonde', 'brown1', 'brown2', 'grey', 'red', 'tan', 'white'],
  mouths: ['mouth_glad', 'mouth_happy', 'mouth_oh', 'mouth_straight', 'mouth_sad', 'mouth_teethLower', 'mouth_teethUpper'],
  shirtColors: ['Blue', 'Green', 'Grey', 'Navy', 'Pine', 'Red', 'White', 'Yellow'],
  pantsColors: ['Blue 1', 'Blue 2', 'Brown', 'Green', 'Grey', 'Light Blue', 'Navy', 'Pine', 'Red', 'Tan', 'White', 'Yellow'],
  shoeColors: ['Black', 'Blue', 'Brown 1', 'Brown 2', 'Grey', 'Red', 'Tan'],
};

export const PASSENGER_POSITIONS = [
  { x: 156, y: 604 },
  { x: 290, y: 604 },
  { x: 374, y: 634 },
  { x: 336, y: 706 },
];

export const CHARACTER_LAYOUT = {
  'skin-head': { x: 0.24, y: 0.04, w: 0.52, h: 0.34, z: 2 },
  'skin-neck': { x: 0.36, y: 0.31, w: 0.28, h: 0.1, z: 2 },
  'skin-arm': { x: 0.06, y: 0.33, w: 0.56, h: 0.34, z: 1 },
  'skin-leg': { x: 0.34, y: 0.57, w: 0.3, h: 0.39, z: 1 },
  shirt: { x: 0.18, y: 0.33, w: 0.64, h: 0.42, z: 3 },
  pants: { x: 0.2, y: 0.67, w: 0.62, h: 0.18, z: 4 },
  shoes: { x: 0.26, y: 0.86, w: 0.5, h: 0.11, z: 5 },
  hair: { x: 0.21, y: 0.01, w: 0.58, h: 0.46, z: 8 },
  'face-eyebrows': { x: 0.32, y: 0.18, w: 0.39, h: 0.08, z: 10 },
  'face-eyes-left': { x: 0.31, y: 0.23, w: 0.17, h: 0.12, z: 9 },
  'face-eyes-right': { x: 0.52, y: 0.23, w: 0.17, h: 0.12, z: 9 },
  'face-nose': { x: 0.44, y: 0.29, w: 0.12, h: 0.1, z: 10 },
  'face-mouth': { x: 0.36, y: 0.35, w: 0.29, h: 0.1, z: 8 },
};

export const FACE_LAYOUT_ON_HEAD = {
  eyebrows: { x: 0.18, y: 0.24, w: 0.64, h: 0.12 },
  eyesLeft: { x: 0.22, y: 0.38, w: 0.22, h: 0.16 },
  eyesRight: { x: 0.56, y: 0.38, w: 0.22, h: 0.16 },
  nose: { x: 0.43, y: 0.53, w: 0.14, h: 0.14 },
  mouth: { x: 0.3, y: 0.67, w: 0.4, h: 0.16 },
};

export const HERO_SIZE = { width: 196, height: 230 };
export const NPC_SIZE = { width: 176, height: 210 };

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
export const randPick = (rng, arr) => arr[randInt(rng, 0, arr.length - 1)];

export const hashCode = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
};

export const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) & 0xffffffff) / 4294967296;
  };
};
