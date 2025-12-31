'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';

interface ChapterData {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  audioHighlightUrl?: string;
  coverImageUrl?: string;
  bannerImageUrl?: string;
  metadata?: {
    sessionNumber?: number;
    emotionalTone?: string;
    storybook?: any;
  };
}

/**
 * Strip markdown and prepare text for natural TTS reading
 */
function prepareTextForTTS(content: string): string {
  return content
    // Remove markdown headers, convert to natural pauses
    .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
    // Remove emphasis markers but keep the text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove links, keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Replace em-dashes and special punctuation for better flow
    .replace(/–/g, ', ')
    .replace(/—/g, '... ')
    // Add slight pauses for ellipsis
    .replace(/\.\.\./g, '... ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function StoryImmersionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [story, setStory] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechProgressRef = useRef<NodeJS.Timeout | null>(null);

  // Storybook states
  const [vertexAIAvailable, setVertexAIAvailable] = useState<boolean | null>(null);
  const [storybookStatus, setStorybookStatus] = useState<'checking' | 'ready' | 'generating' | 'available' | 'unavailable'>('checking');
  const [storybookExists, setStorybookExists] = useState(false);

  // Share Story Handler
  const handleShare = async () => {
    if (!story) return;

    const shareUrl = window.location.href;
    const shareText = `${story.title || 'A Family Memory'} - Evermore`;

    // Try native share first (mobile-friendly)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: story.content?.substring(0, 100) + '...' || 'A cherished memory',
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  // Audio Playback Handler with Web Speech API fallback
  const [isFavorite, setIsFavorite] = useState(false);

  // Check if favorite on load (simulated or passed via props if available)
  // Ideally, we fetch this state. For MVP, we'll let it sync on first click or ignored for local state until reload.
  // Better: Fetch user profile to check favorites? Or assume false initially.

  const handleAddToFavorites = async () => {
    if (!story) return;
    try {
      const res = await fetch(`/api/chapters/${story.id}/favorite`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsFavorite(data.isFavorite);
        // Show toast or updated visual
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  const handlePlayAudio = async () => {
    if (!story?.content) return;

    // If already playing, pause
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Stop any browser speech synthesis
    if (isPlaying && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // If we have cached audio, resume
    if (audioRef.current && audioUrlRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // Check if story has pre-generated audio url from backend
    if (story.audioHighlightUrl && !audioUrlRef.current) {
      console.log('Playing pre-generated audio:', story.audioHighlightUrl);
      const audioUrl = story.audioHighlightUrl;
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Setup listeners (reusing logic meant for TTS)
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        setAudioProgress(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };

      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Failed to play existing audio:", err);
        // Fallthrough to generation or error handling if needed, 
        // but for now let's assume if URL exists it should play.
        // If it fails, maybe we reset and let it try TTS? 
        // For safety, let's reset refs and alert user or fall back.
        // For MVP: simple console error and maybe fallback to TTS if strict requirement,
        // but usually better to fail play than regen expensive audio unexpectedly.
        setIsPlaying(false);
      }
      return;
    }

    // Generate TTS audio
    setAudioLoading(true);
    const cleanText = prepareTextForTTS(story.content).substring(0, 4000);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!response.ok) {
        throw new Error('Server TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        setAudioProgress(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Server TTS failed, falling back to browser speech:', err);

      // Fallback to browser's Web Speech API (works without credentials)
      if ('speechSynthesis' in window) {
        // Cancel any pending speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = volume; // Apply current volume setting

        // Try to use a nicer voice if available (may be empty on first call)
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const preferredVoice = voices.find(v =>
            v.name.includes('Google') || v.name.includes('Microsoft') || v.lang.startsWith('en')
          );
          if (preferredVoice) utterance.voice = preferredVoice;
        }
        // If no voices, browser will use default voice

        utterance.onstart = () => {
          console.log('[Stories] Browser speech started');
          setIsPlaying(true);
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setAudioProgress(0);
          if (speechProgressRef.current) {
            clearInterval(speechProgressRef.current);
            speechProgressRef.current = null;
          }
        };

        utterance.onerror = (e) => {
          console.error('[Stories] Browser speech error:', e);
          setIsPlaying(false);
          setAudioLoading(false);
        };

        // Estimate duration and track progress for Web Speech
        const estimatedDuration = story.content.length / 15; // ~15 chars/sec
        setAudioDuration(estimatedDuration);

        const startTime = Date.now();
        speechProgressRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          setAudioProgress(Math.min(elapsed, estimatedDuration));
          if (elapsed >= estimatedDuration) {
            if (speechProgressRef.current) {
              clearInterval(speechProgressRef.current);
              speechProgressRef.current = null;
            }
          }
        }, 100);

        console.log('[Stories] Calling speechSynthesis.speak()');
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      } else {
        console.error('No TTS available');
      }
    } finally {
      setAudioLoading(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (speechProgressRef.current) {
        clearInterval(speechProgressRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        console.log('[Stories] Unmounting, cancelling browser speech');
        window.speechSynthesis.cancel();
      }
    };
  }, []);
  useEffect(() => {
    async function fetchChapter() {
      try {
        // Fetch chapter by ID
        const res = await fetch(`/api/chapters/detail/${resolvedParams.id}`);
        if (!res.ok) {
          throw new Error('Chapter not found');
        }
        const data = await res.json();
        setStory(data);

        // Check if storybook already exists (check metadata)
        if (data.metadata?.storybook) {
          setStorybookExists(true);
          setStorybookStatus('available');
        } else {
          // Check if Vertex AI is available for generation
          try {
            const vertexRes = await fetch('/api/vertexai/health');
            const vertexHealth = await vertexRes.json();
            setVertexAIAvailable(vertexHealth.available);

            if (vertexHealth.available) {
              setStorybookStatus('ready');
            } else {
              setStorybookStatus('unavailable');
            }
          } catch (e) {
            console.warn('[VertexAI] Health check failed:', e);
            setStorybookStatus('unavailable');
          }
        }
      } catch (err: any) {
        console.error('Error fetching chapter:', err);
        setError(err.message || 'Failed to load story');
        setStorybookStatus('unavailable');
      } finally {
        setLoading(false);
      }
    }
    fetchChapter();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <AppShell userType="family" userName="User" showNav={true}>
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-6 bg-border-light rounded w-40 mb-8"></div>
          <div className="h-12 bg-border-light rounded w-3/4 mb-4"></div>
          <div className="h-6 bg-border-light rounded w-1/2 mb-10"></div>
          <div className="h-16 bg-surface-light rounded-2xl mb-10"></div>
          <div className="space-y-4">
            <div className="h-4 bg-border-light rounded w-full"></div>
            <div className="h-4 bg-border-light rounded w-full"></div>
            <div className="h-4 bg-border-light rounded w-5/6"></div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !story) {
    return (
      <AppShell userType="family" userName="User" showNav={true}>
        <div className="max-w-6xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-text-primary-light mb-2">Story Not Found</h2>
          <p className="text-text-secondary-light mb-6">{error || 'This story could not be found.'}</p>
          <Link href="/stories" className="inline-block bg-primary text-white px-6 py-2 rounded-full font-medium">
            Back to Stories
          </Link>
        </div>
      </AppShell>
    );
  }

  const formattedDate = new Date(story.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <AppShell userType="family" showNav={true}>
      <main className="container mx-auto py-10 px-0 max-w-6xl">

        {/* Navigation */}
        <div className="mb-12 animate-fade-in">
          <Link href="/stories" className="inline-flex items-center text-brown-main/60 hover:text-terracotta transition-colors group font-bold">
            <span className="material-symbols-outlined text-2xl mr-2 group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Stories Collection
          </Link>
        </div>

        {/* Banner Image - AI Generated */}
        {story.bannerImageUrl && (
          <div className="mb-12 animate-fade-in [animation-delay:0.05s] rounded-3xl overflow-hidden shadow-2xl shadow-peach-warm/20">
            <div className="relative aspect-[21/9] w-full">
              <img
                src={story.bannerImageUrl}
                alt={story.title || 'Story banner'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          </div>
        )}

        {/* Story Header */}
        <div className="mb-16 animate-fade-in [animation-delay:0.1s]">
          {story.metadata?.sessionNumber && (
            <p className="text-lg font-bold text-terracotta uppercase tracking-widest mb-4">
              Chapter {story.metadata.sessionNumber}
            </p>
          )}
          <h1 className="text-5xl md:text-7xl font-serif font-extrabold text-text-primary mb-6 leading-tight">
            {story.title || 'Untitled Memory'}
          </h1>
          <p className="text-2xl text-text-secondary font-serif opacity-70">
            A memory from <span className="italic">{formattedDate}</span>
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-16 items-start">

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-12 animate-fade-in [animation-delay:0.2s]">

            {/* Elegant Audio Player */}
            <div className="bg-[#FFF5ED] rounded-[2rem] p-8 md:p-10 border border-peach-main/20 shadow-xl shadow-peach-warm/10">
              <div className="flex items-center gap-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayAudio}
                  disabled={audioLoading}
                  className="w-20 h-20 bg-[#FDE2D0] rounded-full flex items-center justify-center text-terracotta shadow-lg transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-4xl filled">
                    {audioLoading ? 'hourglass_empty' : isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </motion.button>

                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-bold text-terracotta">
                      {Math.floor(audioProgress / 60)}:{String(Math.floor(audioProgress % 60)).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-bold text-text-muted opacity-60">
                      {audioDuration > 0
                        ? `${Math.floor(audioDuration / 60)}:${String(Math.floor(audioDuration % 60)).padStart(2, '0')}`
                        : '--:--'}
                    </span>
                  </div>
                  <div className="relative h-2 bg-[#FDE2D0]/40 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-peach-warm to-terracotta rounded-full transition-all"
                      style={{ width: audioDuration > 0 ? `${(audioProgress / audioDuration) * 100}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-terracotta">
                  <button
                    onClick={() => setVolume(v => v > 0 ? 0 : 0.7)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-2xl">
                      {volume === 0 ? 'volume_off' : 'volume_up'}
                    </span>
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const newVolume = parseFloat(e.target.value);
                      setVolume(newVolume);
                      if (audioRef.current) {
                        audioRef.current.volume = newVolume;
                      }
                    }}
                    className="w-16 h-1.5 appearance-none bg-[#FDE2D0]/40 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-terracotta"
                  />
                </div>
              </div>
            </div>

            {/* IMMERSIVE READING MODE - Grandpa's Story */}
            <div className="bg-gradient-to-b from-[#FFFAF5] to-white rounded-[2.5rem] p-10 md:p-16 shadow-2xl shadow-peach-warm/20 border border-peach-main/10 relative overflow-hidden">

              {/* Decorative Opening Quote Mark */}
              <div className="absolute top-8 left-8 text-[120px] font-serif text-peach-main/10 leading-none select-none pointer-events-none">
                "
              </div>

              {/* Story Content - Clean, Immersive */}
              <div className="relative z-10 max-w-2xl mx-auto">

                {/* Story Body - Each paragraph beautifully rendered */}
                <div className="font-serif text-xl md:text-2xl text-text-primary leading-[2] tracking-tight space-y-8">
                  {story.content?.split('\n\n').filter(p => p.trim()).map((paragraph, idx, arr) => {
                    // First paragraph - Opening (slightly larger, italic feel)
                    if (idx === 0) {
                      return (
                        <p key={idx} className="text-2xl md:text-3xl leading-[1.8] first-letter:text-6xl first-letter:font-bold first-letter:text-terracotta first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                          {paragraph.trim()}
                        </p>
                      );
                    }
                    // Last paragraph - Closing reflection (warm tone)
                    if (idx === arr.length - 1) {
                      return (
                        <p key={idx} className="text-xl md:text-2xl italic text-text-secondary/80 border-l-4 border-terracotta/30 pl-6 mt-12">
                          {paragraph.trim()}
                        </p>
                      );
                    }
                    // Middle paragraphs - Regular story flow
                    return (
                      <p key={idx} className="text-xl md:text-2xl">
                        {paragraph.trim()}
                      </p>
                    );
                  }) || <p className="text-text-muted italic">No content available for this memory.</p>}
                </div>

                {/* Story End Ornament */}
                <div className="flex items-center justify-center mt-16 gap-4 text-terracotta/40">
                  <div className="w-12 h-px bg-terracotta/20"></div>
                  <span className="text-2xl">❧</span>
                  <div className="w-12 h-px bg-terracotta/20"></div>
                </div>

                {/* Narrator Attribution */}
                <p className="text-center text-sm font-bold text-text-muted/60 mt-6 uppercase tracking-widest">
                  — A story from Grandpa's heart —
                </p>

              </div>
            </div>

          </div>

          {/* Sidebar / Actions */}
          <aside className="lg:col-span-4 space-y-12 animate-fade-in [animation-delay:0.3s]">

            {/* Action Pills */}
            <div className="space-y-4">
              <button
                onClick={handleShare}
                className={`w-full py-4 border-2 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-sm ${shareStatus === 'copied' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-peach-main/10 text-text-primary hover:bg-peach-main/5'}`}
              >
                <span className="material-symbols-outlined text-xl">{shareStatus === 'copied' ? 'check' : 'share'}</span>
                {shareStatus === 'copied' ? 'Link Copied!' : 'Share Story'}
              </button>
              <button
                onClick={async () => {
                  if (storybookStatus === 'available' || storybookExists) {
                    // Already generated, go directly
                    window.location.href = `/storybook/${resolvedParams.id}`;
                  } else if (storybookStatus === 'ready') {
                    // Start generation
                    setStorybookStatus('generating');
                    try {
                      const res = await fetch(`/api/storybooks/generate/${resolvedParams.id}`);
                      if (res.ok) {
                        setStorybookStatus('available');
                        // Show success toast
                        alert('Storybook created! Click again to view.');
                      } else {
                        setStorybookStatus('unavailable');
                        alert('Storybook generation failed. Please try again later.');
                      }
                    } catch (e) {
                      setStorybookStatus('unavailable');
                      alert('Storybook generation failed. Please try again later.');
                    }
                  }
                }}
                disabled={storybookStatus === 'checking' || storybookStatus === 'generating' || storybookStatus === 'unavailable'}
                className={`w-full py-4 border-2 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-sm ${storybookStatus === 'unavailable'
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                  : storybookStatus === 'generating'
                    ? 'bg-amber-50 border-amber-200 text-amber-600 cursor-wait'
                    : storybookStatus === 'available' || storybookExists
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                      : 'bg-[#FDE2D0]/40 border-[#FDE2D0]/60 text-brown-main hover:bg-[#FDE2D0]/60'
                  }`}
              >
                <span className="material-symbols-outlined text-xl">
                  {storybookStatus === 'generating' ? 'sync' : storybookStatus === 'unavailable' ? 'cloud_off' : 'auto_stories'}
                </span>
                {storybookStatus === 'checking' && 'Checking...'}
                {storybookStatus === 'generating' && 'Creating Storybook...'}
                {storybookStatus === 'unavailable' && 'Storybook unavailable'}
                {storybookStatus === 'available' || storybookExists ? 'Open Storybook' : ''}
                {storybookStatus === 'ready' && !storybookExists && 'Create Storybook'}
              </button>
              <button
                onClick={handleAddToFavorites}
                className="w-full py-4 bg-gradient-to-r from-peach-warm/60 to-terracotta/40 border-b-4 border-terracotta/20 rounded-2xl font-bold text-text-primary hover:from-peach-warm hover:to-terracotta hover:text-white transition-all flex items-center justify-center gap-3 shadow-md"
              >
                <span className="material-symbols-outlined text-xl">favorite</span>
                Add to Favorites
              </button>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
                    try {
                      const res = await fetch(`/api/chapters/detail/${story.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        window.location.href = '/stories';
                      } else {
                        alert('Failed to delete story');
                      }
                    } catch (e) {
                      console.error(e);
                      alert('An error occurred');
                    }
                  }
                }}
                className="w-full py-4 bg-red-50 border-2 border-red-100 rounded-2xl font-bold text-red-500 hover:bg-red-100/50 transition-all flex items-center justify-center gap-3 shadow-sm"
              >
                <span className="material-symbols-outlined text-xl">delete</span>
                Delete Story
              </button>
            </div>

            {/* Story Details */}
            <div className="space-y-8">
              <h4 className="text-lg font-serif font-black text-text-primary border-b border-peach-main/10 pb-4">Story Details</h4>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Recorded</p>
                  <p className="text-lg font-sans font-bold text-text-secondary">{formattedDate}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Character Count</p>
                  <p className="text-lg font-sans font-bold text-text-secondary">{story.content?.length || 0} characters</p>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </main>
    </AppShell>
  );
}
