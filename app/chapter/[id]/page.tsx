'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/common/AuthGuard';

interface Chapter {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  coverImageUrl?: string;  // AI-generated card thumbnail
  bannerImageUrl?: string; // AI-generated immersive banner
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  audioUrl?: string;
  entities?: Array<{ name: string; type: string }>;
}

interface UserProfile {
  userId: string;
  role: string;
}

type FontSize = 'small' | 'medium' | 'large';

export default function ChapterDetailPage() {
  const params = useParams();
  const chapterId = params.id as string;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [progressPercent, setProgressPercent] = useState(0);

  // New state for functional features
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user profile first
        const profileRes = await fetch('/api/users/profile', { credentials: 'include' });
        if (!profileRes.ok) {
          setError('Failed to load profile');
          return;
        }
        const profileData = await profileRes.json();
        setProfile(profileData);

        // Fetch chapter
        const chapterRes = await fetch(`/api/family/chapters/${chapterId}?userId=${profileData.userId}`, { credentials: 'include' });
        if (chapterRes.ok) {
          const chapterData = await chapterRes.json();
          setChapter(chapterData);
        } else if (chapterRes.status === 404) {
          setError('Chapter not found');
        } else if (chapterRes.status === 403) {
          setError('You don\'t have access to this chapter');
        } else {
          setError('Failed to load chapter');
        }
      } catch (err) {
        console.error('Failed to fetch chapter:', err);
        setError('Failed to load chapter');
      } finally {
        setLoading(false);
      }
    };

    if (chapterId) {
      fetchData();
    }
  }, [chapterId]);

  // Audio element control
  useEffect(() => {
    if (!chapter?.audioUrl) return;

    const audio = new Audio(chapter.audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgressPercent((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgressPercent(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [chapter?.audioUrl]);

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const toggleSpeed = () => {
    if (playbackSpeed === 1.0) setPlaybackSpeed(1.5);
    else if (playbackSpeed === 1.5) setPlaybackSpeed(2.0);
    else setPlaybackSpeed(1.0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = Number(e.target.value);
    setProgressPercent(newPercent);
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = (newPercent / 100) * audio.duration;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Font size toggle
  const toggleFontSize = () => {
    setFontSize(current => {
      if (current === 'small') return 'medium';
      if (current === 'medium') return 'large';
      return 'small';
    });
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xl';
      case 'large': return 'text-3xl';
      default: return 'text-2xl';
    }
  };

  // Share functionality using Web Share API or clipboard fallback
  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = chapter?.title || 'A Story from Evermore';
    const shareText = chapter?.summary || 'Check out this story!';

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch (err) {
        // User cancelled or error - ignore
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch (err) {
        alert('Could not copy link to clipboard');
      }
    }
  };

  // PDF download
  const handleDownloadPdf = async () => {
    if (!chapter) return;
    setIsGeneratingPdf(true);
    try {
      const response = await fetch(`/api/chapters/${chapterId}/pdf`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chapter.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Static waveform visualization (will be replaced with real audio data when available)
  const waveformHeights = [40, 60, 30, 80, 50, 70, 40, 90, 60, 30, 50, 80, 40, 60, 70, 40, 30, 50, 80, 60, 40, 70, 50, 30, 60, 40, 80, 50, 40, 30];

  return (
    <AuthGuard>
      <div className="bg-[#FDFCF8] font-sans text-[#3D3430] min-h-screen pb-32 relative overflow-hidden">
        {/* Background Texture & Blobs */}
        <div className="fixed inset-0 opacity-[0.4] pointer-events-none z-0" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/paper.png')" }}></div>
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#E07A5F]/5 rounded-full blur-[100px] opacity-60"></div>
          <div className="absolute bottom-[20%] left-[-10%] w-[35rem] h-[35rem] bg-[#F2CC8F]/20 rounded-full blur-[100px] opacity-60"></div>
        </div>

        <div className="max-w-3xl mx-auto min-h-screen relative z-10">

          {/* Navigation */}
          <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#FDFCF8]/80 border-b border-[#E07A5F]/10 px-6 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#756A63]/5 text-[#756A63] transition-colors -ml-2">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div className="flex gap-4">
              <button
                onClick={toggleFontSize}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#756A63]/5 text-[#756A63] transition-colors relative"
                title={`Font size: ${fontSize}`}
              >
                <span className="material-symbols-outlined">text_fields</span>
                <span className="absolute -bottom-1 -right-1 text-[10px] font-bold text-[#E07A5F]">
                  {fontSize === 'small' ? 'S' : fontSize === 'large' ? 'L' : 'M'}
                </span>
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#756A63]/5 text-[#756A63] transition-colors"
              >
                <span className="material-symbols-outlined">{shareSuccess ? 'check' : 'share'}</span>
              </button>
            </div>
          </nav>

          {loading ? (
            // Loading state
            <div className="px-8 pt-10 pb-6">
              <div className="animate-pulse">
                <div className="h-6 w-24 bg-[#E07A5F]/10 rounded-full mb-4"></div>
                <div className="h-12 w-3/4 bg-[#E07A5F]/5 rounded mb-6"></div>
                <div className="h-4 w-48 bg-[#E07A5F]/10 rounded"></div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="h-4 bg-[#E07A5F]/5 rounded w-full"></div>
                <div className="h-4 bg-[#E07A5F]/5 rounded w-5/6"></div>
                <div className="h-4 bg-[#E07A5F]/5 rounded w-4/6"></div>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="px-8 pt-10 pb-6 text-center">
              <span className="material-symbols-outlined text-[64px] text-[#E07A5F]/20 mb-4">error_outline</span>
              <h2 className="text-xl font-bold text-[#3D3430] mb-2">{error}</h2>
              <Link href="/dashboard" className="text-[#E07A5F] hover:underline">Return to Dashboard</Link>
            </div>
          ) : chapter ? (
            <>
              {/* AI-Generated Banner Image */}
              {chapter.bannerImageUrl && (
                <div className="relative w-full h-48 md:h-64 overflow-hidden">
                  <img
                    src={chapter.bannerImageUrl}
                    alt={chapter.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#FDFCF8] via-transparent to-transparent" />
                </div>
              )}

              {/* Hero Header */}
              <header className={`px-8 ${chapter.bannerImageUrl ? 'pt-6' : 'pt-10'} pb-6 relative`}>
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#E07A5F]/10 border border-[#E07A5F]/20 text-[#E07A5F] text-xs font-bold tracking-wider uppercase mb-4">
                    Chapter
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black text-[#3D3430] mb-6 leading-[1.1] font-display tracking-tight">
                    {chapter.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-[#756A63] font-medium">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                      <span>{formatDate(chapter.createdAt)}</span>
                    </div>
                    {chapter.content && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-[#756A63]/50"></span>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">timer</span>
                          <span>{Math.ceil(chapter.content.length / 1000)} min read</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="px-8 relative z-10">

                {/* Audio Player Card */}
                <section className="my-8 p-1 rounded-[2rem] bg-gradient-to-br from-white to-[#FDFCF8] border border-[#E07A5F]/10 shadow-xl shadow-[#E07A5F]/5 overflow-hidden">
                  <div className="bg-white/50 backdrop-blur-sm rounded-[1.8rem] p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${chapter.audioUrl ? 'bg-[#E07A5F]' : 'bg-[#E07A5F]/5'} flex items-center justify-center text-white shadow-lg ${chapter.audioUrl ? 'shadow-[#E07A5F]/30' : ''}`}>
                          <span className={`material-symbols-outlined filled text-2xl ${chapter.audioUrl ? 'text-white' : 'text-[#E07A5F]/40'}`}>{chapter.audioUrl ? 'mic' : 'volume_off'}</span>
                        </div>
                        <div>
                          <h3 className="text-[#3D3430] font-bold text-lg font-display">{chapter.audioUrl ? 'Original Recording' : 'Audio Recording'}</h3>
                          <p className="text-[#756A63] text-xs font-medium">{chapter.audioUrl ? 'Audio playback' : 'Not available for this story'}</p>
                        </div>
                      </div>

                      {chapter.audioUrl ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#E07A5F] bg-[#E07A5F]/10 px-2.5 py-1.5 rounded-lg border border-[#E07A5F]/20 tabular-nums transition-all">
                              {playbackSpeed.toFixed(1)}x
                            </span>
                            <button
                              onClick={toggleSpeed}
                              className="group/speed h-10 w-10 rounded-full bg-[#756A63]/5 hover:bg-[#756A63]/10 flex items-center justify-center text-[#756A63] transition-all"
                              title="Change playback speed"
                            >
                              <span className="material-symbols-outlined text-[20px] group-hover/speed:rotate-180 transition-transform duration-500">settings_motion</span>
                            </button>
                          </div>

                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="flex shrink-0 items-center justify-center rounded-full size-16 bg-gradient-to-br from-[#E07A5F] to-[#C66348] text-white shadow-xl shadow-[#E07A5F]/30 hover:scale-105 active:scale-95 transition-all ring-4 ring-white"
                          >
                            <span className={`material-symbols-outlined filled text-[32px] ml-0.5 ${isPlaying ? '' : 'ml-1'}`}>
                              {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#756A63]/50 text-sm font-medium bg-[#756A63]/5 px-3 py-1.5 rounded-full">
                          <span className="material-symbols-outlined text-[18px]">info</span>
                          <span>Text story only</span>
                        </div>
                      )}
                    </div>

                    {chapter.audioUrl && (
                      <>
                        {/* Seek Bar / Waveform Section */}
                        <div className="relative z-10 px-1 pb-2 h-12 flex items-center group/slider">
                          {/* Waveform Visualization */}
                          <div className="absolute inset-0 flex items-center justify-between gap-[3px] pointer-events-none px-1">
                            {waveformHeights.map((height, i) => {
                              const barPercent = (i / waveformHeights.length) * 100;
                              const isPlayed = barPercent <= progressPercent;
                              return (
                                <div
                                  key={i}
                                  className={`w-1.5 rounded-full transition-all duration-200 ${isPlayed ? 'bg-[#E07A5F]' : 'bg-[#E07A5F]/10'}`}
                                  style={{ height: `${height}%` }}
                                ></div>
                              );
                            })}
                          </div>

                          {/* Invisible Range Input for Interaction */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={progressPercent}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            aria-label="Seek audio"
                          />

                          {/* Scrubber Handle */}
                          <div
                            className="absolute h-full w-0.5 bg-transparent z-10 pointer-events-none transition-all duration-75"
                            style={{ left: `${progressPercent}%` }}
                          >
                            <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 bg-white rounded-full shadow-lg border border-[#E07A5F]/20 scale-0 group-hover/slider:scale-100 transition-transform flex items-center justify-center">
                              <div className="w-2.5 h-2.5 bg-[#E07A5F] rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <article className="mt-8 mb-12 relative">
                  <div className="absolute left-0 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-[#E07A5F]/20 to-transparent hidden md:block"></div>
                  <div className="md:pl-10">
                    {chapter.summary && (
                      <div className="relative my-10 p-8 rounded-3xl bg-white/60 border border-[#E07A5F]/10 shadow-sm overflow-hidden">
                        <div className="absolute -left-2 -top-4 text-[8rem] text-[#E07A5F]/5 font-serif leading-none select-none">"</div>
                        <p className="relative z-10 text-[1.5rem] leading-relaxed text-[#5C5552] italic font-serif font-medium text-center">
                          {chapter.summary}
                        </p>
                      </div>
                    )}
                    {chapter.content ? (
                      chapter.content.split('\n\n').map((paragraph, i) => (
                        <p key={i} className={`${getFontSizeClass()} leading-[1.8] text-[#3D3430] mb-8 font-serif transition-all duration-200 antialiased`}>
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className={`${getFontSizeClass()} leading-[1.8] text-[#756A63]/60 mb-8 font-serif italic`}>
                        Story content is being processed...
                      </p>
                    )}
                  </div>
                </article>

                {/* Entities / Tags */}
                {(chapter.tags && chapter.tags.length > 0) && (
                  <section className="py-8 border-t border-[#E07A5F]/10">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#E07A5F] mb-5 pl-1">Mentioned in this story</h2>
                    <div className="flex flex-wrap gap-3">
                      {chapter.tags.map((tag, i) => (
                        <button key={i} className="group flex items-center gap-3 pl-2 pr-5 py-2 rounded-full bg-white border border-[#E07A5F]/10 hover:border-[#E07A5F]/30 hover:shadow-md transition-all">
                          <div className="size-10 rounded-full bg-[#E07A5F]/10 flex items-center justify-center text-[#E07A5F] group-hover:bg-[#E07A5F] group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-xl filled">label</span>
                          </div>
                          <span className="text-lg font-medium text-[#5C5552] group-hover:text-[#3D3430] font-display">{tag}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </main>

              <div className="fixed bottom-0 inset-x-0 p-6 pb-8 bg-gradient-to-t from-[#FDFCF8] via-[#FDFCF8]/95 to-transparent z-50 pointer-events-none">
                <div className="pointer-events-auto max-w-3xl mx-auto flex gap-4 p-2.5 rounded-[1.5rem] bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="flex-1 flex items-center justify-center gap-2 h-16 rounded-2xl hover:bg-[#756A63]/5 text-[#756A63] font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">{isGeneratingPdf ? 'progress_activity' : 'download'}</span>
                    <span className="text-lg">{isGeneratingPdf ? 'Generating...' : 'PDF'}</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-[2] flex items-center justify-center gap-3 h-16 rounded-2xl bg-[#E07A5F] text-white font-bold hover:bg-[#C66348] active:scale-[0.98] transition-all shadow-lg shadow-[#E07A5F]/30 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="material-symbols-outlined text-[24px]">{shareSuccess ? 'check' : 'ios_share'}</span>
                    <span className="text-lg tracking-wide">{shareSuccess ? 'Link Copied!' : 'Share Story'}</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AuthGuard>
  );
}
