# 엘리베이터 방귀 참기 게임

모바일 9:16 비율 전용으로 동작하는 단일 HTML/CSS/JS 게임입니다.

## 핵심 목표
- 10층까지 25초 동안 도달하는 동안 방귀 압력을 `100%` 이하로 유지합니다.
- 버튼을 누르고 있어 압력을 완화하고, 대신 냄새/소리 지수가 올라갑니다.
- 압력이 `70%`, `90%` 지점을 넘으면 경고/위험 연출이 강화됩니다.

## 실행 방법
1. 저장소 루트에서 브라우저로 열기: `index.html`
2. 로컬 서버로 실행(권장):  
   `python3 -m http.server`

## 폴더
- `index.html`: 구조 + 오버레이/HUD/버튼
- `style.css`: 9:16 모바일 UI + 모듈러 캐릭터 레이어링
- `game.js`: 게임 상태 머신/물리/사운드/캐릭터 생성
- `assets/characters`: 캐릭터 자산(모듈러 PNG)

## 조작(요약 3개)
1. 인트로 3초 카운트다운 뒤 자동으로 시작됩니다.
2. 화면 하단 `HOLD` 터치/클릭을 누르는 동안은 압력이 내려갑니다.  
3. 누르는 동안 냄새/소리는 올라가고, 방귀 누출 과다 구간은 바 색/진동/오디오로 피드백됩니다.

## 핵심 화면/비주얼 규칙
- 텍스트는 최소화되어 **층수(현재/목표)**만 지속 표시됩니다.
- HUD는 엘리베이터 내부 좌우에 압력/냄새/소리 상태바로 구성되어 있습니다.
- 인트로/결과 오버레이는 1줄 중심 메시지 + 버튼(재시작)만 표시됩니다.

## 장면 규칙
- 승차 연출 후 3초 카운트다운 자동 진입
- 주인공은 최초 1회 생성된 모델을 재사용(재시작에도 유지)
- 매 판 시작마다 NPC 3명 랜덤 재생성

## 튜닝 상수
`game.js`의 `GameConfig`에서 조정

```js
const GameConfig = {
  targetFloor: 10,
  travelDurationMs: 25000,
  pressureMax: 100,
  pressureRisePerSec: 8,
  pressureReleasePerSec: 20,
  warnThreshold: 70,
  dangerThreshold: 90,
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
  npcCount: 3,
  characterScale: 0.75,
};
```

`assetMode` 값:
- `atlas`: Spritesheet 우선 렌더링(기본)
- `png`: PNG 경로 기반 렌더링

`render_game_to_text()` 응답에는 `loadStats`가 추가되어 파츠 렌더 상태(`partsTotal`, `partsRendered`, `partsMissing`, `successRate`, `mode`)를 확인할 수 있습니다.

## 자동화 테스트 훅
- `window.render_game_to_text()` : 현재 상태 JSON 반환
- `window.advanceTime(ms)` : Playwright 테스트용 시간 진행 함수

## 오디오 정책
- 모바일 오디오 정책상 첫 사용자 입력(터치/클릭, 스페이스) 이후 재생됩니다.
- 게임은 사운드 미지원 환경을 고려해 사운드가 없어도 바 색/진동/입자 애니메이션으로 피드백을 처리합니다.
