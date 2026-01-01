'use client';

import { useEffect } from 'react';
import { features } from '@/lib/core/config/Features';

export function VoiceWarmup() {
  useEffect(() => {
    if (!features.AUDIO_PREFETCH) return;
    try {
      // Trigger voice list hydration early
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    } catch {
      // no-op
    }
  }, []);
  return null;
}

