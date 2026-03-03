Unity Port Notes

이 폴더는 `Phaser + DOM` 게임 규칙을 Unity 2D 런타임으로 이식한 임시 골격입니다.

## 구성
- `Assets/Scripts/Runtime/*` : 런타임, 상태머신, 컨트롤러, 디버그 브릿지
- `Assets/Scripts/Character/*` : 캐릭터 모델/정규화 + 파츠 조합 렌더러
- `Assets/Scripts/UI/*` : UGUI 기반 HUD/오버레이
- `Assets/Scripts/Audio/*` : 프로시저 오디오(톤 + 노이즈)
- `Assets/Art/KenneyModular/PNG` : 원본 아트 원본
- `Assets/Resources/Art/KenneyModular/PNG` : 런타임 `Resources.Load` 대상

## 실행 요약
1. Unity Hub에서 `UnityProject/`을 프로젝트로 열기
2. URP/기본 렌더 파이프라인에서 2D 카메라가 보이면 됨 (스크립트에서 Orthographic 카메라를 생성)
3. 씬을 생성/열고 `ElevatorBootstrap`가 `AfterSceneLoad`에 `GameRoot` + `ElevatorGameController`를 자동 생성합니다.
4. `Build Settings`에 빌드 대상 씬(예: Main)을 등록 후 WebGL로 빌드

## 수동 확인 체크리스트
- Intro가 3초 뒤 `Running` 전환
- HOLD(스페이스/버튼) 상태에서 Pressure 감소, 즉시 감압/해제 시 반응 변화
- 10층, 25000ms에 도달 시 Success
- 90 이상에서 경고 이벤트, 100에서 Fail
- 시작/성공/실패 오버레이 및 HOLD 버튼 라벨, 위험 orb 색상/텍스트 전환
- `ElevatorDebugBridge.RenderGameToJson()` 또는 `ElevatorDebugBridge.AdvanceTime(ms)` 호출 동작

## 브랜치/커밋
- 현재 구현은 임포트 테스트용으로 작성되었으므로, 에디터에서 `Project Settings`, Build Settings, 폴더 메타 파일은 환경에 맞게 정리 후 최종 빌드하세요.
