using UnityEngine;

namespace Elevator
{
    [CreateAssetMenu(fileName = "ElevatorProjectConfig", menuName = "Elevator/Project Config")]
    public class ElevatorProjectConfig : ScriptableObject
    {
        [Header("Resolution")] 
        public int referenceWidth = 540;
        public int referenceHeight = 960;
        public float targetAspect = 9f / 16f;
        public int targetFrameRate = 60;
        public bool forcePortrait = true;

        [Header("Runtime Default")] 
        public int targetFloor = 10;
        public int travelDurationMs = 25000;
        public float pressureMax = 100f;
        public float pressureRisePerSec = 8f;
        public float pressureReleasePerSec = 20f;
        public float warnThreshold = 70f;
        public float dangerThreshold = 90f;
        public int npcCount = 3;
    }
}