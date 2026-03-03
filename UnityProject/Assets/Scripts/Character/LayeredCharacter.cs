using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

[DisallowMultipleComponent]
public class LayeredCharacter : MonoBehaviour
{
    private const float PixelToWorld = 0.01f;
    private const int DefaultPixelsPerUnit = 100;
    private const int PlaceholderSize = 32;

    private static readonly Dictionary<string, Sprite> SpriteCache = new();
    private static Sprite placeholderSprite;

    private readonly Dictionary<string, SpriteRenderer> partRenderers = new();
    private readonly Dictionary<string, string> missingReasons = new();
    private readonly HashSet<string> loggedMissing = new();

    private ElevatorGameConfig config;
    private CharacterModel model;
    private Vector3 baseTopLeftWorld;
    private CharacterMood currentMood = CharacterMood.Stable;
    private bool initialized;
    private string roleName = "hero";

    [SerializeField]
    private float widthPx = CharacterLayout.HeroWidth;

    [SerializeField]
    private float heightPx = CharacterLayout.HeroHeight;

    public string Role => roleName;
    public CharacterModel Model => model;
    public CharacterMood Mood => currentMood;

    public Vector3 BaseTopLeftWorld
    {
        get => baseTopLeftWorld;
        set
        {
            baseTopLeftWorld = value;
            transform.position = value;
        }
    }

    public void SetVisible(bool visible)
    {
        if (gameObject.activeSelf != visible)
        {
            gameObject.SetActive(visible);
        }
    }

    public void Initialize(
        string role,
        float characterWidthPx,
        float characterHeightPx,
        CharacterModel initialModel,
        CharacterMood mood,
        ElevatorGameConfig gameConfig)
    {
        roleName = role ?? "hero";
        widthPx = Math.Max(1f, characterWidthPx);
        heightPx = Math.Max(1f, characterHeightPx);
        currentMood = mood;
        config = gameConfig;
        initialized = true;

        EnsureParts();
        SetModel(initialModel, mood);
    }

    public void SetModel(CharacterModel characterModel, CharacterMood mood)
    {
        currentMood = mood;
        model = CharacterModelFactory.NormalizeModel(characterModel);
        if (!initialized)
        {
            return;
        }

        foreach (var partName in CharacterLayout.PartOrder)
        {
            if (!partRenderers.TryGetValue(partName, out var partRenderer))
            {
                continue;
            }

            var paths = ResolvePartPath(partName, model, mood);
            var sprite = ResolveSprite(paths.path) ?? ResolveSprite(paths.fallbackPath);
            if (sprite == null)
            {
                ApplyMissingPart(partName, partRenderer, paths.category, paths.path);
            }
            else
            {
                ApplyPart(partName, partRenderer, sprite);
            }
        }

        ApplyFaceLayout();
    }

    public void ApplyShakeOffset(Vector3 offset, int index, float riskMultiplier)
    {
        var side = index % 2 == 0 ? -1f : 1f;
        transform.position = baseTopLeftWorld + new Vector3(offset.x * side * riskMultiplier, offset.y * riskMultiplier, offset.z);
    }

    public CharacterStats CollectStats()
    {
        var partsTotal = 0;
        var missing = 0;
        var missingFrames = new List<string>(8);

        foreach (var partName in CharacterLayout.PartOrder)
        {
            if (!partRenderers.TryGetValue(partName, out var partRenderer))
            {
                continue;
            }

            partsTotal += 1;
            if (partRenderer.sprite == null)
            {
                missing += 1;
                if (missingReasons.TryGetValue(partName, out var reason) && !missingFrames.Contains(reason))
                {
                    missingFrames.Add(reason);
                }
            }
        }

        return new CharacterStats(partsTotal, partsTotal - missing, missing, missingFrames);
    }

    private void EnsureParts()
    {
        if (partRenderers.Count > 0)
        {
            return;
        }

        for (var i = 0; i < CharacterLayout.PartOrder.Length; i += 1)
        {
            var partName = CharacterLayout.PartOrder[i];
            if (partRenderers.ContainsKey(partName))
            {
                continue;
            }

            var part = new GameObject(partName)
            {
                hideFlags = HideFlags.NotEditable
            };
            part.transform.SetParent(transform, false);

            var renderer = part.AddComponent<SpriteRenderer>();
            renderer.sortingLayerName = "Default";
            renderer.sortingOrder = ComputeSortingOrder(partName, i);
            partRenderers[partName] = renderer;
        }
    }

    private int ComputeSortingOrder(string partName, int fallback)
    {
        var skin = fallback + 10;
        if (partName.StartsWith("face-", StringComparison.Ordinal))
        {
            return skin + 80;
        }

        if (partName == "hair")
        {
            return skin + 90;
        }

        if (CharacterLayout.PartCategory.TryGetValue(partName, out var category))
        {
            if (category == "skin")
            {
                return skin + 10;
            }
            if (category == "shirts")
            {
                return skin + 40;
            }
            if (category == "pants")
            {
                return skin + 20;
            }
            if (category == "shoes")
            {
                return skin + 30;
            }
        }

        return skin + 50;
    }

