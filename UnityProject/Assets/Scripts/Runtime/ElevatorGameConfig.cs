using UnityEngine;

[CreateAssetMenu(fileName = "ElevatorGameConfig", menuName = "Elevator/Game Config")]
public class ElevatorGameConfig : ScriptableObject
{
    public int targetFloor = 10;
    public float travelDurationMs = 25000f;
    public float introDurationMs = 3000f;
    public float pressureMax = 100f;
    public float pressureRisePerSec = 8f;
    public float pressureReleasePerSec = 20f;
    public float warnThreshold = 70f;
    public float dangerThreshold = 90f;
    public int npcCount = 3;
    public float characterScale = 1f;
    public Vector2 referenceResolution = new Vector2(540f, 960f);
    public string uiFontName = "Arial";

    [System.Serializable]
    public class ReactionProfile
    {
        public int[] warnVibration = { 60 };
        public int[] dangerVibration = { 80, 70, 80 };
        public int[] failVibration = { 150, 70, 170, 70, 230 };
        public int[] successVibration = { 30, 40, 30, 40, 30 };
    }

    public ReactionProfile reactionProfile = new ReactionProfile();

    public static ElevatorGameConfig CreateDefault()
    {
        return CreateInstance<ElevatorGameConfig>();
    }
}
