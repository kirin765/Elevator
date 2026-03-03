using System;
using System.Collections.Generic;

public enum CharacterMood
{
    Stable,
    Warn,
    Danger,
}

[Serializable]
public class CharacterModel
{
    public int skinTint;

    [Serializable]
    public class HairInfo
    {
        public string color;
        public string gender;
        public int style;
    }

    [Serializable]
    public class FaceInfo
    {
        public string eyebrowColor;
        public string eyeColor;
        public int noseStyle;
        public int noseTint;
        public string baseMouth;
    }

    [Serializable]
    public class ShirtInfo
    {
        public string color;
        public int style;
    }

    [Serializable]
    public class PantsInfo
    {
        public string color;
        public string variant;
    }

    [Serializable]
    public class ShoesInfo
    {
        public string color;
        public int style;
    }

    public HairInfo hair = new HairInfo();
    public FaceInfo face = new FaceInfo();
    public ShirtInfo shirt = new ShirtInfo();
    public PantsInfo pants = new PantsInfo();
    public ShoesInfo shoes = new ShoesInfo();
    public bool isHero;
}

public static class CharacterCatalog
{
    public static readonly int[] skinTints = { 1, 2, 3, 4, 5, 6, 7, 8 };
    public static readonly string[] hairColors = { "Black", "Blonde", "Brown 1", "Brown 2", "Grey", "Red", "Tan", "White" };
    public static readonly string[] eyeColors = { "Black", "Blue", "Brown", "Green", "Pine" };
    public static readonly string[] eyebrowColors = { "black", "blonde", "brown1", "brown2", "grey", "red", "tan", "white" };
    public static readonly string[] mouths = { "mouth_glad", "mouth_happy", "mouth_oh", "mouth_straight", "mouth_sad", "mouth_teethLower", "mouth_teethUpper" };
    public static readonly string[] shirtColors = { "Blue", "Green", "Grey", "Navy", "Pine", "Red", "White", "Yellow" };
    public static readonly string[] pantsColors = { "Blue 1", "Blue 2", "Brown", "Green", "Grey", "Light Blue", "Navy", "Pine", "Red", "Tan", "White", "Yellow" };
    public static readonly string[] shoeColors = { "Black", "Blue", "Brown 1", "Brown 2", "Grey", "Red", "Tan" };
}

public sealed class SeedRng
{
    private uint state;

    public SeedRng(long seed)
    {
        state = (uint)seed;
        if (state == 0u)
        {
            state = 0x1u;
        }
    }

    public float NextFloat()
    {
        state = (state * 1664525u) + 1013904223u;
        return ((float)state) / 4294967296f;
    }

    public int NextInt(int minInclusive, int maxInclusive)
    {
        if (maxInclusive < minInclusive)
        {
            return minInclusive;
        }

        return minInclusive + (int)(NextFloat() * (maxInclusive - minInclusive + 1));
    }

    public string NextFrom(string[] values)
    {
        if (values == null || values.Length == 0)
        {
            return string.Empty;
        }

        return values[NextInt(0, values.Length - 1)];
    }
}

public static class CharacterModelFactory
{
    public static CharacterModel NormalizeModel(CharacterModel model)
    {
        if (model == null)
        {
            model = new CharacterModel();
        }

        var safe = new CharacterModel();
        safe.skinTint = Clamp(model.skinTint, 1, 8, CharacterCatalog.skinTints[0]);
        safe.hair = NormalizeHair(model.hair, safe.skinTint);
        safe.face = NormalizeFace(model.face, safe.skinTint);
        safe.shirt = NormalizeShirt(model.shirt);
        safe.pants = NormalizePants(model.pants);
        safe.shoes = NormalizeShoes(model.shoes);
        safe.isHero = model.isHero;
        return safe;
    }

    public static CharacterModel MakeModel(SeedRng rng, bool isHero)
    {
        var safeSkinTint = CharacterCatalog.skinTints[rng.NextInt(0, CharacterCatalog.skinTints.Length - 1)];

        var hairColor = CharacterCatalog.hairColors[rng.NextInt(0, CharacterCatalog.hairColors.Length - 1)];
        var gender = rng.NextFloat() > 0.5f ? "Woman" : "Man";
        var maxHairStyle = gender == "Woman" ? 6 : 8;

        var model = new CharacterModel
        {
            skinTint = safeSkinTint,
            hair = new CharacterModel.HairInfo
            {
                color = hairColor,
                gender = gender,
                style = Clamp(rng.NextInt(1, maxHairStyle), 1, maxHairStyle, 1),
            },
            face = new CharacterModel.FaceInfo
            {
                eyebrowColor = CharacterCatalog.eyebrowColors[rng.NextInt(0, CharacterCatalog.eyebrowColors.Length - 1)],
                eyeColor = CharacterCatalog.eyeColors[rng.NextInt(0, CharacterCatalog.eyeColors.Length - 1)],
                noseStyle = Clamp(rng.NextInt(1, 3), 1, 3, 1),
                noseTint = safeSkinTint,
                baseMouth = CharacterCatalog.mouths[rng.NextInt(0, CharacterCatalog.mouths.Length - 1)],
            },
            shirt = new CharacterModel.ShirtInfo
            {
                color = CharacterCatalog.shirtColors[rng.NextInt(0, CharacterCatalog.shirtColors.Length - 1)],
                style = Clamp(rng.NextInt(1, 8), 1, 8, 1),
            },
            pants = new CharacterModel.PantsInfo
            {
                color = CharacterCatalog.pantsColors[rng.NextInt(0, CharacterCatalog.pantsColors.Length - 1)],
                variant = PickPantVariant(rng),
            },
            shoes = new CharacterModel.ShoesInfo
            {
                color = CharacterCatalog.shoeColors[rng.NextInt(0, CharacterCatalog.shoeColors.Length - 1)],
                style = Clamp(rng.NextInt(1, 5), 1, 5, 1),
            },
            isHero = isHero,
        };

        return NormalizeModel(model);
    }

