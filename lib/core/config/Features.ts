export const features = {
  INVISIBLE_FALLBACK_UI:
    process.env.NEXT_PUBLIC_FEATURE_INVISIBLE_FALLBACK_UI === 'true',
  AUDIO_PREFETCH:
    process.env.NEXT_PUBLIC_FEATURE_AUDIO_PREFETCH === 'true',
  TTS_FAST:
    process.env.NEXT_PUBLIC_FEATURE_TTS_FAST === 'true',
  TTS_CHUNK_PLAYBACK:
    process.env.NEXT_PUBLIC_FEATURE_TTS_CHUNK_PLAYBACK === 'true',
  STT_DUAL_PATH:
    process.env.NEXT_PUBLIC_FEATURE_STT_DUAL_PATH === 'true',
  TTS_STREAMING:
    process.env.NEXT_PUBLIC_FEATURE_TTS_STREAMING === 'true',
};

