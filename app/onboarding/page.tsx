'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<'myself' | 'relative' | null>('myself');

  const handleContinue = () => {
    if (!selectedOption) return;
    const userType = selectedOption === 'myself' ? 'senior' : 'family';
    router.push(`/signup?type=${userType}`);
  };

  return (
    <div className="min-h-screen bg-[#FCF8F3] flex flex-col font-sans text-text-primary overflow-x-hidden">

      {/* Header / Progress bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl h-20 flex items-center border-b border-peach-main/10 shadow-sm transition-all">
        <div className="container mx-auto px-6 h-full flex justify-between items-center">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 group transform active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-gradient-to-br from-peach-warm to-terracotta rounded-xl flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-white text-2xl filled">mic</span>
            </div>
            <span className="text-2xl font-serif font-extrabold text-terracotta tracking-tight">Evermore</span>
          </Link>

          {/* Progress Indicator */}
          <div className="flex flex-col items-center flex-1 max-w-sm px-4">
            <p className="text-[10px] font-extrabold text-text-secondary uppercase tracking-[0.15em] mb-2.5">
              Step <span className="text-terracotta">1 of 3</span>: Whose stories are you preserving?
            </p>
            <div className="w-full h-2.5 bg-peach-main/20 rounded-full relative shadow-inner overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-peach-warm to-terracotta rounded-full flex items-center justify-end pr-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>

          {/* Navbar Links */}
          {/* Navbar Links - Hidden during onboarding to maintain focus */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/support" className="text-sm font-bold text-text-secondary hover:text-terracotta transition-colors">Support</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-48 pb-32 flex flex-col items-center">
        <div className="container max-w-6xl px-6 flex flex-col items-center">

          <div className="text-center mb-16 animate-fade-in max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-serif font-extrabold text-text-primary mb-6 leading-tight">
              Evermore Voice Companion Setup
            </h1>
            <p className="text-xl text-text-secondary font-medium leading-relaxed opacity-80">
              Immortalize family stories from speech to text to books. Who is this companion for? Select the option that best describes your journey.
            </p>
          </div>

          {/* Choice Cards */}
          <div className="grid md:grid-cols-2 gap-12 w-full max-w-5xl mb-20">

            {/* Option: Myself */}
            <div
              onClick={() => setSelectedOption('myself')}
              className={`
                relative group cursor-pointer rounded-[2.5rem] p-4 bg-white border-4 transition-all duration-500 shadow-2xl shadow-peach-warm/10 transform hover:-translate-y-2
                ${selectedOption === 'myself' ? 'border-[#D4A373] ring-8 ring-peach-main/10' : 'border-transparent hover:border-peach-main/40'}
              `}
            >
              <div className={`overflow-hidden rounded-[2.2rem] h-full flex flex-col items-center text-center pb-12 transition-all ${selectedOption === 'myself' ? 'bg-white' : 'bg-transparent'}`}>
                {/* Visual Label for Selection */}
                <div className={`w-full py-4 mb-4 text-center transition-all ${selectedOption === 'myself' ? 'bg-[#D4A373]/90 text-white' : 'bg-transparent text-text-primary'}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-bold uppercase tracking-widest">{selectedOption === 'myself' ? 'Myself' : 'Myself'}</span>
                    {selectedOption === 'myself' && <span className="material-symbols-outlined text-white text-xl filled">check_circle</span>}
                  </div>
                </div>

                <div className="w-64 h-64 mb-6 relative rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 duration-700">
                  <div className="absolute inset-0 bg-peach-main/10 scale-95 rounded-full"></div>
                  <Image
                    src="/images/illustration_myself.png"
                    alt="Myself"
                    fill
                    className="object-cover p-2"
                  />
                </div>
                <div className="px-10">
                  <p className="text-lg text-text-secondary font-serif font-bold italic leading-relaxed opacity-70">
                    Create your own memoir and preserve your legacy for generations.
                  </p>
                </div>
              </div>
            </div>

            {/* Option: Relative */}
            <div
              onClick={() => setSelectedOption('relative')}
              className={`
                relative group cursor-pointer rounded-[2.5rem] p-4 bg-white border-4 transition-all duration-500 shadow-2xl shadow-peach-warm/10 transform hover:-translate-y-2
                ${selectedOption === 'relative' ? 'border-[#D4A373] ring-8 ring-peach-main/10' : 'border-transparent hover:border-peach-main/40'}
              `}
            >
              <div className={`overflow-hidden rounded-[2.2rem] h-full flex flex-col items-center text-center pb-12 transition-all ${selectedOption === 'relative' ? 'bg-white' : 'bg-transparent'}`}>
                {/* Visual Label for Selection */}
                <div className={`w-full py-4 mb-4 text-center border-b border-peach-main/10 transition-all ${selectedOption === 'relative' ? 'bg-[#D4A373]/90 text-white' : 'bg-transparent text-text-primary'}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-bold uppercase tracking-widest">{selectedOption === 'relative' ? 'A Relative' : 'A Relative'}</span>
                    {selectedOption === 'relative' && <span className="material-symbols-outlined text-white text-xl filled">check_circle</span>}
                  </div>
                </div>

                <div className="w-64 h-64 mb-6 relative rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 duration-700">
                  <div className="absolute inset-0 bg-peach-main/10 scale-95 rounded-full"></div>
                  <Image
                    src="/images/illustration_relative.png"
                    alt="A Relative"
                    fill
                    className="object-cover p-2"
                  />
                </div>
                <div className="px-10">
                  <p className="text-lg text-text-secondary font-serif font-bold italic leading-relaxed opacity-70">
                    Capture the stories of a loved one and create a family heirloom.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Continue Action */}
          <div className="flex flex-col items-center animate-fade-in [animation-delay:0.3s]">
            <button
              onClick={handleContinue}
              disabled={!selectedOption}
              className="bg-[#D4A373] hover:bg-[#C18E5E] text-white text-2xl font-extrabold py-5 px-24 rounded-full shadow-2xl shadow-peach-warm/30 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest"
            >
              Continue
            </button>
            <p className="mt-10 text-sm font-bold text-text-secondary uppercase tracking-[0.2em] opacity-40">
              You can change your persona at any time in settings.
            </p>
          </div>

        </div>
      </main>

      {/* Footer Links */}
      <footer className="py-12 border-t border-peach-main/10 flex flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-10 text-sm font-bold text-text-secondary opacity-50 tracking-wide">
          <Link href="/about" className="hover:text-terracotta transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-terracotta transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-terracotta transition-colors">Terms of Service</Link>
          <Link href="/contact" className="hover:text-terracotta transition-colors">Contact Us</Link>
        </div>
      </footer>

      {/* Decorative Blob */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-gradient-to-br from-peach-main/5 down-to-white rounded-full blur-[120px] -z-10 pointer-events-none opacity-50"></div>

    </div>
  );
}

