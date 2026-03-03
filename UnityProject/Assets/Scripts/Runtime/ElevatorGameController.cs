using System;
using System.Collections.Generic;
using UnityEngine;

public class ElevatorGameController : MonoBehaviour
{
    private const float RefWidth = 540f;
    private const float RefHeight = 960f;
    private const float PixelToWorld = 0.01f;

    [SerializeField]
    private ElevatorGameConfig config;

    [SerializeField]
    private ElevatorUiController uiController;

    [SerializeField]
    private bool showDebugOverlay = true;

    private ElevatorRuntime runtime;
    private ElevatorAudioEngine audioEngine;
    private LayeredCharacter heroCharacter;
    private readonly List<LayeredCharacter> passengers = new();
    private readonly List<LayeredCharacter> allCharacters = new();
    private readonly List<CharacterModel> passengerModels = new();
    private CharacterModel heroModel;
    private CharacterMood mood = CharacterMood.Stable;
    private bool manualStepping;
    private float nextDebugLogAt;
    private float shakeTime;
    private bool isReady;

    private const float ShakeBaseFreq = 3.4f;
    private const float ShakeBaseAmp = 1.2f;

    private Camera mainCamera;
    private long heroSeed = 1L;

    private readonly Dictionary<RiskLevel, float> riskAmp = new()
    {
        { RiskLevel.Stable, 0.8f },
        { RiskLevel.Warn, 1.6f },
        { RiskLevel.Danger, 2.8f },
    };

    private void Awake()
    {
        if (config == null)
        {
            config = ElevatorGameConfig.CreateDefault();
        }

        mainCamera = Camera.main;
        if (mainCamera == null)
        {
            var cam = new GameObject("Main Camera");
            mainCamera = cam.AddComponent<Camera>();
        }

        mainCamera.orthographic = true;
        mainCamera.orthographicSize = RefHeight * 0.5f * PixelToWorld;
        mainCamera.transform.position = new Vector3(RefWidth * 0.5f * PixelToWorld, -RefHeight * 0.5f * PixelToWorld, -10f);

        runtime = new ElevatorRuntime(config);
        audioEngine = gameObject.GetComponent<ElevatorAudioEngine>() ?? gameObject.AddComponent<ElevatorAudioEngine>();
        if (uiController == null)
        {
            var uiRoot = new GameObject("Canvas");
            uiRoot.transform.SetParent(transform);
            uiRoot.transform.localPosition = Vector3.zero;
            uiController = uiRoot.AddComponent<ElevatorUiController>();
            uiController.Initialize(config);
        }
        else
        {
            uiController.Initialize(config);
        }

        uiController.HoldStarted += OnHoldStart;
        uiController.HoldEnded += OnHoldEnd;
        uiController.RestartRequested += StartIntro;

        var seedHash = $"{Application.companyName}|{Application.productName}|{config.targetFloor}|{config.npcCount}";
        heroSeed = CharacterModelFactory.HashCode(seedHash);
        heroModel = CharacterModelFactory.MakeModel(new SeedRng(heroSeed), true);
        BuildCharacters();
        StartIntro();
    }

    private void Update()
    {
        if (!isReady)
        {
            return;
        }

        HandleKeyboard();
        var deltaMs = Time.deltaTime * 1000f;
        if (deltaMs > 0f && !manualStepping)
        {
            StepGame(deltaMs);
        }
    }

    public void StartIntro()
    {
        if (runtime == null)
        {
            runtime = new ElevatorRuntime(config);
        }

        runtime.StartIntro();
        mood = CharacterMood.Stable;
        passengerModels.Clear();
        shakeTime = 0f;

        heroCharacter?.SetModel(heroModel, mood);
        heroCharacter?.SetVisible(true);

        foreach (var passenger in passengers)
        {
            passenger.SetVisible(false);
        }

        audioEngine.Stop();
        if (uiController != null)
        {
            uiController.SetIntroVisible(true);
            uiController.SetResultVisible(false);
            uiController.SetHoldState(false);
            uiController.SetBars(14f, 0f, 0f);
            uiController.SetFloor(1, config.targetFloor);
            uiController.SetRisk(RiskLevel.Stable);
            uiController.SetIntroCountdown(Mathf.CeilToInt(config.introDurationMs / 1000f));
        }

        isReady = true;
    }

