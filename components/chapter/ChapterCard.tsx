import Link from 'next/link';
import { Chapter } from '@/lib/core/domain/entities/Chapter';
import { formatDistanceToNow } from 'date-fns';

export function ChapterCard({ chapter }: { chapter: Chapter }) {
  // Defensive check for dates
  const createdAt = chapter.createdAt ? new Date(chapter.createdAt) : new Date();

  return (
    <Link href={`/chapter/${chapter.id}`}>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden group">
        {/* Cover Image or Fallback */}
        <div className="relative h-40 bg-gradient-to-br from-peach-light to-peach-main/30 overflow-hidden">
          {chapter.coverImageUrl ? (
            <img
              src={chapter.coverImageUrl}
              alt={chapter.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-60">📖</span>
            </div>
          )}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {chapter.title}
          </h3>

          <p className="text-sm text-neutral-500 mb-3">
            {formatDistanceToNow(createdAt, { addSuffix: true })} • {chapter.metadata?.wordCount || 0} words
          </p>

          <p className="text-neutral-600 text-sm line-clamp-2 mb-4">
            {chapter.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-primary-500 font-medium text-sm group-hover:underline">
              Read Chapter →
            </span>

            {chapter.audioHighlightUrl && (
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <span>🎵</span>
                <span>{chapter.audioDuration ? `${Math.floor(chapter.audioDuration / 60)}:${(chapter.audioDuration % 60).toString().padStart(2, '0')}` : '0:00'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

