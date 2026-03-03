using System;
using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public class ElevatorAudioEngine : MonoBehaviour
{
    private const int SampleRate = 44100;

    private readonly Dictionary<string, AudioClip> clipCache = new();
    private AudioSource continuousTone;
    private AudioSource continuousNoise;
    private AudioSource sfxSource;
    private bool initialized;

    [SerializeField]
    private float toneVolume = 0.18f;

    [SerializeField]
    private float noiseVolume = 0.05f;

    [SerializeField]
    private float baseFrequency = 220f;

    private void Awake()
    {
        EnsureAudioSources();
    }

    public void StartEngine()
    {
        EnsureAudioSources();
        if (!continuousTone.isPlaying)
        {
            continuousTone.Play();
        }

        if (!continuousNoise.isPlaying)
        {
            continuousNoise.Play();
        }
    }

    public void Stop()
    {
        if (!initialized)
        {
            return;
        }

        continuousTone.Stop();
        continuousNoise.Stop();
        sfxSource.Stop();
    }

    public void SetContinuousSound(float soundLevel, bool isHolding)
    {
        EnsureAudioSources();
        var normalized = Mathf.Clamp01(soundLevel / 100f);

        if (!continuousTone.isPlaying)
        {
            StartEngine();
        }

        continuousTone.volume = Mathf.Clamp01(toneVolume * (0.2f + normalized * 1.2f) * (isHolding ? 0.85f : 1f));
        continuousNoise.volume = Mathf.Clamp01(noiseVolume * (0.2f + normalized) * (isHolding ? 0.5f : 1f));

        continuousTone.pitch = 0.9f + normalized * 0.6f;
        continuousNoise.pitch = 1f + normalized * 0.4f;
    }

    public void Beep(float frequency, float duration, float volume = 0.35f)
    {
        EnsureAudioSources();
        var clip = GetOrCreateTone((int)Mathf.Max(20f, frequency), duration);
        sfxSource.PlayOneShot(clip, volume);
    }

    public void Cheer()
    {
        EnsureAudioSources();
        sfxSource.PlayOneShot(GetOrCreateTone(660, 0.12f), 0.5f);
        sfxSource.PlayOneShot(GetOrCreateTone(880, 0.12f), 0.45f);
    }

    public void Impact()
    {
        EnsureAudioSources();
        sfxSource.PlayOneShot(GetOrCreateTone(120, 0.2f), 0.45f);
    }

    private void EnsureAudioSources()
    {
        if (initialized)
        {
            return;
        }

        continuousTone = gameObject.AddComponent<AudioSource>();
        continuousNoise = gameObject.AddComponent<AudioSource>();
        sfxSource = gameObject.AddComponent<AudioSource>();

        continuousTone.loop = true;
        continuousNoise.loop = true;
        continuousTone.playOnAwake = false;
        continuousNoise.playOnAwake = false;
        sfxSource.playOnAwake = false;
        continuousTone.spatialBlend = 0f;
        continuousNoise.spatialBlend = 0f;
        sfxSource.spatialBlend = 0f;

        continuousTone.clip = GetOrCreateTone(baseFrequency, 1.0f);
        continuousNoise.clip = GetOrCreateNoise();

        initialized = true;
    }

    private AudioClip GetOrCreateTone(int frequency, float durationSeconds)
    {
        var key = $"tone_{frequency}_{durationSeconds:0.00}";
        if (clipCache.TryGetValue(key, out var cached))
        {
            return cached;
        }

        var clamped = Math.Max(20, frequency);
        var samples = Math.Max(1, Mathf.RoundToInt(Mathf.Max(0.02f, durationSeconds) * SampleRate));
        var data = new float[samples];
        var twoPi = MathF.PI * 2f;
        var gain = 0.6f;
        for (var i = 0; i < data.Length; i += 1)
        {
            var t = i / (float)SampleRate;
            data[i] = Mathf.Sin((float)(twoPi * clamped * t)) * gain;
        }

        var clip = AudioClip.Create(key, samples, 1, SampleRate, false);
        clip.SetData(data, 0);
        clipCache[key] = clip;
        return clip;
    }

    private AudioClip GetOrCreateNoise()
    {
        const string key = "noise_short";
        if (clipCache.TryGetValue(key, out var cached))
        {
            return cached;
        }

        const int samples = SampleRate;
        var data = new float[samples];
        var random = new System.Random(1234567);
        for (var i = 0; i < data.Length; i += 1)
        {
            data[i] = ((float)random.NextDouble() * 2f - 1f) * 0.08f;
        }

        var clip = AudioClip.Create(key, samples, 1, SampleRate, false);
        clip.SetData(data, 0);
        clipCache[key] = clip;
        return clip;
    }
}