    private void ApplyPart(string partName, SpriteRenderer renderer, Sprite sprite)
    {
        renderer.sprite = sprite;
        var layout = ResolveLayout(partName);
        ApplySlot(renderer, layout);
        ApplyScale(renderer, layout, partName);
        missingReasons.Remove(partName);
    }

    private void ApplyMissingPart(string partName, SpriteRenderer renderer, string category, string sourcePath)
    {
        if (string.IsNullOrEmpty(sourcePath))
        {
            sourcePath = "missing";
        }

        missingReasons[partName] = $"{category}:{sourcePath}";
        if (!loggedMissing.Contains($"{Role}:{partName}:{sourcePath}"))
        {
            loggedMissing.Add($"{Role}:{partName}:{sourcePath}");
            Debug.LogWarning($"[LayeredCharacter] Missing {roleName}/{partName} ({sourcePath})");
        }

        renderer.sprite = GetPlaceholder();
        ApplySlot(renderer, ResolveLayout(partName));
        ApplyScale(renderer, ResolveLayout(partName), partName);
    }

    private void ApplyFaceLayout()
    {
        if (!partRenderers.TryGetValue("skin-head", out var head))
        {
            return;
        }

        if (head.sprite == null)
        {
            return;
        }

        var headSlot = ResolveLayout("skin-head");

        ApplyDynamicFaceSlot("face-eyebrows", 0.18f, 0.24f, 0.64f, 0.12f, headSlot);
        ApplyDynamicFaceSlot("face-eyes-left", 0.22f, 0.38f, 0.22f, 0.16f, headSlot);
        ApplyDynamicFaceSlot("face-eyes-right", 0.56f, 0.38f, 0.22f, 0.16f, headSlot);
        ApplyDynamicFaceSlot("face-nose", 0.43f, 0.53f, 0.14f, 0.14f, headSlot);
        ApplyDynamicFaceSlot("face-mouth", 0.30f, 0.67f, 0.40f, 0.16f, headSlot);
    }

    private void ApplyDynamicFaceSlot(string partName, float x, float y, float w, float h, LayoutData head)
    {
        if (!partRenderers.TryGetValue(partName, out var renderer) || renderer == null)
        {
            return;
        }

        var slot = new LayoutData(
            head.x + head.w * x,
            head.y + head.h * y,
            head.w * w,
            head.h * h,
            head.sorting
        );
        ApplySlot(renderer, slot);
        ApplyScale(renderer, slot, partName);
    }

    private void ApplySlot(SpriteRenderer renderer, LayoutData slotPx)
    {
        var x = slotPx.x * PixelToWorld + slotPx.w * 0.5f * PixelToWorld;
        var y = -(slotPx.y * PixelToWorld + slotPx.h * 0.5f * PixelToWorld);
        renderer.transform.localPosition = new Vector3(x, y, renderer.transform.localPosition.z);
    }

    private void ApplyScale(SpriteRenderer renderer, LayoutData slotPx, string partName)
    {
        if (renderer.sprite == null)
        {
            renderer.transform.localScale = Vector3.zero;
            return;
        }

        var srcW = Math.Max(1f, renderer.sprite.rect.width);
        var srcH = Math.Max(1f, renderer.sprite.rect.height);
        var targetW = slotPx.w * PixelToWorld;
        var targetH = slotPx.h * PixelToWorld;
        var slotScale = Math.Min(targetW / (srcW / DefaultPixelsPerUnit), targetH / (srcH / DefaultPixelsPerUnit));
        var finalScale = slotScale * Math.Max(0.2f, config != null ? config.characterScale : 1f);
        if (finalScale <= 0f)
        {
            finalScale = 1f;
        }

        var mirrored = partName.EndsWith("-right", StringComparison.Ordinal);
        renderer.transform.localScale = new Vector3(mirrored ? -finalScale : finalScale, finalScale, 1f);
        if (partName.StartsWith("face-", StringComparison.Ordinal))
        {
            renderer.transform.localScale = new Vector3(Mathf.Abs(renderer.transform.localScale.x), Mathf.Abs(renderer.transform.localScale.y), 1f);
        }
    }

    private LayoutData ResolveLayout(string partName)
    {
        if (CharacterLayout.CharacterPartLayout.TryGetValue(partName, out var body))
        {
            return new LayoutData(
                body.x * widthPx,
                body.y * heightPx,
                body.w * widthPx,
                body.h * heightPx,
                body.sorting
            );
        }

        if (CharacterLayout.LimbLayout.TryGetValue(partName, out var limb))
        {
            return new LayoutData(
                limb.x * widthPx,
                limb.y * heightPx,
                limb.w * widthPx,
                limb.h * heightPx,
                limb.sorting
            );
        }

        return new LayoutData(0f, 0f, widthPx, heightPx, 0);
    }

