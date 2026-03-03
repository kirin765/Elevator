using UnityEngine;

public class ElevatorDebugBridge : MonoBehaviour
{
    [SerializeField]
    private ElevatorGameController gameController;

    private static ElevatorDebugBridge instance;

    private void Awake()
    {
        instance = this;
        if (gameController == null)
        {
            gameController = FindObjectOfType<ElevatorGameController>();
        }
    }

    private void OnDestroy()
    {
        if (instance == this)
        {
            instance = null;
        }
    }

    public static string RenderGameToJson()
    {
        return instance?.gameController != null ? instance.gameController.RenderGameToJson() : "{}";
    }

    public static void AdvanceTime(float ms)
    {
        instance?.gameController?.AdvanceTime(Mathf.Max(0f, ms));
    }

    public string RenderGameToJsonRequest()
    {
        return RenderGameToJson();
    }

    public string RenderGameToText()
    {
        return RenderGameToJson();
    }

    public string RenderGameToTextRequest()
    {
        return RenderGameToJson();
    }

    public void AdvanceTimeRequest(string ms)
    {
        if (float.TryParse(ms, out var value))
        {
            AdvanceTime(value);
        }
    }
}