    private static string PickPantVariant(SeedRng rng)
    {
        var numeric = rng.NextInt(1, 4);
        var variant = rng.NextInt(0, 6);
        if (variant <= 3) return numeric.ToString();
        if (variant == 4) return "_long";
        if (variant == 5) return "_short";
        return "_shorter";
    }

    public static string Slug(string value)
    {
        return (value ?? string.Empty).Replace(" ", string.Empty).ToLowerInvariant();
    }

    public static uint HashCode(string value)
    {
        uint hash = 2166136261u;
        foreach (var ch in value ?? string.Empty)
        {
            hash ^= ch;
            hash *= 16777619u;
        }
        return hash == 0u ? 1u : hash;
    }

    public static CharacterModel.HairInfo NormalizeHair(CharacterModel.HairInfo hair, int safeSkinTint)
    {
        var result = new CharacterModel.HairInfo
        {
            color = IsInArray(hair?.color, CharacterCatalog.hairColors, CharacterCatalog.hairColors[0]),
            gender = hair?.gender == "Woman" ? "Woman" : "Man",
        };

        var maxStyle = result.gender == "Woman" ? 6 : 8;
        result.style = Clamp(
            ParseInt(hair?.style),
            1,
            maxStyle,
            1
        );
        return result;
    }

    private static CharacterModel.FaceInfo NormalizeFace(CharacterModel.FaceInfo face, int safeSkinTint)
    {
        return new CharacterModel.FaceInfo
        {
            eyebrowColor = IsInArray(face?.eyebrowColor, CharacterCatalog.eyebrowColors, CharacterCatalog.eyebrowColors[0]),
            eyeColor = IsInArray(face?.eyeColor, CharacterCatalog.eyeColors, CharacterCatalog.eyeColors[0]),
            noseStyle = Clamp(ParseInt(face?.noseStyle), 1, 3, 1),
            noseTint = Clamp(ParseInt(face?.noseTint), 1, 8, safeSkinTint),
            baseMouth = IsInArray(face?.baseMouth, CharacterCatalog.mouths, CharacterCatalog.mouths[0]),
        };
    }

    private static CharacterModel.ShirtInfo NormalizeShirt(CharacterModel.ShirtInfo shirt)
    {
        return new CharacterModel.ShirtInfo
        {
            color = IsInArray(shirt?.color, CharacterCatalog.shirtColors, CharacterCatalog.shirtColors[0]),
            style = Clamp(ParseInt(shirt?.style), 1, 8, 1),
        };
    }

    private static CharacterModel.PantsInfo NormalizePants(CharacterModel.PantsInfo pants)
    {
        return new CharacterModel.PantsInfo
        {
            color = IsInArray(pants?.color, CharacterCatalog.pantsColors, CharacterCatalog.pantsColors[0]),
            variant = NormalizePantsVariant(pants?.variant),
        };
    }

    private static CharacterModel.ShoesInfo NormalizeShoes(CharacterModel.ShoesInfo shoes)
    {
        return new CharacterModel.ShoesInfo
        {
            color = IsInArray(shoes?.color, CharacterCatalog.shoeColors, CharacterCatalog.shoeColors[0]),
            style = Clamp(ParseInt(shoes?.style), 1, 5, 1),
        };
    }

    public static string NormalizePantsVariant(string value)
    {
        if (value == "_long" || value == "_short" || value == "_shorter")
        {
            return value;
        }

        var parsed = ParseInt(value);
        if (parsed >= 1 && parsed <= 4)
        {
            return parsed.ToString();
        }

        return "1";
    }

    private static int ParseInt(object value)
    {
        if (value is int intValue)
        {
            return intValue;
        }

        if (value is string strValue && int.TryParse(strValue, out int parsed))
        {
            return parsed;
        }

        return 1;
    }

    private static int Clamp(int value, int min, int max, int fallback)
    {
        return value >= min && value <= max ? value : fallback;
    }

    private static string IsInArray(string value, string[] values, string fallback)
    {
        for (int i = 0; i < values.Length; i += 1)
        {
            if (string.Equals(values[i], value, StringComparison.Ordinal))
            {
                return value;
            }
        }

        return fallback;
    }
}