    public void AdvanceTime(float ms)
    {
        manualStepping = true;
        var remaining = Mathf.Max(0f, ms);
        var step = 1000f / 60f;
        while (remaining > 0f)
        {
            StepGame(Mathf.Min(step, remaining));
            remaining -= step;
        }

        manualStepping = false;
    }

    public string RenderGameToJson()
    {
        var snapshot = BuildDebugSnapshot();
        return JsonUtility.ToJson(snapshot);
    }

    public string RenderGameToText() => RenderGameToJson();

    private void StepGame(float deltaMs)
    {
        if (runtime == null)
        {
            return;
        }

        var events = runtime.Update(deltaMs);

        for (var i = 0; i < events.Count; i += 1)
        {
            var gameEvent = events[i];
            switch (gameEvent.type)
            {
                case RuntimeEventType.IntroComplete:
                    BeginRun();
                    break;
                case RuntimeEventType.Warn:
                case RuntimeEventType.Danger:
                    ApplyFeedback(gameEvent.type == RuntimeEventType.Warn ? CharacterMood.Warn : CharacterMood.Danger);
                    break;
                case RuntimeEventType.Success:
                case RuntimeEventType.Fail:
                    ApplyResult(gameEvent.type == RuntimeEventType.Success);
                    break;
            }
        }

        var risk = runtime.RiskFromPressure();
        SyncUi(risk);
        SyncCharacters(risk);
        ApplyShake(risk);
        MaybeLogMissingParts();
    }

    private void BeginRun()
    {
        var seed = DateTime.UtcNow.Ticks;
        runtime.BeginRun(seed);
        var runRng = new SeedRng(seed);
        passengers.Clear();
        shakeTime = 0f;

        for (var i = 0; i < Mathf.Clamp(config.npcCount, 0, CharacterLayout.PassengerPositions.Length); i += 1)
        {
            var model = CharacterModelFactory.MakeModel(runRng, false);
            var passenger = allCharacters.Count > i + 1 ? allCharacters[i + 1] : null;
            if (passenger == null)
            {
                continue;
            }

            passengerModels.Add(model);
            passenger.Initialize(
                $"passenger-{i + 1}",
                CharacterLayout.NpcWidth,
                CharacterLayout.NpcHeight,
                model,
                mood,
                config
            );
            passenger.SetVisible(true);
            passengers.Add(passenger);
        }

        heroCharacter.Initialize("hero", CharacterLayout.HeroWidth, CharacterLayout.HeroHeight, heroModel, mood, config);
        heroCharacter.SetVisible(true);
        if (uiController != null)
        {
            uiController.SetIntroVisible(false);
            uiController.SetResultVisible(false);
            uiController.SetHoldState(false);
        }

        audioEngine.StartEngine();
    }

    private void ApplyFeedback(CharacterMood targetMood)
    {
        if (audioEngine == null)
        {
            return;
        }

        switch (targetMood)
        {
            case CharacterMood.Warn:
                audioEngine.Beep(380f, 0.07f, 0.2f);
                Vibrate(config != null ? config.reactionProfile.warnVibration : null);
                mood = CharacterMood.Warn;
                break;
            case CharacterMood.Danger:
                audioEngine.Beep(470f, 0.09f, 0.34f);
                Vibrate(config != null ? config.reactionProfile.dangerVibration : null);
                mood = CharacterMood.Danger;
                break;
        }
    }

    private void ApplyResult(bool isSuccess)
    {
        runtime.OnHoldEnd();
        audioEngine.Stop();
        uiController?.SetHoldState(false);
        uiController?.SetResult(isSuccess ? "SUCCESS" : "FAIL", isSuccess ? "You reached floor successfully!" : "Pressure reached critical level.");
        uiController?.SetResultVisible(true);
        if (isSuccess)
        {
            audioEngine.Cheer();
            Vibrate(config.reactionProfile.successVibration);
        }
        else
        {
            audioEngine.Impact();
            Vibrate(config.reactionProfile.failVibration);
        }
    }

    private void SyncUi(RiskLevel risk)
    {
        if (uiController == null || runtime == null)
        {
            return;
        }

        var state = runtime.State;
        var remaining = Math.Max(0f, config.travelDurationMs - state.elapsedMs);
        uiController.SetFloor(state.currentFloor, state.targetFloor);
        uiController.SetBars(state.pressure, state.smellLevel, state.soundLevel);
        uiController.SetRisk(risk);

        if (state.phase == GamePhase.Intro)
        {
            var remainMs = Math.Max(0f, config.introDurationMs - state.introElapsedMs);
            var countdown = Math.Max(1f, Mathf.Ceil(remainMs / 1000f));
            uiController.SetIntroCountdown((int)countdown);
        }
    }

