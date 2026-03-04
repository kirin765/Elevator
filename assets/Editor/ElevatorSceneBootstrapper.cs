#if UNITY_EDITOR
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Elevator.EditorTools
{
    public static class ElevatorSceneBootstrapper
    {
        private const string ScenePath = "Assets/Scenes/Main.unity";
        private const string SceneName = "Main";
        private const string ConfigPath = "Assets/Resources/ElevatorProjectConfig.asset";
        private const float RefWidth = 540f;
        private const float RefHeight = 960f;

        [InitializeOnLoadMethod]
        private static void EnsureMainScene()
        {
            if (!AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath))
            {
                CreateMainSceneCore(false);
            }
            else
            {
                ValidateMainScene();
            }

            EnsureSceneInBuildSettings();
        }

        [MenuItem("Tools/Elevator/Create Main Scene")]
        public static void CreateMainScene()
        {
            CreateMainSceneCore(true);
            EnsureSceneInBuildSettings();
        }

        [MenuItem("Tools/Elevator/Rebuild Main Scene")]
        public static void RebuildMainScene()
        {
            if (System.IO.File.Exists(ScenePath))
            {
                AssetDatabase.DeleteAsset(ScenePath);
            }

            CreateMainSceneCore(true);
            EnsureSceneInBuildSettings();
        }

        [MenuItem("Tools/Elevator/Validate Main Scene")]
        public static void ValidateMainScene()
        {
            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
            if (scene == null)
            {
                Debug.LogError("[ElevatorSceneBootstrapper] Main scene is missing. Run Tools/Elevator/Create Main Scene");
                return;
            }

            if (!HasRequiredRootObjects())
            {
                Debug.LogWarning("[ElevatorSceneBootstrapper] Main scene missing required roots. Regenerating skeleton.");
                CreateMainSceneCore(true);
                return;
            }

            if (!System.IO.File.Exists(ConfigPath))
            {
                Debug.LogWarning("[ElevatorSceneBootstrapper] Expected config asset is not present. Creating Assets/Resources/ElevatorProjectConfig.asset.");
            }

            Debug.Log("[ElevatorSceneBootstrapper] Main scene is valid.");
        }

        private static void CreateMainSceneCore(bool openResultScene)
        {
            var previousScene = SceneManager.GetActiveScene();
            try
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                scene.name = SceneName;

                var gameRoot = new GameObject("GameRoot");
                gameRoot.tag = "Untagged";

                var camera = CreateOrGetCamera(gameRoot.transform);
                if (camera != null)
                {
                    camera.transform.SetParent(gameRoot.transform, false);
                }

                var inputRouter = new GameObject("InputRouter");
                inputRouter.AddComponent<Elevator.Inputs.ElevatorInputRouter>();
                inputRouter.transform.SetParent(gameRoot.transform, false);

                var uiRoot = new GameObject("UIRoot");
                uiRoot.transform.SetParent(gameRoot.transform, false);

                var canvasObj = new GameObject("Canvas");
                canvasObj.transform.SetParent(uiRoot.transform, false);
                var canvas = canvasObj.AddComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                canvas.pixelPerfect = false;

                var scaler = canvasObj.AddComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(RefWidth, RefHeight);
                scaler.matchWidthOrHeight = 1f;

                canvasObj.AddComponent<GraphicRaycaster>();

                if (Object.FindFirstObjectByType<EventSystem>() == null)
                {
                    var eventRoot = new GameObject("EventSystem");
                    eventRoot.AddComponent<EventSystem>();
                    eventRoot.AddComponent<InputSystemUIInputModule>();
                    eventRoot.transform.SetParent(uiRoot.transform, false);
                }

                if (Object.FindFirstObjectByType<Elevator.Runtime.ElevatorRuntimeBootstrap>() == null)
                {
                    var runtime = new GameObject("RuntimeBootstrap");
                    runtime.AddComponent<Elevator.Runtime.ElevatorRuntimeBootstrap>();
                    runtime.transform.SetParent(gameRoot.transform, false);
                }

                EditorSceneManager.SaveScene(scene, ScenePath, false);
                EditorSceneManager.MarkSceneDirty(scene);
            }
            finally
            {
                EnsureRuntimeConfig();
                AssetDatabase.Refresh();
                if (openResultScene)
                {
                    EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
                }
                else if (previousScene.IsValid())
                {
                    EditorSceneManager.OpenScene(previousScene.path, OpenSceneMode.Single);
                }
            }
        }

        private static Camera CreateOrGetCamera(Transform parent)
        {
            var found = GameObject.Find("Main Camera");
            if (found != null)
            {
                var foundCamera = found.GetComponent<Camera>() ?? found.AddComponent<Camera>();
                found.transform.SetParent(parent, false);
                return foundCamera;
            }

            var cameraObj = new GameObject("Main Camera");
            cameraObj.tag = "MainCamera";
            cameraObj.transform.position = new Vector3(0f, 0f, -10f);
            var camera = cameraObj.AddComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 3.2f;
            camera.backgroundColor = Color.black;
            camera.clearFlags = CameraClearFlags.SolidColor;
            cameraObj.transform.SetParent(parent, false);
            return camera;
        }

        private static bool HasRequiredRootObjects()
        {
            var scene = EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            if (!scene.IsValid())
            {
                return false;
            }

            var hasGameRoot = GameObject.Find("GameRoot") != null;
            var hasCamera = GameObject.Find("Main Camera") != null;
            var hasInputRouter = GameObject.Find("InputRouter") != null;
            var hasUIRoot = GameObject.Find("UIRoot") != null;

            return hasGameRoot && hasCamera && hasInputRouter && hasUIRoot;
        }

        private static void EnsureRuntimeConfig()
        {
            if (System.IO.File.Exists(ConfigPath))
            {
                return;
            }

            var config = ScriptableObject.CreateInstance<Elevator.ElevatorProjectConfig>();
            UnityEditor.AssetDatabase.CreateAsset(config, ConfigPath);
        }

        private static void EnsureSceneInBuildSettings()
        {
            var scenes = EditorBuildSettings.scenes.ToList();
            if (!scenes.Exists(s => s.path == ScenePath))
            {
                scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
                EditorBuildSettings.scenes = scenes.ToArray();
            }
        }
    }
}
#endif