    private (string path, string fallbackPath, string category) ResolvePartPath(string partName, CharacterModel model, CharacterMood mood)
    {
        return partName switch
        {
            "skin-head" => (BuildSkin("head", model.skinTint), BuildSkin("head", 1), "skin"),
            "skin-neck" => (BuildSkin("neck", model.skinTint), BuildSkin("neck", 1), "skin"),
            "skin-arm-left" => (BuildSkin("arm", model.skinTint), BuildSkin("arm", 1), "skin"),
            "skin-arm-right" => (BuildSkin("arm", model.skinTint), BuildSkin("arm", 1), "skin"),
            "hand-left" => (BuildSkin("hand", model.skinTint), BuildSkin("hand", 1), "skin"),
            "hand-right" => (BuildSkin("hand", model.skinTint), BuildSkin("hand", 1), "skin"),
            "skin-leg-left" => (BuildSkin("leg", model.skinTint), BuildSkin("leg", 1), "skin"),
            "skin-leg-right" => (BuildSkin("leg", model.skinTint), BuildSkin("leg", 1), "skin"),
            "shoe-left" => (BuildShoes(model.shoes.color, model.shoes.style), BuildShoes("Black", 1), "shoes"),
            "shoe-right" => (BuildShoes(model.shoes.color, model.shoes.style), BuildShoes("Black", 1), "shoes"),
            "shirt-arm-left" => (BuildShirtArm(model.shirt.color, model.shirt.style), BuildShirtArm("Blue", 1), "shirts"),
            "shirt-arm-right" => (BuildShirtArm(model.shirt.color, model.shirt.style), BuildShirtArm("Blue", 1), "shirts"),
            "shirt" => (BuildShirt(model.shirt.color, model.shirt.style), BuildShirt("Blue", 1), "shirts"),
            "pants" => (BuildPants(model.pants.color, model.pants.variant), BuildPants("Blue", "1"), "pants"),
            "hair" => (BuildHair(model), BuildHairFallback(), "hair"),
            "face-eyes-left" => (BuildEyes(model.face.eyeColor), BuildEyes("Black"), "face"),
            "face-eyes-right" => (BuildEyes(model.face.eyeColor), BuildEyes("Black"), "face"),
            "face-eyebrows" => (BuildBrows(model.face.eyebrowColor, mood), BuildBrows("black", CharacterMood.Stable), "face"),
            "face-nose" => (BuildNose(model.face.noseTint, model.face.noseStyle), BuildNose(1, 1), "face"),
            "face-mouth" => (BuildMouth(model, mood), BuildMouth(null, CharacterMood.Stable), "face"),
            _ => (BuildFallback(), BuildFallback(), "missing"),
        };
    }

    private static string BuildFallback()
    {
        return "Art/KenneyModular/PNG/Skin/Tint 1/tint1_head";
    }

    private static string BuildSkin(string part, int tint)
    {
        return $"Art/KenneyModular/PNG/Skin/Tint {Mathf.Clamp(tint, 1, 8)}/tint{Mathf.Clamp(tint, 1, 8)}_{part}";
    }

    private static string BuildHair(CharacterModel model)
    {
        var color = model?.hair?.color ?? CharacterCatalog.hairColors[0];
        var gender = model?.hair?.gender ?? "Man";
        var style = Math.Max(1, model?.hair?.style ?? 1);
        return $"Art/KenneyModular/PNG/Hair/{color}/{Slug(color)}{gender}{style}";
    }

    private static string BuildShirtArm(string color, int style)
    {
        var safeColor = EnsureShirtColor(color);
        var prefix = safeColor == "Yellow" ? "armYellow" : $"{Slug(safeColor)}Arm";
        var sleeve = style <= 3 ? "long" : style <= 6 ? "short" : "shorter";
        return $"Art/KenneyModular/PNG/Shirts/{safeColor}/{prefix}_{sleeve}";
    }

    private static string BuildShirt(string color, int style)
    {
        var safeColor = EnsureShirtColor(color);
        var prefix = safeColor == "Yellow" ? "shirtYellow" : $"{Slug(safeColor)}Shirt";
        return $"Art/KenneyModular/PNG/Shirts/{safeColor}/{prefix}{style}";
    }

    private static string BuildPants(string color, string variant)
    {
        var safeColor = EnsurePantColor(color);
        return $"Art/KenneyModular/PNG/Pants/{safeColor}/pants{safeColor.Replace(" ", string.Empty)}{CharacterModelFactory.NormalizePantsVariant(variant)}";
    }

