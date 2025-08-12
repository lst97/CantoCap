import { create } from 'zustand';
import { 
  Subtitle, 
  EditAction, 
  WorkspaceSubtitleData, 
  SubtitleEditState 
} from './types/StoreTypes';

// ============================================================================
// SUBTITLE EDIT STORE - USING CENTRALIZED TYPES
// ============================================================================

// ============================================================================
// SUBTITLE EDIT STORE IMPLEMENTATION
// ============================================================================

export const useSubtitleEditStore = create<SubtitleEditState>((set, get) => ({
  // Initial state
  subtitles: [],
  originalSubtitles: [],
  workspaceId: null,
  videoPath: null,
  selectedSubtitleId: null,
  currentTime: 0,
  isVideoPlaying: false,
  videoDuration: 0,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  isSaving: false,
  saveError: null,
  lastSaved: null,

  // Actions
  actions: {
    // Load subtitles for a workspace
    loadSubtitlesForWorkspace: async (workspaceId: string, videoPath: string, subtitles: Subtitle[]) => {
      try {
        set({ isSaving: true, saveError: null });

        // Try to load existing workspace data first
        const existingData = await window.electron.ipcRenderer.invoke(
          'subtitle:load-workspace', 
          workspaceId
        ) as WorkspaceSubtitleData | null;

        if (existingData) {
          // Load existing workspace subtitle data
          set({
            subtitles: existingData.currentSubtitles,
            originalSubtitles: existingData.originalSubtitles,
            workspaceId,
            videoPath: existingData.videoPath,
            undoStack: existingData.editHistory.undoStack,
            redoStack: existingData.editHistory.redoStack,
            isDirty: false,
            isSaving: false,
            lastSaved: new Date(existingData.metadata.lastSaved),
            selectedSubtitleId: null,
            currentTime: 0,
            isVideoPlaying: false
          });
        } else {
          // Initialize new workspace with provided subtitles
          const processedSubtitles = subtitles.map((sub, index) => ({
            ...sub,
            id: sub.id || `subtitle-${index}-${Date.now()}`,
            index: index + 1
          }));

          set({
            subtitles: processedSubtitles,
            originalSubtitles: [...processedSubtitles], // Deep copy for restore
            workspaceId,
            videoPath,
            undoStack: [],
            redoStack: [],
            isDirty: false,
            isSaving: false,
            lastSaved: null,
            selectedSubtitleId: null,
            currentTime: 0,
            isVideoPlaying: false
          });

          // Save initial data to workspace
          const workspaceData: WorkspaceSubtitleData = {
            workspaceId,
            videoPath,
            currentSubtitles: processedSubtitles,
            originalSubtitles: [...processedSubtitles],
            editHistory: { undoStack: [], redoStack: [] },
            metadata: {
              lastSaved: new Date().toISOString(),
              subtitleCount: processedSubtitles.length
            }
          };

          await window.electron.ipcRenderer.invoke(
            'subtitle:save-workspace', 
            workspaceId, 
            workspaceData
          );

          set({ lastSaved: new Date() });
        }

        set({ isSaving: false });
      } catch (error) {
        console.error('Failed to load subtitles for workspace:', error);
        set({ 
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Failed to load workspace'
        });
      }
    },

    // Clear current workspace
    clearWorkspace: () => {
      set({
        subtitles: [],
        originalSubtitles: [],
        workspaceId: null,
        videoPath: null,
        selectedSubtitleId: null,
        currentTime: 0,
        isVideoPlaying: false,
        videoDuration: 0,
        undoStack: [],
        redoStack: [],
        isDirty: false,
        isSaving: false,
        saveError: null,
        lastSaved: null
      });
    },

    // Add action to history stack
    addToHistory: (action: EditAction) => {
      set(state => ({
        undoStack: [...state.undoStack, action].slice(-50), // Keep last 50 actions
        redoStack: [], // Clear redo stack when new action is performed
        isDirty: true
      }));
    },

    // Update subtitle
    updateSubtitle: (id: string, changes: Partial<Subtitle>) => {
      const state = get();
      const subtitle = state.subtitles.find(s => s.id === id);
      if (!subtitle) return;

      const action: EditAction = {
        type: 'update',
        subtitleId: id,
        data: { original: { ...subtitle }, changes },
        timestamp: new Date(),
        description: `Updated subtitle ${subtitle.index}`
      };

      set(prevState => ({
        subtitles: prevState.subtitles.map(s => 
          s.id === id ? { ...s, ...changes } : s
        ),
        undoStack: [...prevState.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true
      }));
    },

    // Add new subtitle
    addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => {
      const id = `subtitle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newSubtitle: Subtitle = {
        ...subtitle,
        id
      };

      const action: EditAction = {
        type: 'add',
        subtitleId: id,
        data: newSubtitle,
        timestamp: new Date(),
        description: `Added subtitle at ${subtitle.startTime}s`
      };

      set(state => ({
        subtitles: [...state.subtitles, newSubtitle].sort((a, b) => a.startTime - b.startTime),
        undoStack: [...state.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true
      }));
    },

    // Delete subtitle
    deleteSubtitle: (id: string) => {
      const state = get();
      const subtitle = state.subtitles.find(s => s.id === id);
      if (!subtitle) return;

      const action: EditAction = {
        type: 'delete',
        subtitleId: id,
        data: subtitle,
        timestamp: new Date(),
        description: `Deleted subtitle ${subtitle.index}`
      };

      set(prevState => ({
        subtitles: prevState.subtitles.filter(s => s.id !== id),
        selectedSubtitleId: prevState.selectedSubtitleId === id ? null : prevState.selectedSubtitleId,
        undoStack: [...prevState.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true
      }));
    },

    // Split subtitle
    splitSubtitle: (id: string, splitTime: number) => {
      const state = get();
      const subtitle = state.subtitles.find(s => s.id === id);
      if (!subtitle || splitTime <= subtitle.startTime || splitTime >= subtitle.endTime) return;

      const firstPart: Subtitle = {
        ...subtitle,
        id: `${id}-split-1-${Date.now()}`,
        endTime: splitTime,
        duration: splitTime - subtitle.startTime
      };

      const secondPart: Subtitle = {
        ...subtitle,
        id: `${id}-split-2-${Date.now()}`,
        startTime: splitTime,
        duration: subtitle.endTime - splitTime,
        text: '',
        translation: ''
      };

      const action: EditAction = {
        type: 'split',
        subtitleId: id,
        data: { original: subtitle, firstPart, secondPart },
        timestamp: new Date(),
        description: `Split subtitle ${subtitle.index} at ${splitTime}s`
      };

      set(prevState => ({
        subtitles: prevState.subtitles
          .filter(s => s.id !== id)
          .concat([firstPart, secondPart])
          .sort((a, b) => a.startTime - b.startTime),
        selectedSubtitleId: secondPart.id, // Select the new empty subtitle for editing
        undoStack: [...prevState.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true
      }));
    },

    // Merge subtitles
    mergeSubtitles: (id1: string, id2: string) => {
      const state = get();
      const subtitle1 = state.subtitles.find(s => s.id === id1);
      const subtitle2 = state.subtitles.find(s => s.id === id2);
      
      if (!subtitle1 || !subtitle2) return;

      // Determine order (merge in time order)
      const [first, second] = subtitle1.startTime < subtitle2.startTime 
        ? [subtitle1, subtitle2] 
        : [subtitle2, subtitle1];

      const mergedSubtitle: Subtitle = {
        ...first,
        id: `merged-${first.id}-${second.id}-${Date.now()}`,
        endTime: second.endTime,
        duration: second.endTime - first.startTime,
        text: `${first.text} ${second.text}`.trim(),
        translation: first.translation && second.translation 
          ? `${first.translation} ${second.translation}`.trim()
          : first.translation || second.translation || ''
      };

      const action: EditAction = {
        type: 'merge',
        subtitleId: id1,
        data: { subtitle1, subtitle2, merged: mergedSubtitle },
        timestamp: new Date(),
        description: `Merged subtitles ${first.index} and ${second.index}`
      };

      set(prevState => ({
        subtitles: prevState.subtitles
          .filter(s => s.id !== id1 && s.id !== id2)
          .concat([mergedSubtitle])
          .sort((a, b) => a.startTime - b.startTime),
        selectedSubtitleId: mergedSubtitle.id,
        undoStack: [...prevState.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true
      }));
    },

    // Selection and playback
    setSelectedSubtitle: (id: string | null) => {
      set({ selectedSubtitleId: id });
    },

    setCurrentTime: (time: number) => {
      set({ currentTime: time });
    },

    setVideoPlaying: (playing: boolean) => {
      set({ isVideoPlaying: playing });
    },

    setVideoDuration: (duration: number) => {
      set({ videoDuration: duration });
    },

    jumpToSubtitle: (subtitleId: string) => {
      const state = get();
      const subtitle = state.subtitles.find(s => s.id === subtitleId);
      if (subtitle) {
        set({
          currentTime: subtitle.startTime,
          selectedSubtitleId: subtitleId,
          isVideoPlaying: true
        });
      }
    },

    // Undo operation
    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;

      const lastAction = state.undoStack[state.undoStack.length - 1];
      const newUndoStack = state.undoStack.slice(0, -1);

      set(prevState => {
        let newSubtitles = [...prevState.subtitles];
        
        switch (lastAction.type) {
          case 'update':
            newSubtitles = newSubtitles.map(s =>
              s.id === lastAction.subtitleId ? lastAction.data.original : s
            );
            break;
          case 'add':
            newSubtitles = newSubtitles.filter(s => s.id !== lastAction.subtitleId);
            break;
          case 'delete':
            newSubtitles = [...newSubtitles, lastAction.data].sort((a, b) => a.startTime - b.startTime);
            break;
          case 'split':
            newSubtitles = newSubtitles
              .filter(s => s.id !== lastAction.data.firstPart.id && s.id !== lastAction.data.secondPart.id)
              .concat([lastAction.data.original])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          case 'merge':
            newSubtitles = newSubtitles
              .filter(s => s.id !== lastAction.data.merged.id)
              .concat([lastAction.data.subtitle1, lastAction.data.subtitle2])
              .sort((a, b) => a.startTime - b.startTime);
            break;
        }

        return {
          subtitles: newSubtitles,
          undoStack: newUndoStack,
          redoStack: [...prevState.redoStack, lastAction].slice(-50),
          isDirty: newUndoStack.length > 0
        };
      });
    },

    // Redo operation
    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;

      const actionToRedo = state.redoStack[state.redoStack.length - 1];
      const newRedoStack = state.redoStack.slice(0, -1);

      set(prevState => {
        let newSubtitles = [...prevState.subtitles];
        
        switch (actionToRedo.type) {
          case 'update':
            newSubtitles = newSubtitles.map(s =>
              s.id === actionToRedo.subtitleId ? { ...s, ...actionToRedo.data.changes } : s
            );
            break;
          case 'add':
            newSubtitles = [...newSubtitles, actionToRedo.data].sort((a, b) => a.startTime - b.startTime);
            break;
          case 'delete':
            newSubtitles = newSubtitles.filter(s => s.id !== actionToRedo.subtitleId);
            break;
          case 'split':
            newSubtitles = newSubtitles
              .filter(s => s.id !== actionToRedo.subtitleId)
              .concat([actionToRedo.data.firstPart, actionToRedo.data.secondPart])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          case 'merge':
            newSubtitles = newSubtitles
              .filter(s => s.id !== actionToRedo.data.subtitle1.id && s.id !== actionToRedo.data.subtitle2.id)
              .concat([actionToRedo.data.merged])
              .sort((a, b) => a.startTime - b.startTime);
            break;
        }

        return {
          subtitles: newSubtitles,
          undoStack: [...prevState.undoStack, actionToRedo].slice(-50),
          redoStack: newRedoStack,
          isDirty: true
        };
      });
    },

    // Manual save to workspace (triggered by user actions only)
    saveToWorkspace: async () => {
      const state = get();
      if (!state.workspaceId) {
        set({ saveError: 'No workspace selected' });
        return;
      }

      try {
        set({ isSaving: true, saveError: null });

        const workspaceData: WorkspaceSubtitleData = {
          workspaceId: state.workspaceId,
          videoPath: state.videoPath || '',
          currentSubtitles: state.subtitles,
          originalSubtitles: state.originalSubtitles,
          editHistory: {
            undoStack: state.undoStack,
            redoStack: state.redoStack
          },
          metadata: {
            lastSaved: new Date().toISOString(),
            subtitleCount: state.subtitles.length
          }
        };

        await window.electron.ipcRenderer.invoke(
          'subtitle:save-workspace',
          state.workspaceId,
          workspaceData
        );

        set({
          isDirty: false,
          isSaving: false,
          lastSaved: new Date(),
          saveError: null
        });

      } catch (error) {
        console.error('Failed to save workspace:', error);
        set({
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Save failed'
        });
      }
    },

    // Restore from original subtitles
    restoreFromOriginal: () => {
      const state = get();
      
      const action: EditAction = {
        type: 'update',
        subtitleId: 'all',
        data: { 
          original: state.subtitles,
          restored: state.originalSubtitles
        },
        timestamp: new Date(),
        description: 'Restored all subtitles to original'
      };

      set(prevState => ({
        subtitles: [...prevState.originalSubtitles],
        undoStack: [...prevState.undoStack, action].slice(-50),
        redoStack: [],
        isDirty: true,
        selectedSubtitleId: null
      }));
    }
  }
}));

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

// Hook to get subtitle data
export const useSubtitles = () => useSubtitleEditStore(state => state.subtitles);
export const useOriginalSubtitles = () => useSubtitleEditStore(state => state.originalSubtitles);
export const useSelectedSubtitle = () => useSubtitleEditStore(state => {
  const selectedId = state.selectedSubtitleId;
  return selectedId ? state.subtitles.find(s => s.id === selectedId) || null : null;
});

// Hook to get video state
export const useVideoState = () => useSubtitleEditStore(state => ({
  currentTime: state.currentTime,
  isVideoPlaying: state.isVideoPlaying,
  videoDuration: state.videoDuration,
  videoPath: state.videoPath
}));

// Hook to get edit history
export const useEditHistory = () => useSubtitleEditStore(state => ({
  undoStack: state.undoStack,
  redoStack: state.redoStack,
  canUndo: state.undoStack.length > 0,
  canRedo: state.redoStack.length > 0
}));

// Hook to get save state
export const useSaveState = () => useSubtitleEditStore(state => ({
  isDirty: state.isDirty,
  isSaving: state.isSaving,
  saveError: state.saveError,
  lastSaved: state.lastSaved
}));

// Hook to get all actions
export const useSubtitleActions = () => useSubtitleEditStore(state => state.actions);

// Hook to get workspace info
export const useSubtitleWorkspace = () => useSubtitleEditStore(state => ({
  workspaceId: state.workspaceId,
  videoPath: state.videoPath
}));