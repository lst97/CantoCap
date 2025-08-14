import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Stack,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  CallSplit as SplitIcon,
  MergeType as MergeIcon,
  Delete as DeleteIcon,
  RestoreOutlined as RestoreIcon,
  FileDownload as ExportIcon,
} from "@mui/icons-material";
import { 
  useSubtitleEditStore, 
  useSubtitles, 
  useSelectedSubtitle, 
  useEditHistory,
  useSaveState,
  useSubtitleActions 
} from "../../../stores/useSubtitleEditStore";
import { useWorkflowActions } from "../../../stores/useWorkflowStore";
import { ReviewCard, ActionButton } from "./styles";
import { formatTime, parseTime } from "./utils";
import { SubtitleEditorProps } from "./types";

export const SubtitleEditor: React.FC<SubtitleEditorProps> = () => {
  const subtitles = useSubtitles();
  const selectedSubtitle = useSelectedSubtitle();
  const { undoStack, redoStack, canUndo, canRedo } = useEditHistory();
  const { isDirty, isSaving, saveError } = useSaveState();
  const {
    updateSubtitle,
    deleteSubtitle,
    splitSubtitle,
    mergeSubtitles,
    setSelectedSubtitle,
    jumpToSubtitle,
    setCurrentTime,
    undo,
    redo,
    saveToWorkspace,
    restoreFromOriginal
  } = useSubtitleActions();
  const { navigateToStep } = useWorkflowActions();
  
  // Fixed: Use separate selectors to avoid creating new objects on each render
  const currentTime = useSubtitleEditStore(state => state.currentTime);
  const isVideoPlaying = useSubtitleEditStore(state => state.isVideoPlaying);

  const [editText, setEditText] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showTranslationField, setShowTranslationField] = useState(false);
  
  // Export state management to prevent infinite rerenders
  const [isExporting, setIsExporting] = useState(false);
  const exportInProgressRef = useRef(false);
  const lastExportAttemptRef = useRef<number>(0);

  const editingSubtitle = selectedSubtitle;

  // Check if this is a new subtitle (empty text and no original text)
  const isNewSubtitle =
    editingSubtitle && !editingSubtitle.text && !editingSubtitle.translation;
  
  // Check if subtitle has translation
  const hasTranslation = editingSubtitle && editingSubtitle.translation && editingSubtitle.translation.trim();

  // Update local state when selected subtitle changes
  useEffect(() => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text);
      setEditTranslation(editingSubtitle.translation || "");
      setEditStartTime(formatTime(editingSubtitle.startTime));
      setEditEndTime(formatTime(editingSubtitle.endTime));
      setHasChanges(false);
      // Show translation field if translation exists
      setShowTranslationField(!!(editingSubtitle.translation && editingSubtitle.translation.trim()));
    }
  }, [editingSubtitle]);

  // Cleanup export state on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      exportInProgressRef.current = false;
      setIsExporting(false);
    };
  }, []);

  const handleTextChange = (value: string) => {
    setEditText(value);
    setHasChanges(editingSubtitle?.text !== value || (editingSubtitle?.text || "") !== editTranslation);
  };

  const handleTranslationChange = (value: string) => {
    setEditTranslation(value);
    setHasChanges(editingSubtitle?.text !== editText || (editingSubtitle?.text || "") !== value);
  };

  const handleSave = async () => {
    if (!editingSubtitle || !hasChanges) return;

    try {
      // Update the subtitle first
      updateSubtitle(editingSubtitle.id, {
        text: editText,
        translation: editTranslation || undefined,
        startTime: parseTime(editStartTime),
        endTime: parseTime(editEndTime),
      });
      setHasChanges(false);

      // Trigger manual save to workspace
      await saveToWorkspace();
    } catch (error) {
      console.error('Failed to save subtitle:', error);
    }
  };

  const handleCancel = () => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text);
      setEditTranslation(editingSubtitle.translation || "");
      setEditStartTime(formatTime(editingSubtitle.startTime));
      setEditEndTime(formatTime(editingSubtitle.endTime));
      setHasChanges(false);
    }
  };

  const handleReset = async () => {
    if (editingSubtitle) {
      // Reset to initial values - this is different from the subtitle list reset
      // Here we reset to the current stored values, not to "original" text
      setEditText(editingSubtitle.text);
      setEditTranslation(editingSubtitle.translation || "");
      setHasChanges(false);
    }
  };

  const handleRestoreAll = async () => {
    try {
      // Restore all subtitles to original
      restoreFromOriginal();
      setSelectedSubtitle(null);
      
      // Save the restoration
      await saveToWorkspace();
    } catch (error) {
      console.error('Failed to restore subtitles:', error);
    }
  };

  const handleDelete = async () => {
    if (editingSubtitle) {
      try {
        deleteSubtitle(editingSubtitle.id);
        setSelectedSubtitle(null);
        
        // Save after deletion
        await saveToWorkspace();
      } catch (error) {
        console.error('Failed to delete subtitle:', error);
      }
    }
  };

  const handleExport = useCallback(async () => {
    const now = Date.now();
    
    // Prevent rapid successive clicks and concurrent exports
    if (exportInProgressRef.current || isExporting) {
      console.log('🚫 Export already in progress, ignoring request');
      return;
    }
    
    // Debounce rapid clicks (prevent calls within 1 second)
    if (now - lastExportAttemptRef.current < 1000) {
      console.log('🚫 Export throttled - too rapid successive clicks');
      return;
    }
    
    try {
      // Set export state immediately to prevent concurrent calls
      exportInProgressRef.current = true;
      setIsExporting(true);
      lastExportAttemptRef.current = now;
      
      console.log('🚀 Starting export navigation sequence');
      
      // Use a small delay to ensure the current render cycle completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Navigate to export step using proper navigation hook
      const navigationResult = await navigateToStep('export');
      
      if (!navigationResult.success) {
        throw new Error(`Navigation to export step failed: ${navigationResult.error || 'Unknown error'}`);
      }
      
      console.log('✅ Export navigation sequence completed successfully');
      
    } catch (error) {
      console.error('❌ Export navigation failed:', error);
      // Reset states on error to allow retry
      exportInProgressRef.current = false;
      setIsExporting(false);
    } finally {
      // Clear export state after a short delay
      setTimeout(() => {
        exportInProgressRef.current = false;
        setIsExporting(false);
      }, 500);
    }
  }, [isExporting, navigateToStep]);

  const handleSplit = async () => {
    if (editingSubtitle) {
      const splitTime =
        currentTime ||
        (editingSubtitle.startTime + editingSubtitle.endTime) / 2;
      
      if (
        splitTime > editingSubtitle.startTime &&
        splitTime < editingSubtitle.endTime
      ) {
        try {
          splitSubtitle(editingSubtitle.id, splitTime);
          
          // Save after split operation
          await saveToWorkspace();
        } catch (error) {
          console.error('Failed to split subtitle:', error);
        }
      }
    }
  };

  const handleMergeNext = async () => {
    if (!editingSubtitle || !Array.isArray(subtitles)) return;

    const currentIndex = subtitles.findIndex(
      (s) => s.id === editingSubtitle.id
    );
    
    if (
      currentIndex >= 0 &&
      currentIndex < subtitles.length - 1
    ) {
      const nextSubtitle = subtitles[currentIndex + 1];
      
      try {
        mergeSubtitles(editingSubtitle.id, nextSubtitle.id);
        
        // Save after merge operation
        await saveToWorkspace();
      } catch (error) {
        console.error('Failed to merge subtitles:', error);
      }
    }
  };

  return (
    <ReviewCard sx={{ display: 'flex', flexDirection: 'column', height: '90%' }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <EditIcon color="primary" />
          {isNewSubtitle ? "Add Subtitle" : "Edit Subtitle"}
        </Typography>

        {/* Undo/Redo and Reset buttons */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Reset Changes">
            <span>
              <IconButton
                size="small"
                onClick={handleReset}
                disabled={!hasChanges}
                sx={{ color: "#F59E0B" }}
              >
                <RestoreIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Undo">
            <span>
              <IconButton
                size="small"
                onClick={async () => {
                  try {
                    undo();
                    await saveToWorkspace();
                  } catch (error) {
                    console.error('Failed to undo:', error);
                  }
                }}
                disabled={undoStack.length === 0 || isSaving}
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                size="small"
                onClick={async () => {
                  try {
                    redo();
                    await saveToWorkspace();
                  } catch (error) {
                    console.error('Failed to redo:', error);
                  }
                }}
                disabled={redoStack.length === 0 || isSaving}
              >
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {editingSubtitle ? (
          <Stack spacing={2} sx={{ flex: 1 }}>
          {/* Timing Controls */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Start Time"
              value={editStartTime}
              onChange={(e) => setEditStartTime(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{
                style: { fontFamily: "monospace", fontSize: "0.875rem" },
              }}
            />
            <TextField
              label="End Time"
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{
                style: { fontFamily: "monospace", fontSize: "0.875rem" },
              }}
            />
          </Box>

          {/* Text Editor */}
          <TextField
            label="Subtitle"
            value={editText}
            onChange={(e) => handleTextChange(e.target.value)}
            multiline
            rows={hasTranslation ? 2 : 4}
            fullWidth
            variant="outlined"
            sx={{
              "& .MuiOutlineInputBase-root": {
                backgroundColor: hasChanges
                  ? "rgba(245, 158, 11, 0.05)"
                  : "transparent",
              },
            }}
          />

          {/* Translation Editor Section */}
          {(hasTranslation || editTranslation.trim() || showTranslationField) ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Translation
                </Typography>
                {!hasTranslation && !editTranslation.trim() && (
                  <Button
                    size="small"
                    onClick={() => setShowTranslationField(false)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Hide
                  </Button>
                )}
              </Box>
              <TextField
                label="Translation"
                value={editTranslation}
                onChange={(e) => handleTranslationChange(e.target.value)}
                multiline
                rows={2}
                fullWidth
                variant="outlined"
                placeholder="Add translation for this subtitle..."
                sx={{
                  "& .MuiOutlineInputBase-root": {
                    backgroundColor: hasChanges
                      ? "rgba(245, 158, 11, 0.05)"
                      : "transparent",
                  },
                }}
              />
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowTranslationField(true)}
              sx={{ 
                alignSelf: 'flex-start',
                fontSize: '0.8rem',
                py: 1,
                borderStyle: 'dashed',
                color: 'text.secondary',
                borderColor: 'rgba(255, 255, 255, 0.3)'
              }}
            >
              + Add Translation
            </Button>
          )}

          {/* Confidence and Info */}
          {editingSubtitle.confidence && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Confidence:
              </Typography>
              <Chip
                label={`${editingSubtitle.confidence}%`}
                size="small"
                color={
                  editingSubtitle.confidence > 90
                    ? "success"
                    : editingSubtitle.confidence > 80
                    ? "warning"
                    : "error"
                }
              />
              {editingSubtitle.speaker && (
                <Chip
                  label={`Speaker: ${editingSubtitle.speaker}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          )}

          {/* Save/Cancel buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
              size="small"
              sx={{ flex: 1 }}
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <ActionButton
              startIcon={<UndoIcon />}
              size="small"
              onClick={handleCancel}
              disabled={!hasChanges}
            >
              Cancel
            </ActionButton>
          </Box>

          {/* Save Error Display */}
          {saveError && (
            <Alert 
              severity="error" 
              onClose={() => useSubtitleEditStore.setState({ saveError: null })}
              sx={{ mt: 1 }}
            >
              Save failed: {saveError}
            </Alert>
          )}

          <Divider />

          {/* Quick Actions */}
          <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
            Quick Actions:
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <ActionButton
                startIcon={<SplitIcon />}
                size="small"
                sx={{ flex: 1 }}
                onClick={handleSplit}
                disabled={
                  !currentTime ||
                  currentTime <= editingSubtitle.startTime ||
                  currentTime >= editingSubtitle.endTime
                }
              >
                Split at Current Time
              </ActionButton>
              <ActionButton
                startIcon={<MergeIcon />}
                size="small"
                sx={{ flex: 1 }}
                onClick={handleMergeNext}
              >
                Merge with Next
              </ActionButton>
            </Box>
            <Box>
              <ActionButton
                startIcon={<DeleteIcon />}
                size="small"
                color="error"
                onClick={handleDelete}
                fullWidth
              >
                Delete Subtitle
              </ActionButton>
            </Box>
          </Stack>
        </Stack>
        ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
            border: 2,
            borderStyle: "dashed",
            borderColor: "divider",
            borderRadius: 2,
            backgroundColor: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <EditIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Select a subtitle from the list to edit
          </Typography>
        </Box>
      )}
      
      {/* Export Button - Always visible at bottom */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          onClick={handleExport}
          disabled={isExporting}
          startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <ExportIcon />}
          sx={{
            py: 2,
            px: 3,
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: 3,
            textTransform: 'none',
            background: isExporting 
              ? 'linear-gradient(45deg, #9CA3AF 30%, #6B7280 90%)'
              : 'linear-gradient(45deg, #F59E0B 30%, #EAB308 90%)',
            boxShadow: isExporting 
              ? '0 2px 10px rgba(156, 163, 175, 0.2)'
              : '0 4px 20px rgba(245, 158, 11, 0.3)',
            '&:hover': {
              background: isExporting 
                ? 'linear-gradient(45deg, #9CA3AF 30%, #6B7280 90%)'
                : 'linear-gradient(45deg, #D97706 30%, #F59E0B 90%)',
              boxShadow: isExporting 
                ? '0 2px 10px rgba(156, 163, 175, 0.2)'
                : '0 6px 25px rgba(245, 158, 11, 0.4)',
              transform: isExporting ? 'none' : 'translateY(-2px)',
            },
            '&:active': {
              transform: isExporting ? 'none' : 'translateY(0px)',
            },
            '&:disabled': {
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'not-allowed',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {isExporting ? 'Navigating to Export...' : 'Export Subtitles'}
        </Button>
      </Box>
      </Box>
    </ReviewCard>
  );
};