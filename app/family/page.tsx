'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '@/components/layout/AppShell';

interface Chapter {
   id: string;
   title: string;
   content: string;
   createdAt: string;
   imageUrl?: string;
}

import { UserProfileDTO } from '@/lib/core/dtos/UserProfile';
interface UserProfile extends UserProfileDTO { }

// Fallback images for chapters without images
const FALLBACK_IMAGES = [
   "https://lh3.googleusercontent.com/aida-public/AB6AXuDmaBwnfZ0jlqigJaix5kYuz0Rq0JHiiTFWAmZz4VPJF6Ly17lEUbdA0f6lzKqpivxd9bk0hxEHldS4uLelKsew9eey3VqugEZGhIttfhgQX4YXqIRTg1o8d0pPtsr3VOn81miKv41Dyimh4u8jWF8VYlNLH5F_f_brWOxnn_3kMfqT8tm2lGSw91Yrgzqzi2mTudG7RRV5KjXpEB6YYRtiqh9MUis0D6t_PWL63vPdYl-a3tMDYd3svcfefhAEbQjpkwUJO5ov7TA",
   "https://lh3.googleusercontent.com/aida-public/AB6AXuAvAvQ9RC6JGyrS_gKf5mBpeubVvJTaP6dIKRZZm2hTVl7nJDrSJn0ojobwYp5svDgODckSByJRv77gG-7Z6g8QCcyAXnjuZUoF4NhkfnIlZdPJaQXcn9Wksp1-bzUBlx33mfu4vMXzcWpEcv2eT4MFjDgJY95cc0hTz6dPlxTZRzyzZ51D-yIKN9YkCyuCmXW80ZU7qd6FWMsT4RCyio3w8Gk9q99dahFMggN0AEbFTXPc-JzjKLq1iapARDauoKc_VGSCdu3nsy0",
   "https://lh3.googleusercontent.com/aida-public/AB6AXuB1uP1kSbs-YHxcRRKPQopZgwbhcqd-OfV8P0JrEilZJ6d_MmtpwteqqCFrS09Q42HGgucZEzlRqrDw6CAs74McFJHqJkHdzYog-YbhFkTO1qHSgT7jU1aPst3JFdZMLpK0uhsO-fpGuP6dQlhXbWnneamYLEh5bj5J103mTH68DHis7_ptRygyMo6Ba4dBTpQ1I-JTrIhbL6VJ6omN1qv0nDoO2BsRHuJoeymP9P6guBTPvFRJRds9KJTeehLCXGmQfB7YszQpNBo",
];

const TARGET_CHAPTERS = 12;

