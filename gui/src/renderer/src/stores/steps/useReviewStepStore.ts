import { create, StoreApi, UseBoundStore } from 'zustand';
import { ReviewStepData, Subtitle, EditState, ProcessingStatistics } from '../types/StoreTypes';
import { 
  CantocapSubtitleData, 
  convertSubtitleDataToGuiSubtitles 
} from '../../../../types/SubtitleTypes';

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
    // Enhanced JSON subtitle data actions
    setJsonSubtitleData: (data: import('../../../../types/SubtitleTypes').CantocapSubtitleData | undefined) => void;
    loadSubtitlesFromJson: () => void;
    hasJsonSubtitleData: () => boolean;
    getJsonMetadata: () => import('../../../../types/SubtitleTypes').SubtitleMetadata | undefined;
    getProcessingStatistics: () => ProcessingStatistics | undefined;
  };
}

const defaultReviewStepData: ReviewStepData = {
  subtitles: [],
  currentEdit: undefined,
  playbackPosition: 0,
  selectedSubtitleIndex: undefined,
  searchQuery: undefined,
  filteredSubtitles: [],
  hasUnsavedChanges: false,
  // Enhanced JSON subtitle data support
  jsonSubtitleData: undefined,
  hasJsonData: false,
  inputFile: undefined,
  processingStatistics: undefined,
  processingCompleted: false,
  lastProcessedAt: undefined
};

export const useReviewStepStore: UseBoundStore<StoreApi<ReviewStepState>> = create<ReviewStepState>((set, _get) => ({
  data: defaultReviewStepData,
  
  actions: {
    updateReviewStep: (content: Partial<ReviewStepData>) => {
      set(state => ({
        data: { ...state.data, ...content }
      }));
    },

    resetReviewStep: () => {
      console.log('🔄 REVIEW STORE: Resetting review step to defaults for workspace isolation');
      set({ 
        data: { 
          ...defaultReviewStepData,
          // Ensure all array and object references are completely new
          subtitles: [],
          currentEdit: undefined,
          playbackPosition: 0,
          selectedSubtitleIndex: undefined,
          searchQuery: undefined,
          filteredSubtitles: [],
          hasUnsavedChanges: false,
          jsonSubtitleData: undefined,
          hasJsonData: false,
          inputFile: undefined,
          processingStatistics: undefined,
          processingCompleted: false,
          lastProcessedAt: undefined
        } 
      });
      console.log('✅ REVIEW STORE: Reset completed');
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
    },

    // Enhanced JSON subtitle data actions
    setJsonSubtitleData: (data: CantocapSubtitleData | undefined) => {
      set(state => ({
        data: {
          ...state.data,
          jsonSubtitleData: data,
          hasJsonData: !!data
        }
      }));
    },

    loadSubtitlesFromJson: () => {
      set(state => {
        if (!state.data.jsonSubtitleData) {
          console.warn('No JSON subtitle data available to load');
          return state;
        }

        try {
          const convertedSubtitles = convertSubtitleDataToGuiSubtitles(
            state.data.jsonSubtitleData.subtitles
          );
          
          console.log(`Loaded ${convertedSubtitles.length} subtitles from JSON data`);
          
          return {
            data: {
              ...state.data,
              subtitles: convertedSubtitles,
              filteredSubtitles: state.data.searchQuery
                ? convertedSubtitles.filter((sub: Subtitle) =>
                    sub.text.toLowerCase().includes(state.data.searchQuery!.toLowerCase())
                  )
                : []
            }
          };
        } catch (error) {
          console.error('Failed to load subtitles from JSON data:', error);
          return state;
        }
      });
    },

    hasJsonSubtitleData: () => {
      const state = useReviewStepStore.getState();
      return !!(state.data.jsonSubtitleData && state.data.hasJsonData);
    },

    getJsonMetadata: () => {
      const state = useReviewStepStore.getState();
      return state.data.jsonSubtitleData?.metadata;
    },

    getProcessingStatistics: () => {
      const state = useReviewStepStore.getState();
      return state.data.processingStatistics;
    }
  }
}));

// Selectors
export const useReviewStepData = () => useReviewStepStore((state: ReviewStepState) => state.data);
export const useReviewStepActions = () => useReviewStepStore((state: ReviewStepState) => state.actions);
// Note: useSubtitles is provided by the centralized useStepStore for consistency
export const useCurrentEdit = () => useReviewStepStore((state: ReviewStepState) => state.data.currentEdit);
export const usePlaybackPosition = () => useReviewStepStore((state: ReviewStepState) => state.data.playbackPosition);
export const useSelectedSubtitleIndex = () => useReviewStepStore((state: ReviewStepState) => state.data.selectedSubtitleIndex);
export const useSubtitleSearch = () => useReviewStepStore((state: ReviewStepState) => ({
  searchQuery: state.data.searchQuery,
  filteredSubtitles: state.data.filteredSubtitles
}));
export const useReviewUnsavedChanges = () => useReviewStepStore((state: ReviewStepState) => state.data.hasUnsavedChanges);

// Enhanced selectors for JSON subtitle data
export const useJsonSubtitleData = () => useReviewStepStore((state: ReviewStepState) => state.data.jsonSubtitleData);
export const useHasJsonData = () => useReviewStepStore((state: ReviewStepState) => state.data.hasJsonData);
export const useJsonMetadata = () => useReviewStepStore((state: ReviewStepState) => state.data.jsonSubtitleData?.metadata);
export const useProcessingStatistics = () => useReviewStepStore((state: ReviewStepState) => state.data.processingStatistics);
export const useProcessingCompleted = () => useReviewStepStore((state: ReviewStepState) => state.data.processingCompleted);
export const useLastProcessedAt = () => useReviewStepStore((state: ReviewStepState) => state.data.lastProcessedAt);
export const useInputFile = () => useReviewStepStore((state: ReviewStepState) => state.data.inputFile);