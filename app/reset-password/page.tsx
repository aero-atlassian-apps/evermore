'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error('Request failed');

      setSuccess(true);
    } catch (err) {
      setError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF8F3] flex flex-col font-sans text-text-primary selection:bg-gold/20 relative overflow-hidden">

      {/* Elegant Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gold/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-terracotta/5 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4"></div>
      </div>

      {/* Minimalist Header */}
      <header className="w-full p-8 md:p-12 flex justify-center relative z-10 animate-fade-in">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-gradient-to-br from-gold to-terracotta rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-500">
            <span className="material-symbols-outlined text-white text-2xl">history_edu</span>
          </div>
          <span className="text-3xl font-serif font-bold text-text-primary tracking-tight">Evermore</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="bg-white rounded-[3rem] shadow-subtle p-10 md:p-16 w-full max-w-xl text-center border border-gold/10 animate-slide-up">

          {!success ? (
            <>
              <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center text-gold mx-auto mb-10">
                <span className="material-symbols-outlined text-4xl">key_off</span>
              </div>

              <h1 className="text-4xl font-serif font-bold text-text-primary mb-6 leading-tight">
                Forgotten Your Legacy?
              </h1>

              <p className="text-text-secondary font-medium mb-12 leading-relaxed max-w-sm mx-auto">
                Don't worry, even the greatest stories have pauses. Enter your email and we'll help you reconnect with your memories.
              </p>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="text-left space-y-2">
                  <label className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] ml-6">Email Address</label>
                  <div className="relative group">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-8 py-5 rounded-2xl border border-gold/10 bg-background-cream text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/10 focus:border-terracotta/40 transition-all font-medium"
                      required
                    />
                    <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-gold/30 group-focus-within:text-terracotta transition-colors">alternate_email</span>
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm font-bold animate-pulse">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-gold to-terracotta hover:from-terracotta hover:to-sienna text-white font-bold text-lg py-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                      Sending Instruction...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-2xl">send</span>
                      Send Reset Instructions
                    </>
                  )}
                </button>
              </form>

              <div className="mt-12 pt-8 border-t border-gold/10">
                <Link href="/login" className="inline-flex items-center gap-2 text-text-muted font-bold text-sm hover:text-terracotta transition-colors group">
                  <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                  Return to Login
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-600 mx-auto mb-10 shadow-inner">
                <span className="material-symbols-outlined text-5xl">mark_email_read</span>
              </div>
              <h1 className="text-4xl font-serif font-bold text-text-primary mb-6 leading-tight">
                Check Your Inbox
              </h1>
              <p className="text-text-secondary font-medium mb-12 leading-relaxed max-w-sm mx-auto">
                If <span className="text-text-primary font-bold">{email}</span> is registered with Evermore, instructions to reset your password are on their way.
              </p>
              <div className="space-y-4">
                <Link href="/login" className="block w-full bg-background-cream hover:bg-gold/5 text-text-primary border border-gold/10 font-bold text-lg py-4 px-8 rounded-2xl transition-all">
                  Return to Login
                </Link>
                <p className="text-xs text-text-muted font-medium">Wait a few minutes before requesting another link.</p>
              </div>
            </>
          )}

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="w-full p-12 text-center text-text-muted text-[10px] font-bold uppercase tracking-[0.2em] relative z-10 flex flex-wrap justify-center gap-8">
        <Link href="#" className="hover:text-terracotta transition-colors">Privacy Principles</Link>
        <Link href="#" className="hover:text-terracotta transition-colors">Legacy Terms</Link>
        <Link href="#" className="hover:text-terracotta transition-colors">Contact Support</Link>
        <span className="text-gold/30 opacity-50">•</span>
        <span>© 2024 Evermore Legacy Inc.</span>
      </footer>

    </div>
  );
}
