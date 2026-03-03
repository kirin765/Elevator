export function createRexUi(scene, config) {
  const width = scene.scale.width;
  const height = scene.scale.height;

  const floorText = scene.add.text(0, 0, '1 / 10F', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '24px',
    color: '#f2f7ff',
    fontStyle: '700',
  });

  const floorLabel = scene.rexUI.add.label({
    background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 18, 0x000000, 0.45),
    text: floorText,
    space: { left: 14, right: 14, top: 8, bottom: 8 },
  })
    .setPosition(width * 0.5, 56)
    .setDepth(40)
    .layout();

  const orb = scene.rexUI.add.roundRectangle(width - 24, 56, 16, 16, 8, 0x7de8a4, 0.95).setDepth(41);

  const gasLabel = scene.add.text(0, 0, '\uBC29\uAD6C MAX', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '16px',
    color: '#f8f8ff',
    fontStyle: '700',
  });

  const gasBar = scene.add.rectangle(0, 0, 360, 16, 0x1f2740, 0.85).setOrigin(0, 0.5);
  const gasWarningBand = scene.add.rectangle(0, 0, 0, 16, 0x7f1f35, 0.9).setOrigin(0, 0.5);
  const gasFill = scene.add.rectangle(0, 0, 1, 16, 0xfbc5c5, 0.96).setOrigin(0, 0.5);
  const gasRoot = scene.add.container(width * 0.5, 86).setDepth(40);
  gasRoot.add([gasBar, gasFill, gasWarningBand, gasLabel]);
  gasBar.setPosition(-178, 0);
  gasFill.setPosition(-178, 0);
  gasWarningBand.setPosition(-178, 0);
  gasLabel.setPosition(-190, -16);

  const barsRoot = scene.rexUI.add.sizer({
    x: width * 0.5,
    y: height - 118,
    orientation: 'y',
    space: { item: 8 },
  }).setDepth(40);

  const makeBar = (labelText, color, widthPx) => {
    const label = scene.add.text(0, 0, labelText, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: '16px',
      color: '#d8e6ff',
      fontStyle: '600',
    });

    const bg = scene.add.rectangle(0, 0, widthPx, 16, 0xffffff, 0.2).setOrigin(0, 0.5);
    const fill = scene.add.rectangle(0, 0, 1, 16, color, 0.96).setOrigin(0, 0.5);
    const wrap = scene.add.container(0, 0, [bg, fill]);
    wrap.setSize(widthPx, 16);

    const row = scene.rexUI.add.sizer({ orientation: 'x', space: { item: 8 } });
    row.add(label, 0, 'center', 0, false);
    row.add(wrap, 0, 'center', 0, false);

    barsRoot.add(row, 0, 'left', 0, false);

    return {
      fill,
      widthPx,
      setValue: (value) => {
        const clamped = Math.max(0, Math.min(value, 100));
        const nextWidth = Math.max(2, Math.round((clamped / 100) * widthPx));
        fill.width = nextWidth;
      },
    };
  };

  const pressureBar = makeBar('\uC555\uB825', 0xff8a3d, 300);
  const smellBar = makeBar('\uB0C4\uC0C8', 0xfb7185, 240);
  const soundBar = makeBar('\uC18C\uC74C', 0x60a5fa, 240);

  barsRoot.layout();

  const holdText = scene.add.text(0, 0, 'HOLD', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '32px',
    color: '#f2f7ff',
    fontStyle: '700',
  });

  const holdButton = scene.rexUI.add.label({
    background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 18, 0x4b78d1, 1),
    text: holdText,
    space: { left: 40, right: 40, top: 16, bottom: 16 },
  })
    .setPosition(width * 0.5, height - 54)
    .setDepth(45)
    .layout();

  holdButton.setInteractive({ useHandCursor: true });

  const introTitle = scene.add.text(0, 0, '\uAC8C\uC784 \uC2DC\uC791', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '38px',
    color: '#f2f7ff',
    fontStyle: '700',
  });

  const introCountdown = scene.add.text(0, 0, '3', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '88px',
    color: '#ffffff',
    fontStyle: '700',
  });

  const introHint = scene.add.text(0, 0, '\uBC84\uD2BC\uC744 \uB204\uB974\uACE0 \uBB34\uC791\uC704 \uBAA9\uD45C\uCE35\uAE4C\uC9C0 \uB3C4\uCC29\uD558\uC138\uC694.', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '22px',
    color: '#c3d5f2',
  });

  const introPanel = scene.rexUI.add.sizer({
    x: width * 0.5,
    y: height * 0.5,
    orientation: 'y',
    space: { item: 16, left: 24, right: 24, top: 24, bottom: 24 },
  }).setDepth(60);
  introPanel.addBackground(scene.rexUI.add.roundRectangle(0, 0, 460, 280, 16, 0x091428, 0.92));
  introPanel.add(introTitle, 0, 'center', 0, false);
  introPanel.add(introCountdown, 0, 'center', 0, false);
  introPanel.add(introHint, 0, 'center', 0, false);
  introPanel.layout();

  const resultTitle = scene.add.text(0, 0, '\uC131\uACF5 \uACB0\uACFC', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '40px',
    color: '#ffffff',
    fontStyle: '700',
  });

  const resultMessage = scene.add.text(0, 0, '\uC131\uACF5\uD588\uC5B4\uC694.', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '22px',
    color: '#c3d5f2',
  });

  const restartText = scene.add.text(0, 0, '\uC7AC\uB3C4\uC804', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '22px',
    color: '#f2f7ff',
    fontStyle: '700',
  });

  const restartButton = scene.rexUI.add.label({
    background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 12, 0x2d426b, 1),
    text: restartText,
    space: { left: 18, right: 18, top: 10, bottom: 10 },
  }).layout();
  restartButton.setInteractive({ useHandCursor: true });

  const resultPanel = scene.rexUI.add.sizer({
    x: width * 0.5,
    y: height * 0.5,
    orientation: 'y',
    space: { item: 14, left: 24, right: 24, top: 24, bottom: 24 },
  }).setDepth(62);
  resultPanel.addBackground(scene.rexUI.add.roundRectangle(0, 0, 460, 260, 16, 0x08162c, 0.94));
  resultPanel.add(resultTitle, 0, 'center', 0, false);
  resultPanel.add(resultMessage, 0, 'center', 0, false);
  resultPanel.add(restartButton, 0, 'center', 0, false);
  resultPanel.layout();
  resultPanel.setVisible(false);

  const updateGasWarning = () => {
    const warnStart = Math.max(0, Math.min(gasBar.width, Math.round((config.gasWarnThreshold || 70) / 100 * gasBar.width)));
    gasWarningBand.width = Math.max(0, gasBar.width - warnStart);
    gasWarningBand.setX(-178 + warnStart);
    gasWarningBand.setVisible(warnStart < gasBar.width);
  };

  return {
    holdButton,
    restartButton,
    introPanel,
    introCountdown,
    resultPanel,
    resultTitle,
    resultMessage,
    floorText,
    orb,
    pressureBar,
    smellBar,
    soundBar,
    gasLabel,
    gasBar,
    gasFill,
    gasWarningBand,
    holdText,
    setFloor(currentFloor, targetFloor) {
      floorText.setText(`${currentFloor} / ${targetFloor}F`);
      floorLabel.layout();
    },
    setTargetRange(minTargetFloor, maxTargetFloor, targetFloor) {
      const minFloor = Math.max(2, minTargetFloor || 2);
      const maxFloor = Math.max(minFloor, maxTargetFloor || 10);
      const safeTarget = Math.max(minFloor, Math.min(maxFloor, targetFloor || minFloor));
      gasLabel.setText(`\uBAA9\uD45C\uCE35 ${safeTarget}F (${minFloor}-${maxFloor})`);
      updateGasWarning();
    },
    setRisk(risk) {
      const color = risk === 'panic' || risk === 'danger' ? 0xff5f80 : risk === 'warn' ? 0xffbf3d : 0x7de8a4;
      orb.fillColor = color;
    },
    setBars(pressure, smell, sound) {
      pressureBar.setValue(pressure);
      smellBar.setValue(smell);
      soundBar.setValue(sound);
      const clamped = Math.max(0, Math.min(smell, 100));
      gasFill.width = Math.max(2, Math.round((clamped / 100) * gasBar.width));
      if (clamped >= (config.gasFailThreshold || 96)) {
        gasFill.fillColor = 0xff2f62;
      } else if (clamped >= (config.gasDangerThreshold || 90)) {
        gasFill.fillColor = 0xff8a75;
      } else if (clamped >= (config.gasWarnThreshold || 70)) {
        gasFill.fillColor = 0xffc27a;
      } else {
        gasFill.fillColor = 0xfbc5c5;
      }
      gasFill.fillAlpha = 0.96;
    },
    setHoldState(pressed) {
      holdText.setText(pressed ? '\ub204\ub978\ub294 \uc911' : 'HOLD');
      holdButton.getElement('background').setFillStyle(pressed ? 0x6f96ed : 0x4b78d1, 1);
      holdButton.layout();
    },
    setIntroVisible(visible) {
      introPanel.setVisible(visible);
    },
    setIntroCountdown(value) {
      introCountdown.setText(`${value}`);
      introPanel.layout();
    },
    setResult(title, message) {
      resultTitle.setText(title);
      resultMessage.setText(message);
      resultPanel.layout();
      resultPanel.setVisible(true);
    },
    setResultVisible(visible) {
      resultPanel.setVisible(visible);
    },
  };
}
