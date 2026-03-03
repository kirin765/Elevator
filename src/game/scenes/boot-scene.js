import { GAME_CONFIG } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
    this.bootIssues = [];
    this.bootText = null;
    this._atlasLoadPlan = [];
  }

  preload() {
    this.bootIssues = [];
    this._atlasLoadPlan = [];

    const atlas = GAME_CONFIG.assetPack.atlas;
    const categories = ['skin', 'face', 'shirts', 'pants', 'shoes', 'hair'];

    categories.forEach((category) => {
      const cfg = atlas?.[category] || {};
      const images = Array.isArray(cfg.images)
        ? cfg.images.filter(Boolean)
        : [cfg.image, cfg.images].flat().filter(Boolean);

      const key = `atlas-${category}`;
      this._atlasLoadPlan.push({
        key,
        category,
        map: cfg.map,
        images,
        index: 0,
        attempted: new Set(),
      });
    });

    // 로딩 실패 시 후보 이미지로 재시도 + 사용자에게 원인을 노출합니다.
    this.load.on(Phaser.Loader.Events.LOAD_ERROR, (file) => {
      const fileKey = file?.key || '';
      const fileUrl = file?.src || file?.url || '';
      const plan = this._atlasLoadPlan.find((entry) => entry.key === fileKey);
      if (!plan) {
        this._pushIssue(`load-error: ${fileKey} (${fileUrl || 'unknown'})`);
        return;
      }

      // 같은 URL을 반복 시도하지 않도록 가드
      if (fileUrl) plan.attempted.add(fileUrl);

      const nextIndex = (plan.index ?? 0) + 1;
      const nextImage = plan.images?.[nextIndex];
      if (nextImage && !plan.attempted.has(nextImage)) {
        plan.index = nextIndex;
        console.warn(`[Boot] retry atlas ${plan.key}: ${nextImage}`);
        this.load.atlasXML(plan.key, nextImage, plan.map);
        this.load.start();
        return;
      }

      const tried = (plan.images || []).slice(0, (plan.index ?? 0) + 1).filter(Boolean);
      this._pushIssue(`atlas-failed: ${plan.key} tried=[${tried.join(', ')}] map=${plan.map || 'unknown'}`);
    });

    this._atlasLoadPlan.forEach((plan) => {
      const firstImage = plan.images?.[0];
      if (!firstImage || !plan.map) {
        this._pushIssue(`atlas-config-missing: ${plan.key} image=${String(firstImage)} map=${String(plan.map)}`);
        return;
      }
      plan.attempted.add(firstImage);
      this.load.atlasXML(plan.key, firstImage, plan.map);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const missing = this._atlasLoadPlan
        .filter((plan) => !this.textures.exists(plan.key))
        .map((plan) => plan.key);

      if (missing.length) {
        this._pushIssue(`atlas-missing-textures: ${missing.join(', ')}`);
      }

      // PlayScene에서도 확인할 수 있게 registry에 저장
      this.registry.set('bootIssues', [...new Set(this.bootIssues)]);
    });
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

    // 부트 진단 메시지 (에셋 누락/경로 오류를 즉시 보이게 함)
    if (!this.bootText) {
      this.bootText = this.add.text(16, 16, '', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#ffe7ec',
        backgroundColor: 'rgba(15, 18, 28, 0.65)',
        padding: { x: 10, y: 8 },
        wordWrap: { width: Math.max(240, this.scale.width - 32) },
      }).setDepth(9999).setScrollFactor(0);
    }

    const issues = this.registry.get('bootIssues') || this.bootIssues || [];
    if (issues.length) {
      this.bootText.setText([
        '에셋 로딩 문제 감지:',
        ...issues.slice(0, 10).map((line) => `- ${line}`),
        issues.length > 10 ? `... (+${issues.length - 10})` : '',
        '',
        '에셋을 추가/경로 수정 후 새로고침하세요.',
        '(화면을 누르면 경고를 닫고 계속 진행합니다)',
      ].filter(Boolean));
    } else {
      this.bootText.setText('');
    }

    if (issues.length) {
      // 진단 오버레이를 유지한 채로 PlayScene을 실행 (사용자가 확인할 수 있도록)
      if (!this.scene.isActive('PlayScene')) {
        this.scene.launch('PlayScene');
      }
      this.scene.bringToTop();
      this.input.once('pointerdown', () => {
        this.scene.stop();
      });
      return;
    }

    this.scene.start('PlayScene');
  }

  _pushIssue(message) {
    if (!message) return;
    const text = String(message);
    if (!this.bootIssues.includes(text)) {
      this.bootIssues.push(text);
    }
    console.warn(`[BootIssue] ${text}`);
  }
}