    private void SyncCharacters(RiskLevel risk)
    {
        var targetMood = risk == RiskLevel.Danger ? CharacterMood.Danger : risk == RiskLevel.Warn ? CharacterMood.Warn : CharacterMood.Stable;
        heroCharacter?.SetModel(heroModel, targetMood);

        for (var i = 0; i < passengers.Count; i += 1)
        {
            var character = passengers[i];
            if (i >= passengerModels.Count)
            {
                break;
            }

            if (!character)
            {
                continue;
            }

            character.SetModel(passengerModels[i], targetMood);
        }
    }

    private void ApplyShake(RiskLevel risk)
    {
        if (runtime == null || runtime.State.phase != GamePhase.Running)
        {
            for (var i = 0; i < allCharacters.Count; i += 1)
            {
                if (allCharacters[i] != null)
                {
                    allCharacters[i].transform.position = allCharacters[i].BaseTopLeftWorld;
                }
            }

            return;
        }

        shakeTime += Time.deltaTime;
        var amp = ShakeBaseAmp * riskAmp[risk];
        var baseNoise = risk == RiskLevel.Danger ? 0.9f : risk == RiskLevel.Warn ? 0.55f : 0.3f;
        var phase1 = shakeTime * ShakeBaseFreq * (1f + baseNoise);
        var phase2 = shakeTime * ShakeBaseFreq * 1.6f;

        for (var i = 0; i < allCharacters.Count; i += 1)
        {
            if (!allCharacters[i] || !allCharacters[i].gameObject.activeSelf)
            {
                continue;
            }

            var dx = Mathf.Sin(phase1 + i) * amp;
            var dy = Mathf.Cos(phase2 + i * 1.15f) * amp * 0.6f;
            allCharacters[i].ApplyShakeOffset(new Vector3(dx, dy, 0f), i, 1f);
        }

        if (runtime.State.phase == GamePhase.Running)
        {
            var sound = runtime.State.soundLevel;
            audioEngine.SetContinuousSound(sound, runtime.State.isHolding);
        }
    }

    private void BuildCharacters()
    {
        if (heroCharacter != null)
        {
            return;
        }

        var hero = new GameObject("hero", typeof(LayeredCharacter));
        hero.transform.SetParent(transform, false);
        heroCharacter = hero.GetComponent<LayeredCharacter>();
        heroCharacter.Initialize("hero", CharacterLayout.HeroWidth, CharacterLayout.HeroHeight, heroModel, CharacterMood.Stable, config);
        heroCharacter.BaseTopLeftWorld = PixelToWorldPosition(CharacterLayout.HeroBasePosition.x, CharacterLayout.HeroBasePosition.y);
        allCharacters.Add(heroCharacter);

        for (var i = 0; i < Mathf.Clamp(config.npcCount, 0, CharacterLayout.PassengerPositions.Length); i += 1)
        {
            var data = CharacterLayout.PassengerPositions[i];
            var passenger = new GameObject($"passenger-{i + 1}", typeof(LayeredCharacter));
            passenger.transform.SetParent(transform, false);
            var lc = passenger.GetComponent<LayeredCharacter>();
            lc.Initialize($"passenger-{i + 1}", CharacterLayout.NpcWidth, CharacterLayout.NpcHeight, CharacterModelFactory.NormalizeModel(null), CharacterMood.Stable, config);
            lc.BaseTopLeftWorld = PixelToWorldPosition(data.x, data.y);
            lc.SetVisible(false);
            passengers.Add(lc);
            allCharacters.Add(lc);
        }
    }

    private Vector3 PixelToWorldPosition(float pixelX, float pixelY)
    {
        return new Vector3(
            pixelX * PixelToWorld - RefWidth * 0.5f,
            -pixelY * PixelToWorld + RefHeight * 0.5f,
            0f
        );
    }

    private void HandleKeyboard()
    {
        if (runtime == null || runtime.State.phase != GamePhase.Running)
        {
            return;
        }

        if (Input.GetKeyDown(KeyCode.Space))
        {
            OnHoldStart();
        }
        else if (Input.GetKeyUp(KeyCode.Space))
        {
            OnHoldEnd();
        }
    }

    private void OnHoldStart()
    {
        if (runtime == null || uiController == null)
        {
            return;
        }

        if (runtime.OnHoldStart())
        {
            uiController.SetHoldState(true);
        }
    }

