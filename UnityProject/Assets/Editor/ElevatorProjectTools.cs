#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class ElevatorProjectTools
{
    [MenuItem("Elevator/Create Main Scene")]
    public static void CreateMainScene()
    {
        var path = "Assets/Scenes/Main.unity";
        if (!Directory.Exists("Assets/Scenes"))
        {
            Directory.CreateDirectory("Assets/Scenes");
        }

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
        var root = new GameObject("GameRoot");
        root.AddComponent<ElevatorGameController>();
        root.AddComponent<ElevatorDebugBridge>();

        EditorSceneManager.SaveScene(scene, path);
        AssetDatabase.Refresh();
        EditorUtility.DisplayDialog("Elevator", $"Main scene saved: {path}", "OK");
    }

    [MenuItem("Elevator/Create Game Config Asset")]
    public static void CreateGameConfigAsset()
    {
        var path = "Assets/Runtime/ElevatorGameConfig.asset";
        if (!Directory.Exists("Assets/Runtime"))
        {
            Directory.CreateDirectory("Assets/Runtime");
        }

        if (File.Exists(path))
        {
            EditorUtility.DisplayDialog("Elevator", "Config asset already exists.", "OK");
            return;
        }

        var config = ScriptableObject.CreateInstance<ElevatorGameConfig>();
        AssetDatabase.CreateAsset(config, path);
        AssetDatabase.SaveAssets();
        EditorUtility.FocusProjectWindow();
        Selection.activeObject = AssetDatabase.LoadMainAssetAtPath(path);
        EditorUtility.DisplayDialog("Elevator", $"Created config asset: {path}", "OK");
    }
}
#endif
