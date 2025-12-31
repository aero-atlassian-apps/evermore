'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';

interface Chapter {
   id: string;
   title: string;
   createdAt: string;
   imageUrl?: string;
}

export default function DashboardPage() {
   const [chapters, setChapters] = useState<Chapter[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');
   const [user, setUser] = useState<{ displayName: string; userId: string } | null>(null);

   useEffect(() => {
      async function fetchData() {
         try {
            const profileRes = await fetch('/api/users/profile');
            if (!profileRes.ok) throw new Error('Failed to fetch profile');
            const profileData = await profileRes.json();

            // SECURITY: Enforce Persona
            if (profileData.role !== 'senior') {
               window.location.href = '/family'; // Redirect family members to their portal
               return;
            }

            setUser(profileData);

            const chaptersRes = await fetch(`/api/users/${profileData.userId}/chapters`);
            if (chaptersRes.ok) {
               const chaptersData = await chaptersRes.json();
               setChapters(chaptersData);
            }
         } catch (err: any) {
            console.error('Error fetching dashboard data:', err);
            setError(err.message || 'Failed to load dashboard');
         } finally {
            setLoading(false);
         }
      }
      fetchData();
   }, []);

   const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
   }).toUpperCase();

   const greeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 17) return 'Good Afternoon';
      return 'Good Evening';
   };

   return (
      <div className="min-h-screen bg-[#FCF8F3] font-sans text-text-primary overflow-x-hidden">



         <main className="max-w-7xl mx-auto pt-20 pb-12 min-h-[80vh] flex flex-col justify-center px-6">

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

               {/* Left: Greeting & Recording */}
               <div className="flex flex-col items-center lg:items-center text-center space-y-12 animate-fade-in">
                  <div className="space-y-4">
                     <p className="text-[14px] font-bold text-text-muted tracking-[0.3em] uppercase">
                        {today}
                     </p>
                     <h1 className="text-5xl md:text-7xl font-serif font-extrabold text-text-primary leading-tight">
                        {greeting()}, <br />
                        <span className="text-terracotta">{user?.displayName?.toLowerCase() || 'family-1'}</span>
                     </h1>
                  </div>

                  {/* Enhanced Mic Button */}
                  <div className="relative group perspective-1000">
                     {/* Layered Ripples */}
                     <div className="absolute inset-0 rounded-full bg-terracotta/20 animate-ripple scale-75"></div>
                     <div className="absolute inset-0 rounded-full bg-peach-warm/30 animate-ripple scale-50 [animation-delay:1.5s]"></div>
                     <div className="absolute -inset-10 rounded-full bg-terracotta/5 animate-glow-soft blur-2xl"></div>

                     <Link
                        href="/conversation"
                        className="relative w-48 h-48 bg-gradient-to-br from-peach-warm to-terracotta rounded-full flex items-center justify-center shadow-2xl shadow-terracotta/30 group-hover:scale-105 transition-all duration-500 active:scale-95 border-8 border-white group"
                     >
                        <span className="material-symbols-outlined text-white text-7xl filled group-hover:scale-110 transition-transform duration-500">mic</span>

                        {/* Hover Touch Indicator */}
                        <div className="absolute bottom-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="material-symbols-outlined text-white text-sm">touch_app</span>
                        </div>
                     </Link>
                  </div>

                  <p className="text-text-secondary font-bold text-sm tracking-wide opacity-80">
                     Tap the microphone to start recording
                  </p>
               </div>

               {/* Right: Recent Memories Card */}
               <div className="animate-fade-in [animation-delay:0.3s]">
                  <div className="flex justify-between items-center mb-6">
                     <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-terracotta filled">menu_book</span>
                        <h2 className="text-xl font-serif font-extrabold text-text-primary italic">Recent Memories</h2>
                     </div>
                     <Link
                        href="/stories"
                        className="px-6 py-2 bg-peach-main text-terracotta rounded-full text-xs font-bold hover:bg-terracotta hover:text-white transition-all shadow-sm"
                     >
                        View All
                     </Link>
                  </div>

                  {/* Large Warm Card */}
                  <div className="bg-[#FFF8F1] rounded-[3rem] border border-peach-main/20 p-8 lg:p-12 shadow-inner-soft min-h-[400px] flex flex-col">
                     {loading ? (
                        <div className="flex-grow flex items-center justify-center">
                           <span className="material-symbols-outlined animate-spin text-peach-warm text-5xl">sync</span>
                        </div>
                     ) : chapters.length === 0 ? (
                        <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
                           <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm flex items-center justify-center text-peach-warm">
                              <span className="material-symbols-outlined text-4xl filled">library_books</span>
                           </div>
                           <div className="space-y-2">
                              <h3 className="text-2xl font-serif font-extrabold text-text-primary">No stories recorded yet</h3>
                              <p className="text-text-secondary text-base font-medium max-w-[280px]">
                                 Your family history book is waiting for its first chapter.
                              </p>
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-6">
                           {chapters.slice(0, 3).map((chapter) => (
                              <Link
                                 key={chapter.id}
                                 href={`/stories/${chapter.id}`}
                                 className="flex items-center gap-6 p-4 bg-white/60 hover:bg-white border border-transparent hover:border-peach-main/30 rounded-3xl transition-all group"
                              >
                                 <div className="w-20 h-20 rounded-2xl overflow-hidden relative shadow-sm border-2 border-white">
                                    <Image
                                       src={chapter.imageUrl || "/images/hero_grandma.png"}
                                       alt={chapter.title}
                                       fill
                                       className="object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                 </div>
                                 <div className="flex-1">
                                    <h4 className="font-serif font-extrabold text-lg text-text-primary mb-1">
                                       {chapter.title || 'Untitled Memory'}
                                    </h4>
                                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                       {new Date(chapter.createdAt).toLocaleDateString()}
                                    </p>
                                 </div>
                                 <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-muted group-hover:text-terracotta shadow-sm transition-colors">
                                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                                 </div>
                              </Link>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

            </div>
         </main>

         {/* Footer */}

      </div>
   );
}