    private void OnHoldEnd()
    {
        if (runtime == null || uiController == null)
        {
            return;
        }

        runtime.OnHoldEnd();
        uiController.SetHoldState(false);
    }

    private void Vibrate(int[] pattern)
    {
        if (pattern == null || pattern.Length == 0)
        {
            return;
        }

#if UNITY_WEBGL || UNITY_ANDROID || UNITY_IOS
        Handheld.Vibrate();
#endif
    }

    private void MaybeLogMissingParts()
    {
        if (!showDebugOverlay || Time.time < nextDebugLogAt)
        {
            return;
        }

        var summary = CollectMissingSummary();
        if (!string.IsNullOrEmpty(summary))
        {
            Debug.Log($"[Elevator] {summary}");
        }

        nextDebugLogAt = Time.time + 3f;
    }

    private string CollectMissingSummary()
    {
        var partsTotal = 0;
        var partsMissing = 0;
        var distinctMissing = new HashSet<string>();

        foreach (var character in allCharacters)
        {
            if (character == null)
            {
                continue;
            }

            var stats = character.CollectStats();
            partsTotal += stats.partsTotal;
            partsMissing += stats.partsMissing;
            for (var i = 0; i < stats.missingFrames.Length; i += 1)
            {
                distinctMissing.Add(stats.missingFrames[i]);
            }
        }

        if (partsMissing <= 0)
        {
            return string.Empty;
        }

        var ratio = partsTotal > 0 ? (partsMissing / (float)partsTotal) * 100f : 0f;
        return $"Missing parts: {partsMissing}/{partsTotal} ({ratio:F1}%) {string.Join(\" \", distinctMissing)}";
    }

    private DebugSnapshot BuildDebugSnapshot()
    {
        var state = runtime != null ? runtime.State : new RuntimeState(GamePhase.Intro, 0f, 0f, 0f, 0f, 0f, false, 1, 1, 0L);
        var partsTotal = 0;
        var partsRendered = 0;
        var partsMissing = 0;
        foreach (var character in allCharacters)
        {
            var stats = character?.CollectStats() ?? new CharacterStats(0, 0, 0, Array.Empty<string>());
            partsTotal += stats.partsTotal;
            partsRendered += stats.partsRendered;
            partsMissing += stats.partsMissing;
        }

        return new DebugSnapshot
        {
            engine = "unity",
            phase = state.phase.ToString().ToLowerInvariant(),
            floor = state.currentFloor,
            targetFloor = state.targetFloor,
            elapsedMs = Mathf.Round(state.elapsedMs),
            remainingMs = Mathf.Max(0f, config.travelDurationMs - state.elapsedMs),
            pressure = Mathf.Round(state.pressure),
            smellLevel = Mathf.Round(state.smellLevel),
            soundLevel = Mathf.Round(state.soundLevel),
            risk = runtime != null ? runtime.RiskFromPressure().ToString().ToLowerInvariant() : "stable",
            isHolding = state.isHolding,
            physics = new DebugPhysics { mode = "runtime", bodyCount = allCharacters.Count, avgVelocity = 0f },
            characterStats = new CharacterSnapshot { partsTotal = partsTotal, partsRendered = partsRendered, partsMissing = partsMissing },
            ui = new DebugUiState { system = "runtime", holdButtonPressed = state.isHolding, mode = "ready" },
            runSeed = state.runSeed,
            bootIssues = Array.Empty<string>(),
        };
    }

    [Serializable]
    private sealed class DebugSnapshot
    {
        public string engine;
        public string phase;
        public int floor;
        public int targetFloor;
        public float elapsedMs;
        public float remainingMs;
        public float pressure;
        public float smellLevel;
        public float soundLevel;
        public string risk;
        public bool isHolding;
        public DebugPhysics physics;
        public CharacterSnapshot characterStats;
        public DebugUiState ui;
        public long runSeed;
        public string[] bootIssues;
    }

    [Serializable]
    private sealed class DebugPhysics
    {
        public string mode;
        public int bodyCount;
        public float avgVelocity;
    }

    [Serializable]
    private sealed class CharacterSnapshot
    {
        public int partsTotal;
        public int partsRendered;
        public int partsMissing;
    }

    [Serializable]
    private sealed class DebugUiState
    {
        public string system;
        public bool holdButtonPressed;
        public string mode;
    }
}
