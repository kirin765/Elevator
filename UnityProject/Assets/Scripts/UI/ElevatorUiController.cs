using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public class ElevatorUiController : MonoBehaviour
{
    public event Action HoldStarted;
    public event Action HoldEnded;
    public event Action RestartRequested;

    private const int VerticalSpacing = 6;

    private Canvas canvas;
    private CanvasScaler scaler;
    private Text floorText;
    private Text riskText;
    private Text introText;
    private Text introCountdownText;
    private Text holdButtonText;
    private Text resultTitleText;
    private Text resultMessageText;
    private Text orbText;
    private Image orbImage;
    private Image pressureFill;
    private Image smellFill;
    private Image soundFill;
    private Button holdButton;
    private Button restartButton;
    private GameObject startOverlay;
    private GameObject resultOverlay;

    [SerializeField]
    private ElevatorGameConfig config;
    private string fontName;

    public void Initialize(ElevatorGameConfig gameConfig)
    {
        config = gameConfig != null ? gameConfig : config;
        fontName = config != null && !string.IsNullOrWhiteSpace(config.uiFontName) ? config.uiFontName : "Arial";
        if (canvas == null)
        {
            BuildLayout();
        }
    }

    public void SetFloor(int floor, int target)
    {
        if (floorText != null)
        {
            floorText.text = $"{floor} / {target}";
        }
    }

    public void SetBars(float pressure, float smell, float sound)
    {
        if (pressureFill != null)
        {
            pressureFill.fillAmount = Mathf.Clamp01(pressure / 100f);
        }
        if (smellFill != null)
        {
            smellFill.fillAmount = Mathf.Clamp01(smell / 100f);
        }
        if (soundFill != null)
        {
            soundFill.fillAmount = Mathf.Clamp01(sound / 100f);
        }
    }

    public void SetRisk(RiskLevel risk)
    {
        if (riskText != null)
        {
            riskText.text = risk.ToString();
        }

        if (orbText != null)
        {
            orbText.text = risk == RiskLevel.Stable ? "STABLE" : risk == RiskLevel.Warn ? "WARN" : "DANGER";
        }

        if (orbImage != null)
        {
            orbImage.color = risk switch
            {
                RiskLevel.Warn => new Color(1f, 0.75f, 0.2f),
                RiskLevel.Danger => new Color(1f, 0.2f, 0.2f),
                _ => new Color(0.2f, 0.75f, 1f),
            };
        }
    }

    public void SetIntroVisible(bool visible)
    {
        if (startOverlay != null)
        {
            startOverlay.SetActive(visible);
        }
    }

    public void SetIntroCountdown(int seconds)
    {
        if (introCountdownText != null)
        {
            introCountdownText.text = seconds.ToString();
        }
    }

    public void SetHoldState(bool active)
    {
        if (holdButtonText != null)
        {
            holdButtonText.text = active ? "RELEASE" : "HOLD";
        }
    }

    public void SetResult(string title, string message)
    {
        if (resultOverlay == null || resultTitleText == null || resultMessageText == null)
        {
            return;
        }

        resultTitleText.text = title;
        resultMessageText.text = message;
        resultOverlay.SetActive(true);
    }

    public void SetResultVisible(bool visible)
    {
        if (resultOverlay != null)
        {
            resultOverlay.SetActive(visible);
        }
    }

    public void SetHoldButtonLabel(string label)
    {
        if (holdButtonText != null)
        {
            holdButtonText.text = label;
        }
    }

    public void ShowDebugSummary(string message)
    {
        if (orbText != null && !string.IsNullOrEmpty(message))
        {
            orbText.text = message;
        }
    }

    private void BuildLayout()
    {
        var root = gameObject;
        canvas = root.GetComponent<Canvas>() ?? root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        scaler = root.GetComponent<CanvasScaler>() ?? root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = config != null ? config.referenceResolution : new Vector2(540f, 960f);
        scaler.matchWidthOrHeight = 1f;

        root.AddComponent<GraphicRaycaster>();
        if (root.GetComponent<EventSystem>() == null)
        {
            var eventSystem = new GameObject("EventSystem")
            {
                hideFlags = HideFlags.NotEditable
            };
            eventSystem.AddComponent<EventSystem>();
            eventSystem.AddComponent<StandaloneInputModule>();
            eventSystem.transform.SetParent(root.transform);
        }

        var topPanel = CreatePanel("top", new Vector2(0.5f, 1f), new Vector2(0f, -40f), new Vector2(560f, 160f));
        floorText = CreateText(topPanel.transform, "floor", "0 / 10", new Vector2(-210f, -10f), 52);
        riskText = CreateText(topPanel.transform, "risk", "STABLE", new Vector2(120f, -10f), 36);

        var leftBar = CreateVerticalBar(topPanel.transform, "pressure", new Vector2(0f, -120f), 0f);
        pressureFill = leftBar;

        var midBar = CreateVerticalBar(topPanel.transform, "smell", new Vector2(60f, -120f), 0f);
        smellFill = midBar;

        var rightBar = CreateVerticalBar(topPanel.transform, "sound", new Vector2(120f, -120f), 0f);
        soundFill = rightBar;

        holdButton = CreateButton(root.transform, "Hold", new Vector2(0f, 90f), new Vector2(240f, 72f), OnHoldDown, OnHoldUp, OnHoldExit);
        holdButtonText = holdButton.GetComponentInChildren<Text>();

        introText = CreateText(root.transform, "introText", "READY", new Vector2(0f, 220f), 40);
        introCountdownText = CreateText(root.transform, "countdown", "3", new Vector2(0f, 180f), 52);
        startOverlay = new GameObject("StartOverlay", typeof(RectTransform));
        startOverlay.transform.SetParent(root.transform);
        var rt = startOverlay.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        var dark = startOverlay.AddComponent<Image>();
        dark.color = new Color(0f, 0f, 0f, 0.42f);

        restartButton = CreateButton(root.transform, "Restart", new Vector2(0f, 0f), new Vector2(220f, 64f), null, null, null, false);
        restartButton.onClick.AddListener(() => RestartRequested?.Invoke());
        var btnText = restartButton.GetComponentInChildren<Text>();
        if (btnText != null)
        {
            btnText.text = "RESTART";
        }

        resultOverlay = new GameObject("ResultOverlay", typeof(RectTransform));
        resultOverlay.transform.SetParent(root.transform);
        var resultRt = resultOverlay.GetComponent<RectTransform>();
        resultRt.anchorMin = Vector2.zero;
        resultRt.anchorMax = Vector2.one;
        resultRt.offsetMin = Vector2.zero;
        resultRt.offsetMax = Vector2.zero;
        var resultBg = resultOverlay.AddComponent<Image>();
        resultBg.color = new Color(0f, 0f, 0f, 0.52f);

        var panel = CreatePanel("resultPanel", new Vector2(0.5f, 0.52f), new Vector2(0f, -20f), new Vector2(640f, 280f), resultOverlay.transform);
        resultTitleText = CreateText(panel.transform, "resultTitle", "RESULT", new Vector2(0f, -40f), 60);
        resultMessageText = CreateText(panel.transform, "resultMsg", "Press Restart", new Vector2(0f, -120f), 36);
        var orb = CreatePanel("orb", new Vector2(0.5f, 0.82f), new Vector2(0f, 0f), new Vector2(80f, 80f), panel.transform);
        orbImage = orb.AddComponent<Image>();
        orbImage.color = Color.cyan;
        orbText = CreateText(orb.transform, "orbText", "STABLE", Vector2.zero, 20);
        orbText.alignment = TextAnchor.MiddleCenter;

        SetIntroVisible(false);
        SetResultVisible(false);
        SetHoldButtonLabel("HOLD");
    }

    private static Text CreateText(Transform parent, string name, string content, Vector2 anchoredPosition, int fontSize)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        var rect = go.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(260f, 40f);
        rect.anchoredPosition = anchoredPosition;
        rect.localScale = Vector3.one;

        var text = go.AddComponent<Text>();
        text.text = content;
        text.font = ResolveFont();
        if (text.font == null)
        {
            Debug.LogWarning("[ElevatorUi] Built-in font not found; using default fallback.");
        }

        text.fontSize = fontSize;
        text.color = Color.white;
        text.alignment = TextAnchor.MiddleLeft;
        text.raycastTarget = false;
        return text;
    }

    private Font ResolveFont()
    {
        if (!string.IsNullOrWhiteSpace(fontName))
        {
            var fromResources = Resources.Load<Font>(fontName);
            if (fromResources != null)
            {
                return fromResources;
            }
        }

        return Resources.GetBuiltinResource<Font>("Arial.ttf")
            ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
    }

    private static GameObject CreatePanel(string name, Vector2 anchor, Vector2 position, Vector2 size, Transform parent = null)
    {
        var panel = new GameObject(name, typeof(RectTransform), typeof(Image));
        if (parent != null)
        {
            panel.transform.SetParent(parent, false);
        }

        var rect = panel.GetComponent<RectTransform>();
        rect.anchorMin = anchor;
        rect.anchorMax = anchor;
        rect.sizeDelta = size;
        rect.anchoredPosition = position;
        panel.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
        return panel;
    }

    private Image CreateVerticalBar(Transform parent, string name, Vector2 anchored, float value)
    {
        var holder = new GameObject(name + "Bar", typeof(RectTransform), typeof(Image));
        holder.transform.SetParent(parent, false);
        var rect = holder.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(140f, 16f);
        rect.anchoredPosition = anchored;

        var holderImage = holder.GetComponent<Image>();
        holderImage.color = new Color(0f, 0f, 0f, 0.45f);
        var fill = new GameObject("Fill", typeof(RectTransform), typeof(Image));
        fill.transform.SetParent(holder.transform, false);
        var fillRect = fill.GetComponent<RectTransform>();
        fillRect.anchorMin = Vector2.zero;
        fillRect.anchorMax = new Vector2(value, 1f);
        fillRect.sizeDelta = Vector2.zero;
        fillRect.offsetMax = Vector2.zero;
        fillRect.offsetMin = Vector2.zero;
        var fillImage = fill.GetComponent<Image>();
        fillImage.color = new Color(0.1f, 0.75f, 1f, 0.95f);
        fillImage.type = Image.Type.Filled;
        fillImage.fillMethod = Image.FillMethod.Horizontal;
        fillImage.fillOrigin = (int)Image.OriginHorizontal.Left;
        fillImage.fillAmount = 0f;
        return fillImage;
    }

    private Button CreateButton(
        Transform parent,
        string text,
        Vector2 anchoredPosition,
        Vector2 size,
        Action pointerDown,
        Action pointerUp,
        Action pointerExit,
        bool addHoldHandlers = true)
    {
        var go = new GameObject("UIButton", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        var rect = go.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0.5f, 0f);
        rect.anchorMax = new Vector2(0.5f, 0f);
        rect.sizeDelta = size;
        rect.anchoredPosition = anchoredPosition;
        var image = go.GetComponent<Image>();
        image.color = new Color(0.12f, 0.12f, 0.12f, 0.95f);
        image.raycastTarget = true;

        var button = go.GetComponent<Button>();
        var t = CreateText(go.transform, "Label", text, Vector2.zero, 34);
        t.alignment = TextAnchor.MiddleCenter;

        if (addHoldHandlers)
        {
            var proxy = go.AddComponent<PointerProxy>();
            proxy.onDown = pointerDown;
            proxy.onUp = pointerUp;
            proxy.onExit = pointerExit;
        }
        else if (pointerDown != null)
        {
            button.onClick.AddListener(() => pointerDown?.Invoke());
        }

        return button;
    }

    private class PointerProxy : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public Action onDown;
        public Action onUp;
        public Action onExit;

        public void OnPointerDown(PointerEventData eventData)
        {
            onDown?.Invoke();
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            onUp?.Invoke();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            onExit?.Invoke();
        }
    }

    private void OnHoldDown()
    {
        HoldStarted?.Invoke();
    }

    private void OnHoldUp()
    {
        HoldEnded?.Invoke();
    }

    private void OnHoldExit()
    {
        HoldEnded?.Invoke();
    }
}