    private static string BuildShoes(string color, int style)
    {
        var safeColor = EnsureShoeColor(color);
        var prefix = safeColor == "Brown 1" ? "brown" : safeColor == "Brown 2" ? "brown2" : Slug(safeColor);
        return $"Art/KenneyModular/PNG/Shoes/{safeColor}/{prefix}Shoe{style}";
    }

    private static string BuildEyes(string color)
    {
        return $"Art/KenneyModular/PNG/Face/Eyes/eye{EnsureEyeColor(color)}_large";
    }

    private static string BuildBrows(string color, CharacterMood mood)
    {
        var safe = EnsureMouthOrBrowsColor(color, true);
        var idx = mood == CharacterMood.Danger ? 3 : mood == CharacterMood.Warn ? 2 : 1;
        return $"Art/KenneyModular/PNG/Face/Eyebrows/{safe}Brow{idx}";
    }

    private static string BuildNose(int tint, int noseStyle)
    {
        var safeTint = Mathf.Clamp(tint, 1, 8);
        return $"Art/KenneyModular/PNG/Face/Nose/Tint {safeTint}/tint{safeTint}Nose{Mathf.Clamp(noseStyle, 1, 3)}";
    }

    private static string BuildMouth(CharacterModel model, CharacterMood mood)
    {
        var mouth = model?.face?.baseMouth;
        if (mood == CharacterMood.Danger) return "Art/KenneyModular/PNG/Face/Mouth/mouth_sad";
        if (mood == CharacterMood.Warn) return "Art/KenneyModular/PNG/Face/Mouth/mouth_oh";
        if (string.IsNullOrWhiteSpace(mouth))
        {
            return "Art/KenneyModular/PNG/Face/Mouth/mouth_straight";
        }

        return $"Art/KenneyModular/PNG/Face/Mouth/{mouth}";
    }

    private static string BuildHairFallback()
    {
        return "Art/KenneyModular/PNG/Hair/Black/blackMan1";
    }

    private static string Slug(string value)
    {
        return (value ?? string.Empty)
            .ToLowerInvariant()
            .Replace(" ", string.Empty);
    }

    private static string EnsureShirtColor(string value)
    {
        return CharacterCatalog.shirtColors.Contains(value) ? value : CharacterCatalog.shirtColors[0];
    }

    private static string EnsurePantColor(string value)
    {
        return CharacterCatalog.pantsColors.Contains(value) ? value : CharacterCatalog.pantsColors[0];
    }

    private static string EnsureShoeColor(string value)
    {
        return CharacterCatalog.shoeColors.Contains(value) ? value : CharacterCatalog.shoeColors[0];
    }

    private static string EnsureEyeColor(string value)
    {
        return CharacterCatalog.eyeColors.Contains(value) ? value : CharacterCatalog.eyeColors[0];
    }

    private static string EnsureMouthOrBrowsColor(string value, bool lowerCase)
    {
        var safe = string.IsNullOrWhiteSpace(value) ? "black" : value;
        return safe;
    }

    private static Sprite ResolveSprite(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        if (SpriteCache.TryGetValue(path, out var cachedSprite))
        {
            return cachedSprite;
        }

        var trimmed = path.Replace("\\", "/");
        if (trimmed.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[..^4];
        }

        var loaded = Resources.Load<Sprite>(trimmed);
        if (loaded != null)
        {
            SpriteCache[trimmed] = loaded;
        }

        return loaded;
    }

    private static Sprite GetPlaceholder()
    {
        if (placeholderSprite != null)
        {
            return placeholderSprite;
        }

        var texture = new Texture2D(PlaceholderSize, PlaceholderSize, TextureFormat.RGBA32, false);
        for (var y = 0; y < PlaceholderSize; y += 1)
        {
            for (var x = 0; x < PlaceholderSize; x += 1)
            {
                var dark = (x + y) % 2 == 0 ? 1f : 0.88f;
                texture.SetPixel(x, y, new Color(dark, 0f, 0f, 0.8f));
            }
        }

        texture.Apply();
        placeholderSprite = Sprite.Create(texture, new Rect(0, 0, PlaceholderSize, PlaceholderSize), new Vector2(0.5f, 0.5f), DefaultPixelsPerUnit);
        return placeholderSprite;
    }
}

[Serializable]
public readonly struct CharacterStats
{
    public readonly int partsTotal;
    public readonly int partsRendered;
    public readonly int partsMissing;
    public readonly string[] missingFrames;

    public CharacterStats(int partsTotal, int partsRendered, int partsMissing, IReadOnlyCollection<string> missingFrames)
    {
        this.partsTotal = partsTotal;
        this.partsRendered = partsRendered;
        this.partsMissing = partsMissing;
        this.missingFrames = missingFrames?.ToArray() ?? Array.Empty<string>();
    }
}
