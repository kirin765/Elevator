import { GAME_CONFIG } from './game/config.js';
import { BootScene } from './game/scenes/boot-scene.js';
import { PlayScene } from './game/scenes/play-scene.js';

const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_CONFIG.view.width,
  height: GAME_CONFIG.view.height,
  backgroundColor: '#0b1a35',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  plugins: {
    scene: [
      {
        key: 'rexUI',
        plugin: window.rexuiplugin,
        mapping: 'rexUI',
      },
    ],
  },
  scene: [BootScene, PlayScene],
};

const game = new Phaser.Game(phaserConfig);

const getPlayScene = () => {
  const scene = game.scene.keys?.PlayScene;
  return scene && scene.scene?.isActive() ? scene : scene || null;
};

window.render_game_to_text = () => {
  const scene = getPlayScene();
  if (!scene || !scene.renderGameToText) {
    return JSON.stringify({ engine: 'phaser', phase: 'boot' });
  }
  return scene.renderGameToText();
};

window.advanceTime = (ms) => {
  const scene = getPlayScene();
  if (!scene || !scene.advanceTime) {
    return;
  }
  scene.advanceTime(ms);
};
