# Elevator Unity 2D Casual Setup Notes

## Current baseline summary
- Core settings are configured for a mobile-first 2D setup:
  - Input System active (`ProjectSettings/ProjectSettings.asset: activeInputHandler = 2` - Both)
  - Portrait locked (`allowedAutorotateToPortrait: 1`, `allowedAutorotateToPortraitUpsideDown: 0`, landscape disabled)
  - Base resolution set to `540x960` and WebGL memory `32~2048`
  - 2D sorting layers and layers added (`BG`, `Character`, `FX`, `GasFX`, `UI`)
- Required project folders are under `Assets/...` and package deps include `InputSystem`, `2d.sprite`, `2d.tilemap`, `ugui`.
- Scene tools:
  - `Assets/Editor/ElevatorSceneBootstrapper.cs`
  - Menu: `Tools/Elevator/Create Main Scene` / `Tools/Elevator/Validate Main Scene`

## Where to find
- `Packages/manifest.json` and `Packages/packages-lock.json`
- `ProjectSettings/ProjectSettings.asset`
- `ProjectSettings/TagManager.asset`
- `ProjectSettings/EditorBuildSettings.asset`
- `Assets/Scripts/Config/ElevatorProjectConfig.cs`
- `Assets/Scripts/Input/ElevatorInputRouter.cs`
- `Assets/Scripts/Runtime/ElevatorRuntimeBootstrap.cs`
- `Assets/Scenes/Main.unity`
- `Assets/Resources/ElevatorProjectConfig.asset`

## Next-step checklist
- Open Unity and run **Tools/Elevator/Create Main Scene** (or **Rebuild Main Scene** for clean reset).
- Build 2D runtime UI/logic on top of the generated skeleton (`GameRoot`, `UIRoot`, `InputRouter`, `RuntimeBootstrap`, `Canvas`).
- Add game-specific prefabs and gameplay scripts.
- Ensure `Input Action Asset` on `InputRouter` references `Assets/Scripts/Input/ElevatorGameInputActions.inputactions` if you want explicit non-fallback bindings.

## Branch
- Working branch: `codex/fresh-start`
