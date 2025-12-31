'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Download } from 'lucide-react';

interface StorybookPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
}

interface Storybook {
  title: string;
  pages: StorybookPage[];
  pdfUrl?: string;
}

interface StorybookViewerProps {
  storybook: Storybook;
}

export function StorybookViewer({ storybook }: StorybookViewerProps) {
  const [currentPage, setCurrentPage] = useState(-1);

  // Cover page is index -1, pages are 0 to N-1
  const totalPages = storybook.pages.length;

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > -1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const isCover = currentPage === -1;
  const pageData = !isCover ? storybook.pages[currentPage] : null;

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4">
      <div className="w-full aspect-video bg-secondary rounded-lg shadow-2xl overflow-hidden relative">
        {/* Book Content */}
        <div className="absolute inset-0 flex">
          {isCover ? (
            <div className="flex flex-col items-center justify-center w-full h-full bg-primary text-white p-8 text-center animate-fade-in">
              <h1 className="text-4xl md:text-6xl font-bold mb-4 font-serif">{storybook.title}</h1>
              <p className="text-xl md:text-2xl opacity-90">A Story for the Grandkids</p>
              <BookOpen className="w-16 h-16 mt-8 opacity-80" />
            </div>
          ) : (
            <div className="flex w-full h-full bg-white animate-fade-in">
              {/* Left: Image */}
              <div className="w-1/2 bg-gray-100 flex items-center justify-center border-r border-gray-200">
                {pageData?.imageUrl ? (
                  <img src={pageData.imageUrl} alt="Story illustration" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-gray-400">Illustrating...</div>
                )}
              </div>
              {/* Right: Text */}
              <div className="w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <p className="text-xl md:text-3xl font-medium text-text-main leading-relaxed font-serif">
                  {pageData?.text}
                </p>
                <span className="mt-8 text-sm text-text-muted">Page {pageData?.pageNumber}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Overlays */}
        <button
          onClick={handlePrev}
          disabled={currentPage === -1}
          aria-label="Previous page"
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white rounded-full disabled:opacity-0 transition-all"
        >
          <ChevronLeft className="w-8 h-8 text-gray-800" />
        </button>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages - 1} // Can go to last page
          aria-label="Next page"
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white rounded-full disabled:opacity-0 transition-all"
        >
          <ChevronRight className="w-8 h-8 text-gray-800" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex justify-between w-full mt-6 items-center">
        <div className="text-text-muted font-medium">
          {isCover ? "Cover" : `Page ${currentPage + 1} of ${totalPages}`}
        </div>

        <div className="flex gap-4">
          {storybook.pdfUrl && (
            <Button variant="outline" onClick={() => window.open(storybook.pdfUrl, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
