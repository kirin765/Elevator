using System.Collections.Generic;
using UnityEngine;

public static class CharacterLayout
{
    public const float HeroWidth = 196f;
    public const float HeroHeight = 230f;
    public const float NpcWidth = 176f;
    public const float NpcHeight = 210f;

    public static readonly Vector2[] PassengerPositions = new Vector2[]
    {
        new Vector2(156f, 604f),
        new Vector2(290f, 604f),
        new Vector2(374f, 634f),
        new Vector2(336f, 706f),
    };

    public static readonly Vector2 HeroBasePosition = new Vector2(75f, 528f);

    public static readonly Dictionary<string, LayoutData> CharacterPartLayout = new Dictionary<string, LayoutData>
    {
        ["skin-head"] = new LayoutData(0.24f, 0.04f, 0.52f, 0.34f, 2),
        ["skin-neck"] = new LayoutData(0.36f, 0.31f, 0.28f, 0.10f, 2),
        ["shirt"] = new LayoutData(0.18f, 0.33f, 0.64f, 0.42f, 3),
        ["pants"] = new LayoutData(0.20f, 0.67f, 0.62f, 0.18f, 4),
        ["hair"] = new LayoutData(0.21f, 0.01f, 0.58f, 0.46f, 8),
        ["face-eyebrows"] = new LayoutData(0.32f, 0.18f, 0.39f, 0.08f, 10),
        ["face-eyes-left"] = new LayoutData(0.31f, 0.23f, 0.17f, 0.12f, 9),
        ["face-eyes-right"] = new LayoutData(0.52f, 0.23f, 0.17f, 0.12f, 9),
        ["face-nose"] = new LayoutData(0.44f, 0.29f, 0.12f, 0.10f, 10),
        ["face-mouth"] = new LayoutData(0.36f, 0.35f, 0.29f, 0.10f, 8),
    };

    public static readonly Dictionary<string, LayoutData> LimbLayout = new Dictionary<string, LayoutData>
    {
        ["skin-arm-left"] = new LayoutData(0.10f, 0.34f, 0.26f, 0.34f, 1),
        ["shirt-arm-left"] = new LayoutData(0.10f, 0.34f, 0.26f, 0.34f, 2),
        ["hand-left"] = new LayoutData(0.03f, 0.55f, 0.14f, 0.12f, 4),
        ["skin-leg-left"] = new LayoutData(0.30f, 0.59f, 0.22f, 0.34f, 2),
        ["shoe-left"] = new LayoutData(0.28f, 0.87f, 0.22f, 0.11f, 5),
        ["skin-leg-right"] = new LayoutData(0.48f, 0.59f, 0.22f, 0.34f, 2),
        ["shoe-right"] = new LayoutData(0.50f, 0.87f, 0.22f, 0.11f, 5),
        ["skin-arm-right"] = new LayoutData(0.64f, 0.34f, 0.26f, 0.34f, 5),
        ["shirt-arm-right"] = new LayoutData(0.64f, 0.34f, 0.26f, 0.34f, 6),
        ["hand-right"] = new LayoutData(0.83f, 0.55f, 0.14f, 0.12f, 7),
    };

    public static readonly string[] PartOrder =
    {
        "skin-leg-left",
        "skin-leg-right",
        "shoe-left",
        "shoe-right",
        "skin-arm-left",
        "shirt-arm-left",
        "hand-left",
        "shirt",
        "pants",
        "skin-neck",
        "skin-head",
        "skin-arm-right",
        "shirt-arm-right",
        "hand-right",
        "face-eyes-left",
        "face-eyes-right",
        "face-nose",
        "face-mouth",
        "face-eyebrows",
        "hair",
    };

    public static readonly Dictionary<string, string> PartCategory = new Dictionary<string, string>
    {
        ["skin-head"] = "skin",
        ["skin-neck"] = "skin",
        ["skin-arm-left"] = "skin",
        ["skin-arm-right"] = "skin",
        ["skin-leg-left"] = "skin",
        ["skin-leg-right"] = "skin",
        ["shirt-arm-left"] = "shirts",
        ["shirt-arm-right"] = "shirts",
        ["shirt"] = "shirts",
        ["pants"] = "pants",
        ["shoes"] = "shoes",
        ["shoe-left"] = "shoes",
        ["shoe-right"] = "shoes",
        ["hand-left"] = "skin",
        ["hand-right"] = "skin",
        ["face-eyebrows"] = "face",
        ["face-eyes-left"] = "face",
        ["face-eyes-right"] = "face",
        ["face-nose"] = "face",
        ["face-mouth"] = "face",
        ["hair"] = "hair",
    };
}

public readonly struct LayoutData
{
    public readonly float x;
    public readonly float y;
    public readonly float w;
    public readonly float h;
    public readonly int sorting;

    public LayoutData(float x, float y, float w, float h, int sorting)
    {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.sorting = sorting;
    }
}
