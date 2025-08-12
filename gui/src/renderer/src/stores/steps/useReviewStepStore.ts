import { create } from 'zustand';
import { ReviewStepData, Subtitle, EditState } from '../types/StoreTypes';

interface ReviewStepState {
  data: ReviewStepData;
  actions: {
    updateReviewStep: (content: Partial<ReviewStepData>) => void;
    resetReviewStep: () => void;
    setSubtitles: (subtitles: Subtitle[]) => void;
    setCurrentEdit: (edit: EditState | undefined) => void;
    setPlaybackPosition: (position: number) => void;
    setSelectedSubtitleIndex: (index: number | undefined) => void;
    setSearchQuery: (query: string | undefined) => void;
    setFilteredSubtitles: (subtitles: Subtitle[]) => void;
    markUnsavedChanges: (hasChanges: boolean) => void;
    updateSubtitle: (index: number, subtitle: Partial<Subtitle>) => void;
    addSubtitle: (subtitle: Subtitle, index?: number) => void;
    removeSubtitle: (index: number) => void;
    searchSubtitles: (query: string) => void;
    clearSearch: () => void;
  };
}

const defaultReviewStepData: ReviewStepData = {
  subtitles: [],
  currentEdit: undefined,
  playbackPosition: 0,
  selectedSubtitleIndex: undefined,
  searchQuery: undefined,
  filteredSubtitles: [],
  hasUnsavedChanges: false
};

export const useReviewStepStore = create<ReviewStepState>((set, _get) => ({
  data: defaultReviewStepData,
  
  actions: {
    updateReviewStep: (content: Partial<ReviewStepData>) => {
      set(state => ({
        data: { ...state.data, ...content }
      }));
    },

    resetReviewStep: () => {
      set({ data: defaultReviewStepData });
    },

    setSubtitles: (subtitles: Subtitle[]) => {
      set(state => ({
        data: {
          ...state.data,
          subtitles,
          filteredSubtitles: state.data.searchQuery 
            ? subtitles.filter((sub: Subtitle) => 
                sub.text.toLowerCase().includes(state.data.searchQuery!.toLowerCase())
              )
            : []
        }
      }));
    },

    setCurrentEdit: (edit: EditState | undefined) => {
      set(state => ({
        data: { ...state.data, currentEdit: edit }
      }));
    },

    setPlaybackPosition: (position: number) => {
      set(state => ({
        data: { ...state.data, playbackPosition: position }
      }));
    },

    setSelectedSubtitleIndex: (index: number | undefined) => {
      set(state => ({
        data: { ...state.data, selectedSubtitleIndex: index }
      }));
    },

    setSearchQuery: (query: string | undefined) => {
      set(state => {
        const filteredSubtitles = query 
          ? state.data.subtitles.filter((sub: Subtitle) =>
              sub.text.toLowerCase().includes(query.toLowerCase())
            )
          : [];

        return {
          data: {
            ...state.data,
            searchQuery: query,
            filteredSubtitles
          }
        };
      });
    },

    setFilteredSubtitles: (subtitles: Subtitle[]) => {
      set(state => ({
        data: { ...state.data, filteredSubtitles: subtitles }
      }));
    },

    markUnsavedChanges: (hasChanges: boolean) => {
      set(state => ({
        data: { ...state.data, hasUnsavedChanges: hasChanges }
      }));
    },

    updateSubtitle: (index: number, subtitle: Partial<Subtitle>) => {
      set(state => {
        const newSubtitles = [...state.data.subtitles];
        newSubtitles[index] = { ...newSubtitles[index], ...subtitle };

        // Update filtered subtitles if search is active
        const filteredSubtitles = state.data.searchQuery
          ? newSubtitles.filter((sub: Subtitle) =>
              sub.text.toLowerCase().includes(state.data.searchQuery!.toLowerCase())
            )
          : state.data.filteredSubtitles;

        return {
          data: {
            ...state.data,
            subtitles: newSubtitles,
            filteredSubtitles,
            hasUnsavedChanges: true
          }
        };
      });
    },

    addSubtitle: (subtitle: Subtitle, index?: number) => {
      set(state => {
        const newSubtitles = [...state.data.subtitles];
        if (index !== undefined) {
          newSubtitles.splice(index, 0, subtitle);
        } else {
          newSubtitles.push(subtitle);
        }

        // Update filtered subtitles if search is active
        const filteredSubtitles = state.data.searchQuery
          ? newSubtitles.filter((sub: Subtitle) =>
              sub.text.toLowerCase().includes(state.data.searchQuery!.toLowerCase())
            )
          : state.data.filteredSubtitles;

        return {
          data: {
            ...state.data,
            subtitles: newSubtitles,
            filteredSubtitles,
            hasUnsavedChanges: true
          }
        };
      });
    },

    removeSubtitle: (index: number) => {
      set(state => {
        const newSubtitles = state.data.subtitles.filter((_, i) => i !== index);

        // Update filtered subtitles if search is active
        const filteredSubtitles = state.data.searchQuery
          ? newSubtitles.filter((sub: Subtitle) =>
              sub.text.toLowerCase().includes(state.data.searchQuery!.toLowerCase())
            )
          : state.data.filteredSubtitles;

        // Update selected index if necessary
        let selectedSubtitleIndex = state.data.selectedSubtitleIndex;
        if (selectedSubtitleIndex !== undefined) {
          if (selectedSubtitleIndex === index) {
            selectedSubtitleIndex = undefined;
          } else if (selectedSubtitleIndex > index) {
            selectedSubtitleIndex = selectedSubtitleIndex - 1;
          }
        }

        return {
          data: {
            ...state.data,
            subtitles: newSubtitles,
            filteredSubtitles,
            selectedSubtitleIndex,
            hasUnsavedChanges: true
          }
        };
      });
    },

    searchSubtitles: (query: string) => {
      set(state => {
        const filteredSubtitles = query
          ? state.data.subtitles.filter((sub: Subtitle) =>
              sub.text.toLowerCase().includes(query.toLowerCase())
            )
          : [];

        return {
          data: {
            ...state.data,
            searchQuery: query,
            filteredSubtitles
          }
        };
      });
    },

    clearSearch: () => {
      set(state => ({
        data: {
          ...state.data,
          searchQuery: undefined,
          filteredSubtitles: []
        }
      }));
    }
  }
}));

// Selectors
export const useReviewStepData = () => useReviewStepStore(state => state.data);
export const useReviewStepActions = () => useReviewStepStore(state => state.actions);
export const useSubtitles = () => useReviewStepStore(state => state.data.subtitles);
export const useCurrentEdit = () => useReviewStepStore(state => state.data.currentEdit);
export const usePlaybackPosition = () => useReviewStepStore(state => state.data.playbackPosition);
export const useSelectedSubtitleIndex = () => useReviewStepStore(state => state.data.selectedSubtitleIndex);
export const useSubtitleSearch = () => useReviewStepStore(state => ({
  searchQuery: state.data.searchQuery,
  filteredSubtitles: state.data.filteredSubtitles
}));
export const useReviewUnsavedChanges = () => useReviewStepStore(state => state.data.hasUnsavedChanges);