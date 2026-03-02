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

  const barsRoot = scene.rexUI.add.sizer({
    x: width * 0.5,
    y: height - 134,
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

  const pressureBar = makeBar('압력', 0xff8a3d, 300);
  const smellBar = makeBar('냄새', 0xfb7185, 240);
  const soundBar = makeBar('소리', 0x60a5fa, 240);

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

  const introTitle = scene.add.text(0, 0, '문이 닫히면 시작', {
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

  const introHint = scene.add.text(0, 0, '홀드를 조절해 10층까지 버텨야 해요.', {
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

  const resultTitle = scene.add.text(0, 0, '게임 결과', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '40px',
    color: '#ffffff',
    fontStyle: '700',
  });

  const resultMessage = scene.add.text(0, 0, '버텨서 도착했어요.', {
    fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    fontSize: '22px',
    color: '#c3d5f2',
  });

  const restartText = scene.add.text(0, 0, '다시 시작', {
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
    holdText,
    setFloor(currentFloor, targetFloor) {
      floorText.setText(`${currentFloor} / ${targetFloor}F`);
      floorLabel.layout();
    },
    setRisk(risk) {
      const color = risk === 'danger' ? 0xff5f80 : risk === 'warn' ? 0xffbf3d : 0x7de8a4;
      orb.fillColor = color;
    },
    setBars(pressure, smell, sound) {
      pressureBar.setValue(pressure);
      smellBar.setValue(smell);
      soundBar.setValue(sound);
    },
    setHoldState(pressed) {
      holdText.setText(pressed ? '누르고 있음' : 'HOLD');
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