function formatRelativeDate(dateString: string): string {
   const date = new Date(dateString);
   const now = new Date();
   const diffMs = now.getTime() - date.getTime();
   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

   if (diffDays === 0) return 'Added today';
   if (diffDays === 1) return 'Added yesterday';
   if (diffDays < 7) return `Added ${diffDays} days ago`;
   return `Added ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function FamilyPortalPage() {
   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [chapters, setChapters] = useState<Chapter[]>([]);
   const [topicsToAvoid, setTopicsToAvoid] = useState<string[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');
   const [exporting, setExporting] = useState(false);
   const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

   // Toggle story selection for storybook creation
   const toggleSelection = (id: string) => {
      setSelectedIds(prev => {
         const next = new Set(prev);
         if (next.has(id)) {
            next.delete(id);
         } else {
            next.add(id);
         }
         return next;
      });
   };

   const handleCreateStorybook = () => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      window.location.href = `/storybook/create?ids=${ids.join(',')}`;
   };

   // Export Book as PDF
   const handleExportBook = async () => {
      if (exporting || chapters.length === 0) return;

      setExporting(true);
      setExportStatus('idle');

      try {
         const res = await fetch('/api/storybooks/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
         });

         if (!res.ok) throw new Error('Export failed');

         // Download the PDF
         const blob = await res.blob();
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `storybook-${new Date().toISOString().split('T')[0]}.pdf`;
         document.body.appendChild(a);
         a.click();
         a.remove();
         window.URL.revokeObjectURL(url);

         setExportStatus('success');
         setTimeout(() => setExportStatus('idle'), 3000);
      } catch (err) {
         console.error('Export error:', err);
         setExportStatus('error');
         setTimeout(() => setExportStatus('idle'), 3000);
      } finally {
         setExporting(false);
      }
   };

   useEffect(() => {
      async function fetchData() {
         try {
            // 1. Fetch user profile
            const profileRes = await fetch('/api/users/profile');
            if (!profileRes.ok) {
               throw new Error('Failed to fetch profile');
            }
            const profileData = await profileRes.json();

            // SECURITY: Enforce Persona
            if (profileData.role !== 'family') {
               window.location.href = '/dashboard'; // Redirect seniors to their dashboard
               return;
            }

            setProfile(profileData);
            setTopicsToAvoid(profileData.preferences?.topicsAvoid || []);

            // 2. Fetch chapters via family endpoint
            if (profileData.userId) {
               const chaptersRes = await fetch(`/api/family/chapters?userId=${profileData.userId}`);
               if (chaptersRes.ok) {
                  const chaptersData = await chaptersRes.json();
                  setChapters(chaptersData.chapters || []);
               }
            }
         } catch (err: any) {
            console.error('Error fetching family portal data:', err);
            setError(err.message || 'Failed to load data');
         } finally {
            setLoading(false);
         }
      }
      fetchData();
   }, []);

   // Note: Topics to Avoid are managed by the senior, family members can only view them

   // Calculate book progress
   const bookProgress = {
      current: chapters.length,
      target: TARGET_CHAPTERS,
      percentage: Math.round((chapters.length / TARGET_CHAPTERS) * 100),
   };

   // Get latest updates (most recent 3 chapters)
   const latestUpdates = chapters
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

   // Get recent photos from chapters
   const recentPhotos = chapters
      .filter(ch => ch.imageUrl)
      .slice(0, 4)
      .map((ch, i) => ({
         src: ch.imageUrl || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
         label: ch.title?.substring(0, 15) || 'Memory',
      }));

   // Add fallback photos if not enough real ones
   while (recentPhotos.length < 4) {
      recentPhotos.push({
         src: FALLBACK_IMAGES[recentPhotos.length % FALLBACK_IMAGES.length],
         label: 'Memory',
      });
   }

   if (loading) {
      return (
         <AppShell userType="family" showNav={true}>
            <div className="flex items-center justify-center min-h-[50vh]">
               <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-text-secondary-light">Loading family portal...</p>
               </div>
            </div>
         </AppShell>
      );
   }

   if (error) {
      return (
         <AppShell userType="family" showNav={true}>
            <div className="flex items-center justify-center min-h-[50vh]">
               <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4">
                     <span className="material-symbols-outlined text-3xl">error</span>
                  </div>
                  <p className="text-text-secondary-light">{error}</p>
               </div>
            </div>
         </AppShell>
      );
   }

   return (
      <AppShell userType="family" showNav={true}>

         {/* Hero Section: Warm & Illustrative */}
         <div className="relative w-full rounded-[3rem] overflow-hidden mb-16 bg-[#F3E5D8]/40 border border-[#E8D4C0] animate-fade-in shadow-inner-soft">
            <div className="relative z-10 px-8 py-16 md:px-20 flex flex-col md:flex-row justify-between items-center gap-10">
               <div className="text-center md:text-left">
                  <h1 className="text-5xl md:text-7xl font-serif font-extrabold text-text-primary mb-4 leading-tight">
                     {profile?.displayName ? `${profile.displayName} Portal` : 'Arthur Portal'}
                  </h1>
                  <p className="text-text-secondary text-xl font-medium max-w-xl leading-relaxed opacity-80">
                     Immortalizing our family's stories, one conversation at a time.
                  </p>
               </div>
               <div className="flex-shrink-0">
                  <button
                     disabled
                     className="bg-terracotta/50 text-white px-10 py-5 rounded-full font-bold shadow-xl shadow-terracotta/10 cursor-not-allowed opacity-70"
                     title="Coming soon - Feature in development"
                  >
                     Invite Family (Coming Soon)
                  </button>
               </div>
            </div>

            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-peach-main/20 to-transparent pointer-events-none"></div>
         </div>

         {/* Layout Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

            {/* Left Column: Updates & Topics */}
            <div className="lg:col-span-7 space-y-16 animate-fade-in [animation-delay:0.1s]">

               {/* Latest Updates */}
               <section>
                  <h2 className="text-3xl font-serif font-extrabold text-text-primary mb-8 italic">Latest Updates</h2>

                  {latestUpdates.length === 0 ? (
                     <div className="bg-white/50 border border-peach-main/10 rounded-[2rem] p-12 text-center shadow-sm">
                        <p className="text-text-secondary font-medium italic opacity-60">No stories recorded yet. Check back soon!</p>
                     </div>
                  ) : (
                     <div className="space-y-6">
                        {latestUpdates.map((chapter, index) => (
                           <div
                              key={chapter.id}
                              className={`relative bg-[#E8C5A4]/40 hover:bg-[#E8C5A4]/60 border rounded-[2rem] p-4 shadow-sm transition-all duration-300 ${selectedIds.has(chapter.id) ? 'border-terracotta ring-2 ring-terracotta/30' : 'border-white/50'}`}
                           >
                              {/* Selection Checkbox */}
                              <button
                                 onClick={() => toggleSelection(chapter.id)}
                                 className={`absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedIds.has(chapter.id)
                                    ? 'bg-terracotta text-white scale-110'
                                    : 'bg-white/90 text-text-muted hover:bg-white'
                                    } shadow-lg`}
                              >
                                 <span className="material-symbols-outlined text-lg">
                                    {selectedIds.has(chapter.id) ? 'check' : 'add'}
                                 </span>
                              </button>

                              <div className="flex items-center gap-6">
                                 <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/50 flex-shrink-0 border-2 border-white shadow-sm">
                                    <Image
                                       src={chapter.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}
                                       alt={chapter.title}
                                       width={120}
                                       height={120}
                                       className="w-full h-full object-cover"
                                    />
                                 </div>
                                 <div className="flex-1">
                                    <h3 className="text-xl font-serif font-extrabold text-text-primary mb-1">
                                       {chapter.title || 'Untitled Memory'}
                                    </h3>
                                    <p className="text-sm font-bold text-text-muted uppercase tracking-widest opacity-70 mb-3">
                                       {formatRelativeDate(chapter.createdAt)}
                                    </p>
                                    <div className="flex gap-3">
                                       <Link
                                          href={`/stories/${chapter.id}`}
                                          className="inline-flex items-center gap-1 text-xs font-bold text-terracotta hover:underline"
                                       >
                                          <span className="material-symbols-outlined text-sm">visibility</span>
                                          Read Story
                                       </Link>
                                       <Link
                                          href={`/storybook/${chapter.id}`}
                                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                                       >
                                          <span className="material-symbols-outlined text-sm">auto_stories</span>
                                          View as Storybook
                                       </Link>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </section>

               {/* Topics to Avoid */}
               <section>
                  <h2 className="text-3xl font-serif font-extrabold text-text-primary mb-8 italic">Topics to Avoid</h2>

                  <div className="space-y-6">
                     <div className="flex flex-wrap gap-3">
                        {topicsToAvoid.length === 0 ? (
                           <p className="text-text-muted font-medium italic">No topics restricted yet.</p>
                        ) : (
                           topicsToAvoid.map(topic => (
                              <span key={topic} className={`px-6 py-2 rounded-full text-sm font-bold shadow-sm border transition-all ${topic === 'Politics' ? 'bg-[#FDE2D0] border-peach-main/50 text-terracotta' : 'bg-[#F3E5D8]/50 border-transparent text-text-secondary'
                                 }`}>
                                 {topic}
                              </span>
                           ))
                        )}
                     </div>

                     {/* Info: Topics managed by senior */}
                     <p className="text-xs text-text-muted italic opacity-60 mt-4">
                        Topics are managed by the storyteller in their settings.
                     </p>
                  </div>
               </section>

            </div>

            {/* Right Column: Progress & Media */}
            <div className="lg:col-span-5 space-y-16 animate-fade-in [animation-delay:0.2s]">

               {/* Book Progress */}
               <section>
                  <h2 className="text-3xl font-serif font-extrabold text-text-primary mb-8 italic">Book Progress</h2>
                  <div className="bg-white rounded-[3rem] p-10 shadow-xl shadow-peach-warm/10 border border-peach-main/10 text-center relative overflow-hidden">
                     <div className="flex items-baseline justify-center gap-4 mb-8">
                        <span className="text-[120px] font-serif font-extrabold text-[#D5B59C] leading-none">{bookProgress.current}</span>
                        <div className="text-left">
                           <span className="block text-xl font-bold text-text-primary">of {bookProgress.target} stories</span>
                           <span className="text-2xl font-extrabold text-text-primary">{bookProgress.percentage}%</span>
                        </div>
                     </div>

                     <div className="w-full h-4 bg-[#F3E5D8]/50 rounded-full overflow-hidden mb-10 shadow-inner">
                        <div
                           className="h-full bg-gradient-to-r from-[#8DB6A8] to-terracotta rounded-full transition-all duration-1000"
                           style={{ width: `${Math.min(bookProgress.percentage, 100)}%` }}
                        ></div>
                     </div>

                     <button
                        onClick={handleExportBook}
                        disabled={exporting || chapters.length === 0}
                        className="w-full py-5 rounded-2xl font-bold bg-[#D68D5B] text-white hover:bg-sienna shadow-xl shadow-terracotta/20 transition-all active:scale-95 disabled:opacity-50"
                     >
                        {exporting ? 'Exporting...' : 'Export Book (PDF)'}
                     </button>
                  </div>
               </section>

               {/* Recent Photos */}
               <section>
                  <h2 className="text-3xl font-serif font-extrabold text-text-primary mb-8 italic">Recent Photos</h2>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                     {recentPhotos.map((photo, i) => (
                        <div key={i} className="group">
                           <div className="aspect-square rounded-[2rem] overflow-hidden shadow-sm border-4 border-white transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
                              <Image
                                 src={photo.src}
                                 alt={photo.label}
                                 width={300}
                                 height={300}
                                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                           </div>
                           <p className="mt-3 text-sm font-bold text-text-secondary opacity-60 px-2">{photo.label}</p>
                        </div>
                     ))}
                  </div>

                  <div className="flex justify-end">
                     <Link href="/stories" className="flex items-center gap-2 text-text-primary font-bold hover:text-terracotta transition-colors">
                        View All <span className="material-symbols-outlined text-sm">expand_less</span>
                     </Link>
                  </div>
               </section>

            </div>
         </div>


         {selectedIds.size > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
               <div className="bg-white rounded-full shadow-2xl shadow-black/20 border border-peach-main/20 px-8 py-4 flex items-center gap-6">
                  <span className="text-sm font-bold text-text-primary">
                     {selectedIds.size} {selectedIds.size === 1 ? 'story' : 'stories'} selected
                  </span>
                  <button
                     onClick={() => setSelectedIds(new Set())}
                     className="text-text-muted hover:text-text-primary transition-colors"
                  >
                     <span className="material-symbols-outlined">close</span>
                  </button>
                  <button
                     onClick={handleCreateStorybook}
                     className="bg-gradient-to-r from-terracotta to-peach-warm text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all"
                  >
                     <span className="material-symbols-outlined">auto_stories</span>
                     Create Storybook
                  </button>
               </div>
            </div>
         )}
      </AppShell>
   );
}
