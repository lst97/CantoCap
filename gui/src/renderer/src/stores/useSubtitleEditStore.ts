import React from 'react';
import { create } from 'zustand';
import { 
  Subtitle, 
  EditAction, 
  AddEditData,
  DeleteEditData,
  UpdateEditData,
  SplitEditData,
  MergeEditData,
  WorkspaceSubtitleData, 
  SubtitleEditState
} from './types/StoreTypes';
import type { ElectronWindow } from '../../../types';

// Interface for imported JSON subtitle data
interface ImportedSubtitleData {
  id?: string;
  caption?: string;
  text?: string;
  startTime?: number;
  endTime?: number;
  speaker?: string;
  confidence?: number;
  translation?: string;
  [key: string]: unknown; // Allow additional properties
}

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
    loadSubtitlesForWorkspace: async (workspaceId: string, videoPath: string, subtitles: Subtitle[], forceReload = false) => {
      try {
        set({ isSaving: true, saveError: null });

        // Try to load existing workspace data first (unless forced to reload)
        let existingData: WorkspaceSubtitleData | null = null;
        
        if (!forceReload) {
          existingData = await (window as unknown as ElectronWindow).cantocapAPI.subtitleWorkspaceLoad(
            workspaceId
          ) as WorkspaceSubtitleData | null;
        } else {
          console.log('🔄 Force reload requested - skipping existing workspace data');
        }

        if (existingData) {
          // Load existing workspace subtitle data
          // CRITICAL: Always preserve the original subtitles for diff comparison
          // Only update current subtitles if they differ from what's stored
          console.log(`✅ FOUND EXISTING WORKSPACE DATA - Loading ${existingData.currentSubtitles.length} modified subtitles and ${existingData.originalSubtitles.length} original subtitles for diff`);
          
          set({
            subtitles: existingData.currentSubtitles,
            originalSubtitles: existingData.originalSubtitles, // PRESERVE original for diff
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
          // This should only happen for brand new data (e.g., fresh processing results)
          const processedSubtitles = subtitles.map((sub, index) => ({
            ...sub,
            id: sub.id || `subtitle-${index}-${Date.now()}`,
            index: index + 1
          }));

          console.log(`🆕 NO EXISTING WORKSPACE DATA FOUND - Creating new workspace with ${processedSubtitles.length} subtitles as fresh baseline`);

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

          await (window as unknown as ElectronWindow).cantocapAPI.subtitleWorkspaceSave(
            workspaceId, 
            workspaceData
          );

          set({ lastSaved: new Date(), isSaving: false });
        }

        // FIXED: Ensure isSaving is always reset, even if already set above
        // This prevents any race conditions or edge cases where isSaving might remain true
        console.log('✅ loadSubtitlesForWorkspace completed successfully');
      } catch (error) {
        console.error('Failed to load subtitles for workspace:', error);
        set({ 
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Failed to load workspace'
        });
      } finally {
        // DEFENSIVE: Always ensure isSaving is reset, regardless of success or failure
        // This is a safety net to prevent persistent saving state
        const currentState = get();
        if (currentState.isSaving) {
          console.log('🔧 DEFENSIVE: Resetting isSaving state in finally block');
          set({ isSaving: false });
        }
      }
    },

    // Clear current workspace (memory and optionally persisted data)
    clearWorkspace: async (workspaceId?: string, preserveModifiedData = false) => {
      const currentState = get();
      const targetWorkspaceId = workspaceId || currentState.workspaceId;
      
      // Only clear persisted workspace data if explicitly requested (for new transcriptions)
      if (targetWorkspaceId && !preserveModifiedData) {
        try {
          console.log(`🧹 Clearing persisted workspace data for new transcription: ${targetWorkspaceId}`);
          await (window as unknown as ElectronWindow).cantocapAPI.subtitleWorkspaceDelete(targetWorkspaceId);
          console.log(`✅ Successfully cleared persisted workspace data for: ${targetWorkspaceId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to clear persisted workspace data for ${targetWorkspaceId}:`, error);
          // Continue with memory clearing even if persistence clearing fails
        }
      } else if (preserveModifiedData) {
        console.log(`🔒 Preserving persisted workspace data for: ${targetWorkspaceId}`);
      }
      
      // Clear in-memory state
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
        data: { 
          original: { ...subtitle }, 
          changes 
        } as UpdateEditData,
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
        data: { 
          subtitle: newSubtitle 
        } as AddEditData,
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
        data: { 
          subtitle: subtitle 
        } as DeleteEditData,
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
        data: { 
          original: subtitle, 
          firstPart, 
          secondPart 
        } as SplitEditData,
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
        data: { 
          subtitle1, 
          subtitle2, 
          merged: mergedSubtitle 
        } as MergeEditData,
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
          case 'update': {
            const updateData = lastAction.data as UpdateEditData;
            newSubtitles = newSubtitles.map(s =>
              s.id === lastAction.subtitleId ? updateData.original : s
            );
            break;
          }
          case 'add': {
            newSubtitles = newSubtitles.filter(s => s.id !== lastAction.subtitleId);
            break;
          }
          case 'delete': {
            const deleteData = lastAction.data as DeleteEditData;
            newSubtitles = [...newSubtitles, deleteData.subtitle].sort((a, b) => a.startTime - b.startTime);
            break;
          }
          case 'split': {
            const splitData = lastAction.data as SplitEditData;
            newSubtitles = newSubtitles
              .filter(s => s.id !== splitData.firstPart.id && s.id !== splitData.secondPart.id)
              .concat([splitData.original])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          }
          case 'merge': {
            const mergeData = lastAction.data as MergeEditData;
            newSubtitles = newSubtitles
              .filter(s => s.id !== mergeData.merged.id)
              .concat([mergeData.subtitle1, mergeData.subtitle2])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          }
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
          case 'update': {
            const updateData = actionToRedo.data as UpdateEditData;
            newSubtitles = newSubtitles.map(s =>
              s.id === actionToRedo.subtitleId ? { ...s, ...updateData.changes } : s
            );
            break;
          }
          case 'add': {
            const addData = actionToRedo.data as AddEditData;
            newSubtitles = [...newSubtitles, addData.subtitle].sort((a, b) => a.startTime - b.startTime);
            break;
          }
          case 'delete': {
            newSubtitles = newSubtitles.filter(s => s.id !== actionToRedo.subtitleId);
            break;
          }
          case 'split': {
            const splitData = actionToRedo.data as SplitEditData;
            newSubtitles = newSubtitles
              .filter(s => s.id !== actionToRedo.subtitleId)
              .concat([splitData.firstPart, splitData.secondPart])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          }
          case 'merge': {
            const mergeData = actionToRedo.data as MergeEditData;
            newSubtitles = newSubtitles
              .filter(s => s.id !== mergeData.subtitle1.id && s.id !== mergeData.subtitle2.id)
              .concat([mergeData.merged])
              .sort((a, b) => a.startTime - b.startTime);
            break;
          }
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
    // Enhanced: Save both current and original subtitles to preserve diff capability
    saveToWorkspace: async () => {
      const state = get();
      if (!state.workspaceId) {
        set({ saveError: 'No workspace selected' });
        return;
      }

      try {
        set({ isSaving: true, saveError: null });

        // Save to step store for JSON import persistence
        await (window as unknown as ElectronWindow).cantocapAPI.subtitleSyncToStep(
          state.workspaceId,
          state.subtitles
        );

        // CRITICAL: Also save full workspace data including original subtitles
        // This ensures that on app reload, we can still compare against the true original
        const workspaceData: WorkspaceSubtitleData = {
          workspaceId: state.workspaceId,
          videoPath: state.videoPath ?? "",
          currentSubtitles: state.subtitles,
          originalSubtitles: state.originalSubtitles, // Preserve original for diff comparison
          editHistory: {
            undoStack: state.undoStack,
            redoStack: state.redoStack
          },
          metadata: {
            lastSaved: new Date().toISOString(),
            subtitleCount: state.subtitles.length
          }
        };

        await (window as unknown as ElectronWindow).cantocapAPI.subtitleWorkspaceSave(
          state.workspaceId, 
          workspaceData
        );

        console.log(`✅ Saved ${state.subtitles.length} edited subtitles to both step store and workspace for: ${state.workspaceId}`);
        console.log(`🎯 Original subtitles preserved for diff: ${state.originalSubtitles.length} items`);

        set({
          isDirty: false,
          isSaving: false,
          lastSaved: new Date(),
          saveError: null
        });

      } catch (error) {
        console.error('Failed to save subtitles to workspace:', error);
        set({
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Save failed'
        });
      } finally {
        // DEFENSIVE: Always ensure isSaving is reset, regardless of success or failure
        const currentState = get();
        if (currentState.isSaving) {
          console.log('🔧 DEFENSIVE: Resetting isSaving state in saveToWorkspace finally block');
          set({ isSaving: false });
        }
      }
    },

    // Import from JSON data (for JSON import workflow)
    importFromJson: async (workspaceId: string, videoPath: string, jsonData: unknown[]) => {
      try {
        set({ isSaving: true, saveError: null });

        // Transform JSON data to subtitle format
        console.log('🚨 STORE: importFromJson called with data:', {
          dataLength: jsonData.length,
          firstItem: jsonData[0] ? {
            keys: Object.keys(jsonData[0]),
            caption: (jsonData[0] as any).caption,
            text: (jsonData[0] as any).text,
            translation: (jsonData[0] as any).translation,
            hasCaption: !!(jsonData[0] as any).caption,
            hasText: !!(jsonData[0] as any).text,
            hasTranslation: !!(jsonData[0] as any).translation
          } : 'no data'
        });

        const processedSubtitles = jsonData.map((rawItem, index) => {
          const item = rawItem as ImportedSubtitleData;
          
          // More aggressive debugging
          if (index < 3) {
            console.log(`🔍 Store processing subtitle ${index}:`, {
              rawItem,
              itemKeys: Object.keys(item),
              caption: item.caption,
              text: item.text, 
              translation: item.translation,
              captionType: typeof item.caption,
              textType: typeof item.text,
              translationType: typeof item.translation,
              hasCaption: !!item.caption,
              hasText: !!item.text,
              hasTranslation: !!item.translation,
              captionLength: item.caption ? item.caption.length : 0,
              textLength: item.text ? item.text.length : 0,
              translationLength: item.translation ? item.translation.length : 0
            });
          }
          
          // More robust translation handling - preserve any valid string
          let finalTranslation: string | undefined = undefined;
          if (item.translation) {
            if (typeof item.translation === 'string' && item.translation.trim() !== '') {
              finalTranslation = item.translation.trim();
            }
          }
          
          // Enhanced text field mapping with multiple fallbacks
          const extractedText = item.caption || item.text || 
                               (item as any).original || (item as any).content || 
                               (item as any).subtitle || '';
          
          const result = {
            id: item.id || `subtitle-${index}-${Date.now()}`,
            index: index + 1,
            text: extractedText,
            startTime: item.startTime || 0,
            endTime: item.endTime || 0,
            duration: (item.endTime || 0) - (item.startTime || 0),
            speaker: item.speaker,
            confidence: item.confidence,
            translation: finalTranslation
          };
          
          if (index < 3) {
            console.log(`✅ Store processed result ${index}:`, {
              id: result.id,
              text: result.text,
              translation: result.translation,
              hasText: !!result.text,
              hasTranslation: !!result.translation,
              textLength: result.text ? result.text.length : 0,
              translationLength: result.translation ? result.translation.length : 0,
              originalCaption: item.caption,
              originalText: item.text,
              textSource: item.caption ? 'caption' : item.text ? 'text' : (item as any).original ? 'original' : (item as any).content ? 'content' : (item as any).subtitle ? 'subtitle' : 'empty',
              extractedText: extractedText
            });
          }
          
          return result;
        });

        // CRITICAL FIX: Always create fresh baseline for diff comparison
        // This ensures imported JSON becomes the new "original" for diff purposes
        set({
          subtitles: processedSubtitles,
          originalSubtitles: [...processedSubtitles], // Fresh baseline - no diff initially
          workspaceId,
          videoPath,
          undoStack: [],
          redoStack: [],
          isDirty: true, // Mark as dirty since imported but not saved
          isSaving: false,
          lastSaved: null,
          selectedSubtitleId: null,
          currentTime: 0,
          isVideoPlaying: false
        });

        // Final verification - check what's actually in the store now
        console.log('🎯 Final store state - first 3 subtitles:', {
          totalSubtitles: processedSubtitles.length,
          subtitlesWithTranslations: processedSubtitles.filter(s => s.translation).length,
          firstThree: processedSubtitles.slice(0, 3).map(s => ({
            id: s.id,
            text: s.text,
            translation: s.translation,
            hasTranslation: !!s.translation
          }))
        });

        // Validation warnings
        const subtitlesWithMissingText = processedSubtitles.filter(s => !s.text && s.translation);
        const subtitlesWithMissingTranslation = processedSubtitles.filter(s => s.text && !s.translation);
        
        if (subtitlesWithMissingText.length > 0) {
          console.warn(`⚠️ STORE WARNING: ${subtitlesWithMissingText.length} subtitles have translation but missing original text!`);
          console.warn('First few examples:', subtitlesWithMissingText.slice(0, 3).map(s => ({ id: s.id, translation: s.translation })));
        }
        
        if (subtitlesWithMissingTranslation.length > 0) {
          console.log(`ℹ️ STORE INFO: ${subtitlesWithMissingTranslation.length} subtitles have original text but no translation (this is normal for some workflows)`);
        }

        console.log(`✅ JSON imported: ${processedSubtitles.length} subtitles loaded with fresh baseline for diff comparison`);
        
      } catch (error) {
        console.error('Failed to import JSON:', error);
        set({
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Import failed'
        });
        throw error;
      } finally {
        // DEFENSIVE: Always ensure isSaving is reset, regardless of success or failure
        const currentState = get();
        if (currentState.isSaving) {
          console.log('🔧 DEFENSIVE: Resetting isSaving state in importFromJson finally block');
          set({ isSaving: false });
        }
      }
    },

    // Enhanced state management functions
    markDirty: () => {
      set({ isDirty: true });
    },

    markClean: () => {
      set({ isDirty: false });
    },

    hasUnsavedChanges: () => {
      return get().isDirty;
    },

    // Export to step store (for step navigation integration)
    exportToStep: async () => {
      const state = get();
      if (!state.workspaceId || !state.subtitles.length) return;

      try {
        await (window as unknown as ElectronWindow).cantocapAPI.subtitleSyncToStep(
          state.workspaceId,
          state.subtitles
        );
        console.log(`✅ Subtitles synced to step store for workspace: ${state.workspaceId}`);
      } catch (error) {
        console.error('Failed to sync subtitles to step:', error);
        throw error;
      }
    },

    // Restore from original subtitles
    restoreFromOriginal: () => {
      const state = get();
      
      const action: EditAction = {
        type: 'update',
        subtitleId: 'all',
        data: { 
          original: state.subtitles[0] || {} as Subtitle, // Placeholder for restore operation
          changes: {} // Restore is a special case handled differently in undo
        } as UpdateEditData,
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
    },

    // NEW: Restore from processing step's original JSON data
    restoreFromProcessingOriginal: async (workspaceId: string, videoPath: string, originalJsonData: unknown[]) => {
      try {
        console.log('🔄 Restoring from processing step original JSON data');
        set({ isSaving: true, saveError: null });

        // Transform original JSON data to subtitle format (same as importFromJson)
        const processedSubtitles = originalJsonData.map((rawItem, index) => {
          const item = rawItem as ImportedSubtitleData;
          
          // Extract caption/text - support various field names with enhanced fallbacks
          const text = item.caption || item.text || 
                      (item as any).original || (item as any).content || 
                      (item as any).subtitle || '';
          
          // Map timing fields
          const startTime = item.startTime || 0;
          const endTime = item.endTime || startTime + 2;
          
          const result: Subtitle = {
            id: item.id || `sub-${index + 1}-${Date.now()}`,
            index: index + 1,
            startTime,
            endTime,
            duration: endTime - startTime,
            text,
            speaker: item.speaker || undefined,
            confidence: item.confidence || undefined,
            translation: item.translation || undefined,
          };
          
          return result;
        });

        // Create restore action for undo history
        const action: EditAction = {
          type: 'update',
          subtitleId: 'all',
          data: { 
            original: get().subtitles[0] || {} as Subtitle,
            changes: {}
          } as UpdateEditData,
          timestamp: new Date(),
          description: 'Restored from processing step original data'
        };

        // Update state - this becomes both current and original (fresh baseline)
        set(prevState => ({
          subtitles: processedSubtitles,
          originalSubtitles: [...processedSubtitles], // Set as new original baseline
          workspaceId,
          videoPath,
          undoStack: [...prevState.undoStack, action].slice(-50),
          redoStack: [],
          isDirty: true, // Mark as dirty since restored but not saved
          isSaving: false,
          selectedSubtitleId: null,
          currentTime: 0,
          isVideoPlaying: false
        }));

        console.log(`✅ Restored from processing original: ${processedSubtitles.length} subtitles with fresh baseline`);
        
      } catch (error) {
        console.error('Failed to restore from processing original:', error);
        set({
          isSaving: false,
          saveError: error instanceof Error ? error.message : 'Restore failed'
        });
        throw error;
      }
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

// Hook to get video state - memoized to prevent infinite loops
export const useVideoState = () => {
  const currentTime = useSubtitleEditStore(state => state.currentTime);
  const isVideoPlaying = useSubtitleEditStore(state => state.isVideoPlaying);
  const videoDuration = useSubtitleEditStore(state => state.videoDuration);
  const videoPath = useSubtitleEditStore(state => state.videoPath);
  
  return React.useMemo(() => ({
    currentTime,
    isVideoPlaying,
    videoDuration,
    videoPath
  }), [currentTime, isVideoPlaying, videoDuration, videoPath]);
};

// Hook to get edit history - memoized to prevent infinite loops
export const useEditHistory = () => {
  const undoStack = useSubtitleEditStore(state => state.undoStack);
  const redoStack = useSubtitleEditStore(state => state.redoStack);
  
  return React.useMemo(() => ({
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  }), [undoStack, redoStack]);
};

// Hook to get save state - memoized to prevent infinite loops
export const useSaveState = () => {
  const isDirty = useSubtitleEditStore(state => state.isDirty);
  const isSaving = useSubtitleEditStore(state => state.isSaving);
  const saveError = useSubtitleEditStore(state => state.saveError);
  const lastSaved = useSubtitleEditStore(state => state.lastSaved);
  
  // Return stable reference using React.useMemo
  return React.useMemo(() => ({
    isDirty,
    isSaving,
    saveError,
    lastSaved
  }), [isDirty, isSaving, saveError, lastSaved]);
};

// Hook to get all actions
export const useSubtitleActions = () => useSubtitleEditStore(state => state.actions);

// Hook to get workspace info - memoized to prevent infinite loops
export const useSubtitleWorkspace = () => {
  const workspaceId = useSubtitleEditStore(state => state.workspaceId);
  const videoPath = useSubtitleEditStore(state => state.videoPath);
  
  return React.useMemo(() => ({
    workspaceId,
    videoPath
  }), [workspaceId, videoPath]);
};