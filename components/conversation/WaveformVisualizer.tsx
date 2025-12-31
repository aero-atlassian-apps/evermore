'use client';

import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  isActive: boolean;
}

export function WaveformVisualizer({ isActive }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = 40;
    const barWidth = canvas.width / bars;

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < bars; i++) {
        const barHeight = isActive
          ? Math.random() * canvas.height * 0.7 + 10
          : canvas.height * 0.1;

        const x = i * barWidth;
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = '#0ea5e9'; // primary-500
        ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [isActive]);

  return (
    <div className="bg-primary-50 rounded-lg p-6">
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        className="w-full h-30"
      />
    </div>
  );
}
