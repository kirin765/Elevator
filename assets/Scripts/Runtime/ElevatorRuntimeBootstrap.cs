using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace Elevator.Runtime
{
    [DisallowMultipleComponent]
    [DefaultExecutionOrder(-1000)]
    public sealed class ElevatorRuntimeBootstrap : MonoBehaviour
    {
        [SerializeField]
        private Elevator.ElevatorProjectConfig config;

        [SerializeField]
        private Camera worldCamera;

        [SerializeField]
        private bool forceSceneBootstrap = true;

        public static ElevatorRuntimeBootstrap Instance { get; private set; }

        public event Action<ElevatorInputState> InputStateChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            if (config == null)
            {
                config = LoadDefaultConfig();
            }

            Application.targetFrameRate = config.targetFrameRate;

            if (forceSceneBootstrap)
            {
                BuildScene();
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoBootstrap()
        {
            if (Application.isPlaying && UnityEngine.Object.FindFirstObjectByType<ElevatorRuntimeBootstrap>() == null)
            {
                var root = new GameObject("RuntimeBootstrap");
                root.AddComponent<ElevatorRuntimeBootstrap>();
            }
        }

        private void BuildScene()
        {
            EnsureRootObjects();
            BuildCanvas();
        }

        private void EnsureRootObjects()
        {
            var gameRoot = GameObject.Find("GameRoot");
            if (gameRoot == null)
            {
                gameRoot = new GameObject("GameRoot");
            }

            if (worldCamera == null)
            {
                var cam = GameObject.FindWithTag("MainCamera");
                if (cam == null)
                {
                    cam = new GameObject("Main Camera");
                    cam.tag = "MainCamera";
                    var cameraComponent = cam.AddComponent<Camera>();
                    cameraComponent.orthographic = true;
                    cameraComponent.orthographicSize = 3.2f;
                    cam.transform.position = new Vector3(0f, 0f, -10f);
                    cam.transform.SetParent(gameRoot.transform, false);
                    worldCamera = cameraComponent;
                }
                else
                {
                    worldCamera = cam.GetComponent<Camera>();
                    if (worldCamera == null)
                    {
                        worldCamera = cam.AddComponent<Camera>();
                    }

                    cam.transform.SetParent(gameRoot.transform, false);
                }

                worldCamera.backgroundColor = Color.black;
                worldCamera.clearFlags = CameraClearFlags.SolidColor;
                worldCamera.orthographic = true;
            }

            var rootTransform = gameRoot.transform;

            if (GameObject.Find("InputRouter") == null)
            {
                var router = new GameObject("InputRouter");
                router.AddComponent<Inputs.ElevatorInputRouter>();
                DontDestroyOnLoad(router);
                router.transform.SetParent(rootTransform, false);
            }

            var uiRoot = GameObject.Find("UIRoot");
            if (uiRoot == null)
            {
                uiRoot = new GameObject("UIRoot");
                uiRoot.transform.SetParent(rootTransform, false);
            }
            uiRoot.layer = LayerMask.NameToLayer("UI");
        }

        private void BuildCanvas()
        {
            var uiRoot = GameObject.Find("UIRoot");
            if (uiRoot == null)
            {
                return;
            }

            var canvas = uiRoot.GetComponentInChildren<Canvas>(true);
            if (canvas == null)
            {
                var canvasObj = new GameObject("Canvas");
                canvasObj.transform.SetParent(uiRoot.transform, false);
                canvas = canvasObj.AddComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                canvas.pixelPerfect = false;

                var scaler = canvasObj.AddComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(config.referenceWidth, config.referenceHeight);
                scaler.matchWidthOrHeight = 1f;

                canvasObj.AddComponent<GraphicRaycaster>();

                if (UnityEngine.Object.FindFirstObjectByType<EventSystem>() == null)
                {
                    CreateEventSystem();
                }
            }

            if (canvas.GetComponent<SafeAreaAdapter>() == null)
            {
                canvas.gameObject.AddComponent<SafeAreaAdapter>();
            }

            BuildUiSkeleton(canvas.transform as RectTransform);
        }

        private static void BuildUiSkeleton(RectTransform canvasTransform)
        {
            if (canvasTransform == null)
            {
                return;
            }

            var existingHud = canvasTransform.Find("HudRoot");
            if (existingHud != null)
            {
                return;
            }

            var hud = new GameObject("HudRoot");
            var hudRect = hud.AddComponent<RectTransform>();
            hudRect.SetParent(canvasTransform, false);
            hudRect.anchorMin = new Vector2(0f, 0f);
            hudRect.anchorMax = new Vector2(1f, 1f);
            hudRect.offsetMin = Vector2.zero;
            hudRect.offsetMax = Vector2.zero;

            var title = new GameObject("TopArea");
            var titleRect = title.AddComponent<RectTransform>();
            titleRect.SetParent(hudRect, false);
            titleRect.anchorMin = new Vector2(0f, 1f);
            titleRect.anchorMax = new Vector2(1f, 1f);
            titleRect.pivot = new Vector2(0.5f, 1f);
            titleRect.anchoredPosition = new Vector2(0f, -40f);
            titleRect.sizeDelta = new Vector2(0f, 80f);

            var titleImage = title.AddComponent<Image>();
            titleImage.color = new Color(0f, 0f, 0f, 0.35f);

            var buttonRoot = new GameObject("BottomControls");
            var buttonRect = buttonRoot.AddComponent<RectTransform>();
            buttonRect.SetParent(hudRect, false);
            buttonRect.anchorMin = new Vector2(0.5f, 0f);
            buttonRect.anchorMax = new Vector2(0.5f, 0f);
            buttonRect.pivot = new Vector2(0.5f, 0f);
            buttonRect.anchoredPosition = new Vector2(0f, 40f);
            buttonRect.sizeDelta = new Vector2(260f, 120f);

            var buttonBg = buttonRoot.AddComponent<Image>();
            buttonBg.color = new Color(0f, 0f, 0f, 0.35f);
        }

        private static void CreateEventSystem()
        {
            var root = new GameObject("EventSystem");
            root.AddComponent<EventSystem>();
            root.AddComponent<InputSystemUIInputModule>();

            var legacyModule = UnityEngine.Object.FindObjectOfType<StandaloneInputModule>();
            if (legacyModule != null)
            {
                UnityEngine.Object.Destroy(legacyModule.gameObject);
            }
        }

        private static Elevator.ElevatorProjectConfig LoadDefaultConfig()
        {
            var loadedConfig = Resources.Load<Elevator.ElevatorProjectConfig>("ElevatorProjectConfig");
            if (loadedConfig == null)
            {
                Debug.LogWarning(
                    "[ElevatorRuntimeBootstrap] Missing Resources/ElevatorProjectConfig. Creating a runtime fallback.");
            }

            return loadedConfig != null
                ? loadedConfig
                : ScriptableObject.CreateInstance<Elevator.ElevatorProjectConfig>();
        }
    }

    [Serializable]
    public struct ElevatorInputState
    {
        public Vector2 PointerPosition;
        public bool Holding;
    }

    [DisallowMultipleComponent]
    public sealed class SafeAreaAdapter : MonoBehaviour
    {
        private RectTransform target;

        private void Awake()
        {
            target = GetComponent<RectTransform>() ?? gameObject.AddComponent<RectTransform>();
            Apply();
        }

        private void Update()
        {
            Apply();
        }

        private void Apply()
        {
            var safeArea = Screen.safeArea;
            if (target == null || safeArea.width <= 0f || safeArea.height <= 0f)
            {
                return;
            }

            var xMin = safeArea.xMin / Screen.width;
            var yMin = safeArea.yMin / Screen.height;
            var xMax = safeArea.xMax / Screen.width;
            var yMax = safeArea.yMax / Screen.height;

            target.anchorMin = new Vector2(xMin, yMin);
            target.anchorMax = new Vector2(xMax, yMax);
            target.offsetMin = Vector2.zero;
            target.offsetMax = Vector2.zero;
        }
    }
}
