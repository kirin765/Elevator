using System;
using System.Collections.Generic;
using UnityEngine;

public class ElevatorRuntime
{
    private readonly ElevatorGameConfig config;
    private RuntimeState state;
    private readonly List<RuntimeEvent> eventBuffer = new List<RuntimeEvent>(6);
    private bool warningGiven;
    private bool dangerGiven;
    private bool finished;

    public RuntimeState State => state;

    public ElevatorRuntime(ElevatorGameConfig config)
    {
        this.config = config != null ? config : ElevatorGameConfig.CreateDefault();
        state = CreateInitialState();
    }

    public void StartIntro()
    {
        state = CreateInitialState();
        warningGiven = false;
        dangerGiven = false;
        finished = false;
    }

    public void BeginRun(long seed)
    {
        state = new RuntimeState(
            GamePhase.Running,
            0f,
            0f,
            14f,
            0f,
            0f,
            false,
            1,
            config.targetFloor,
            seed
        );
        warningGiven = false;
        dangerGiven = false;
        finished = false;
    }

    public bool OnHoldStart()
    {
        if (state.phase != GamePhase.Running || finished || state.isHolding)
        {
            return false;
        }

        var mutated = new RuntimeState(
            state.phase,
            state.elapsedMs,
            state.introElapsedMs,
            Mathf.Clamp(state.pressure - config.pressureReleasePerSec * 0.15f, 0f, config.pressureMax),
            Mathf.Clamp(state.smellLevel + 8f, 0f, 100f),
            Mathf.Clamp(state.soundLevel + 12f, 0f, 100f),
            true,
            state.currentFloor,
            state.targetFloor,
            state.runSeed
        );
        state = mutated;
        return true;
    }

    public void OnHoldEnd()
    {
        if (!state.isHolding)
        {
            return;
        }

        state = new RuntimeState(
            state.phase,
            state.elapsedMs,
            state.introElapsedMs,
            state.pressure,
            state.smellLevel,
            state.soundLevel,
            false,
            state.currentFloor,
            state.targetFloor,
            state.runSeed
        );
    }

    public IReadOnlyList<RuntimeEvent> Update(float dtMs)
    {
        eventBuffer.Clear();

        if (state.phase == GamePhase.Intro)
        {
            var nextIntroMs = state.introElapsedMs + dtMs;
            if (nextIntroMs >= config.introDurationMs)
            {
                eventBuffer.Add(new RuntimeEvent(RuntimeEventType.IntroComplete));
            }
            state = new RuntimeState(
                state.phase,
                state.elapsedMs,
                nextIntroMs,
                state.pressure,
                state.smellLevel,
                state.soundLevel,
                state.isHolding,
                state.currentFloor,
                state.targetFloor,
                state.runSeed
            );
            return eventBuffer;
        }

        if (state.phase != GamePhase.Running || finished)
        {
            return eventBuffer;
        }

        var dt = dtMs / 1000f;
        var previousPressure = state.pressure;
        var elapsedMs = state.elapsedMs + dtMs;
        var nextPressure = state.pressure;
        var nextSmell = state.smellLevel;
        var nextSound = state.soundLevel;

        if (state.isHolding)
        {
            nextPressure = Mathf.Clamp(nextPressure - config.pressureReleasePerSec * dt, 0f, config.pressureMax);
            nextSmell = Mathf.Clamp(nextSmell + 35f * dt, 0f, 100f);
            nextSound = Mathf.Clamp(nextSound + 55f * dt, 0f, 100f);
        }
        else
        {
            nextPressure = Mathf.Clamp(nextPressure + config.pressureRisePerSec * dt, 0f, config.pressureMax);
            nextSmell = Mathf.Clamp(nextSmell - 18f * dt, 0f, 100f);
            nextSound = Mathf.Clamp(nextSound - 15f * dt, 0f, 100f);
        }

        nextSound = Mathf.Clamp(nextSound + nextPressure * 0.08f * dt, 0f, 100f);

        var currentFloor = Mathf.Clamp(
            Mathf.FloorToInt((elapsedMs / config.travelDurationMs) * config.targetFloor) + 1,
            1,
            config.targetFloor
        );

        state = new RuntimeState(
            state.phase,
            elapsedMs,
            state.introElapsedMs,
            nextPressure,
            nextSmell,
            nextSound,
            state.isHolding,
            currentFloor,
            state.targetFloor,
            state.runSeed
        );

        if (!warningGiven && previousPressure < config.warnThreshold && nextPressure >= config.warnThreshold)
        {
            warningGiven = true;
            eventBuffer.Add(new RuntimeEvent(RuntimeEventType.Warn));
        }

        if (!dangerGiven && previousPressure < config.dangerThreshold && nextPressure >= config.dangerThreshold)
        {
            dangerGiven = true;
            eventBuffer.Add(new RuntimeEvent(RuntimeEventType.Danger));
        }

        if (nextPressure >= config.pressureMax)
        {
            Fail();
            eventBuffer.Add(new RuntimeEvent(RuntimeEventType.Fail));
            return eventBuffer;
        }

        if (state.elapsedMs >= config.travelDurationMs)
        {
            Success();
            eventBuffer.Add(new RuntimeEvent(RuntimeEventType.Success));
        }

        return eventBuffer;
    }

    public RiskLevel RiskFromPressure()
    {
        if (state.pressure >= config.dangerThreshold)
        {
            return RiskLevel.Danger;
        }

        if (state.pressure >= config.warnThreshold)
        {
            return RiskLevel.Warn;
        }

        return RiskLevel.Stable;
    }

    public string TryToStateJson()
    {
        return JsonUtility.ToJson(new DebugStateSnapshot(this), false);
    }

    private void Success()
    {
        finished = true;
        state = new RuntimeState(
            GamePhase.Success,
            state.elapsedMs,
            state.introElapsedMs,
            state.pressure,
            state.smellLevel,
            state.soundLevel,
            false,
            state.currentFloor,
            state.targetFloor,
            state.runSeed
        );
    }

    private void Fail()
    {
        finished = true;
        state = new RuntimeState(
            GamePhase.Fail,
            state.elapsedMs,
            state.introElapsedMs,
            config.pressureMax,
            state.smellLevel,
            state.soundLevel,
            false,
            state.currentFloor,
            state.targetFloor,
            state.runSeed
        );
    }

    private RuntimeState CreateInitialState()
    {
        return new RuntimeState(
            GamePhase.Intro,
            0f,
            0f,
            14f,
            0f,
            0f,
            false,
            1,
            Mathf.Max(1, config.targetFloor),
            0L
        );
    }

    [Serializable]
    private sealed class DebugStateSnapshot
    {
        public string engine = "unity";
        public string phase;
        public int floor;
        public int targetFloor;
        public float elapsedMs;
        public float remainingMs;
        public float pressure;
        public float smellLevel;
        public float soundLevel;
        public RiskLevel risk;
        public bool isHolding;

        public DebugStateSnapshot(ElevatorRuntime runtime)
        {
            var s = runtime.state;
            phase = s.phase.ToString().ToLowerInvariant();
            floor = s.currentFloor;
            targetFloor = s.targetFloor;
            elapsedMs = Mathf.Round(s.elapsedMs);
            remainingMs = Math.Max(0f, runtime.config.travelDurationMs - s.elapsedMs);
            pressure = Mathf.Round(s.pressure);
            smellLevel = Mathf.Round(s.smellLevel);
            soundLevel = Mathf.Round(s.soundLevel);
            risk = runtime.RiskFromPressure();
            isHolding = s.isHolding;
        }
    }
}
