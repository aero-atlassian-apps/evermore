import React from 'react';

export function BackgroundBlobs() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#FAF7F2]">
            {/* Warmer, deeper background base */}

            {/* Top Right Warmth - Terracotta/Orange */}
            <div className="absolute top-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-[#E07A5F]/15 rounded-full blur-[120px] opacity-70 animate-pulse-slow"></div>

            {/* Bottom Left Warmth - Sand/Gold */}
            <div className="absolute bottom-[10%] left-[-20%] w-[45rem] h-[45rem] bg-[#F2CC8F]/25 rounded-full blur-[120px] opacity-70 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* Bottom Right - subtle depth */}
            <div className="absolute bottom-[-20%] right-[10%] w-[40rem] h-[40rem] bg-[#E07A5F]/10 rounded-full blur-[100px] opacity-50 animate-pulse-slow" style={{ animationDelay: '4s' }}></div>

            {/* Overlay Texture for "Paper" feel if desired, kept subtle */}
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        </div>
    );
}
