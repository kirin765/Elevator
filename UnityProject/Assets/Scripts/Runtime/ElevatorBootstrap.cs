using UnityEngine;

[DefaultExecutionOrder(-200)]
public class ElevatorBootstrap : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void Bootstrap()
    {
        if (Object.FindObjectOfType<ElevatorGameController>() != null)
        {
            EnsureDebugBridge();
            return;
        }

        var root = new GameObject("GameRoot");
        root.AddComponent<ElevatorGameController>();
        EnsureDebugBridge(root);
        Object.DontDestroyOnLoad(root);
    }

    private static void EnsureDebugBridge(GameObject root = null)
    {
        if (Object.FindObjectOfType<ElevatorDebugBridge>() != null)
        {
            return;
        }

        var target = root;
        if (target == null)
        {
            var existing = Object.FindObjectOfType<ElevatorGameController>();
            if (existing != null)
            {
                target = existing.gameObject;
            }
        }

        if (target == null)
        {
            target = new GameObject("ElevatorDebugBridge");
        }

        target.AddComponent<ElevatorDebugBridge>();
    }
}

