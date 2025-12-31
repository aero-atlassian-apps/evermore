import { create } from 'zustand';
import { Chapter } from '@/lib/core/domain/entities/Chapter';

interface ChapterStore {
  chapters: Chapter[];
  selectedChapter?: Chapter;
  filter: {
    search: string;
    tags: string[];
  };

  // Actions
  setChapters: (chapters: Chapter[]) => void;
  selectChapter: (chapterId: string) => void;
  setSearch: (search: string) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
}

export const useChapterStore = create<ChapterStore>((set) => ({
  chapters: [],
  selectedChapter: undefined,
  filter: {
    search: '',
    tags: []
  },

  setChapters: (chapters) => set({ chapters }),

  selectChapter: (chapterId) => set((state) => ({
    selectedChapter: state.chapters.find((c) => c.id === chapterId)
  })),

  setSearch: (search) => set((state) => ({
    filter: { ...state.filter, search }
  })),

  toggleTag: (tag) => set((state) => ({
    filter: {
      ...state.filter,
      tags: state.filter.tags.includes(tag)
        ? state.filter.tags.filter((t) => t !== tag)
        : [...state.filter.tags, tag]
    }
  })),

  clearFilters: () => set({
    filter: { search: '', tags: [] }
  })
}));
