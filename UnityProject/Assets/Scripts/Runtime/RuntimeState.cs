using System;

public enum GamePhase
{
    Intro,
    Running,
    Success,
    Fail,
}

public enum RiskLevel
{
    Stable,
    Warn,
    Danger,
}

public enum RuntimeEventType
{
    IntroComplete,
    Warn,
    Danger,
    Success,
    Fail,
}

[Serializable]
public readonly struct RuntimeState
{
    public readonly GamePhase phase;
    public readonly float elapsedMs;
    public readonly float introElapsedMs;
    public readonly float pressure;
    public readonly float smellLevel;
    public readonly float soundLevel;
    public readonly bool isHolding;
    public readonly int currentFloor;
    public readonly int targetFloor;
    public readonly long runSeed;

    public RuntimeState(
        GamePhase phase,
        float elapsedMs,
        float introElapsedMs,
        float pressure,
        float smellLevel,
        float soundLevel,
        bool isHolding,
        int currentFloor,
        int targetFloor,
        long runSeed)
    {
        this.phase = phase;
        this.elapsedMs = elapsedMs;
        this.introElapsedMs = introElapsedMs;
        this.pressure = pressure;
        this.smellLevel = smellLevel;
        this.soundLevel = soundLevel;
        this.isHolding = isHolding;
        this.currentFloor = currentFloor;
        this.targetFloor = targetFloor;
        this.runSeed = runSeed;
    }
}

[Serializable]
public readonly struct RuntimeEvent
{
    public readonly RuntimeEventType type;

    public RuntimeEvent(RuntimeEventType type)
    {
        this.type = type;
    }
}
