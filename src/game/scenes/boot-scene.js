import { GAME_CONFIG } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const atlas = GAME_CONFIG.assetPack.atlas;
    this.load.atlasXML('atlas-skin', atlas.skin.image, atlas.skin.map);
    this.load.atlasXML('atlas-face', atlas.face.image, atlas.face.map);
    this.load.atlasXML('atlas-shirts', atlas.shirts.image, atlas.shirts.map);
    this.load.atlasXML('atlas-pants', atlas.pants.image, atlas.pants.map);
    this.load.atlasXML('atlas-shoes', atlas.shoes.image, atlas.shoes.map);
    this.load.atlasXML('atlas-hair', atlas.hair.image, atlas.hair.map);
  }

  create() {
    if (!this.textures.exists('missing-part')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0xffffff, 0.28);
      graphics.fillRect(0, 0, 16, 16);
      graphics.lineStyle(2, 0xff5f80, 0.85);
      graphics.strokeRect(0, 0, 16, 16);
      graphics.generateTexture('missing-part', 16, 16);
      graphics.destroy();
    }

    this.scene.start('PlayScene');
  }
}
