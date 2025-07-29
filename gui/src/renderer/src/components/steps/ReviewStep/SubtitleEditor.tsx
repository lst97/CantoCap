import React, { useState, useEffect } from "react";
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
import { useSubtitleEditStore } from "../../../stores/subtitle-edit-store";
import { useWorkflowStore } from "../../../stores/workflow-store";
import { ReviewCard, ActionButton } from "./styles";
import { formatTime, parseTime } from "./utils";
import { SubtitleEditorProps } from "./types";

export const SubtitleEditor: React.FC<SubtitleEditorProps> = () => {
  const {
    session,
    updateSubtitle,
    deleteSubtitle,
    splitSubtitle,
    mergeSubtitles,
    setSelectedSubtitle,
    undo,
    redo,
    undoStack,
    redoStack,
    clearUndoRedo,
  } = useSubtitleEditStore();
  
  const { setCurrentStep, completeStep } = useWorkflowStore();

  const [editText, setEditText] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const editingSubtitle = session?.selectedSubtitleId
    ? session.currentSubtitles.find((s) => s.id === session.selectedSubtitleId)
    : null;

  // Check if this is a new subtitle (empty text and no original text)
  const isNewSubtitle =
    editingSubtitle && !editingSubtitle.text && !editingSubtitle.originalText;

  // Update local state when selected subtitle changes
  useEffect(() => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text);
      setEditStartTime(formatTime(editingSubtitle.startTime));
      setEditEndTime(formatTime(editingSubtitle.endTime));
      setHasChanges(false);
    }
  }, [editingSubtitle]);

  const handleTextChange = (value: string) => {
    setEditText(value);
    setHasChanges(editingSubtitle?.text !== value);
  };

  const handleSave = () => {
    if (!editingSubtitle || !hasChanges) return;

    updateSubtitle(editingSubtitle.id, {
      text: editText,
      startTime: parseTime(editStartTime),
      endTime: parseTime(editEndTime),
    });
    setHasChanges(false);
  };

  const handleCancel = () => {
    if (editingSubtitle) {
      setEditText(editingSubtitle.text);
      setEditStartTime(formatTime(editingSubtitle.startTime));
      setEditEndTime(formatTime(editingSubtitle.endTime));
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    if (editingSubtitle && editingSubtitle.originalText) {
      // Update the subtitle in the store with original text
      updateSubtitle(editingSubtitle.id, {
        text: editingSubtitle.originalText,
      });

      // Update local editing state
      setEditText(editingSubtitle.originalText);
      setHasChanges(false);

      // Clear undo/redo stacks since we've reset to original state
      clearUndoRedo();
    }
  };

  const handleDelete = () => {
    if (editingSubtitle) {
      deleteSubtitle(editingSubtitle.id);
      setSelectedSubtitle(null);
    }
  };

  const handleExport = () => {
    completeStep('review');
    setCurrentStep('export');
  };

  const handleSplit = () => {
    if (editingSubtitle && session) {
      const splitTime =
        session.currentTime ||
        (editingSubtitle.startTime + editingSubtitle.endTime) / 2;
      if (
        splitTime > editingSubtitle.startTime &&
        splitTime < editingSubtitle.endTime
      ) {
        splitSubtitle(editingSubtitle.id, splitTime);
      }
    }
  };

  const handleMergeNext = () => {
    if (!editingSubtitle || !session) return;

    const currentIndex = session.currentSubtitles.findIndex(
      (s) => s.id === editingSubtitle.id
    );
    if (
      currentIndex >= 0 &&
      currentIndex < session.currentSubtitles.length - 1
    ) {
      const nextSubtitle = session.currentSubtitles[currentIndex + 1];
      mergeSubtitles(editingSubtitle.id, nextSubtitle.id);
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
          <Tooltip title="Reset to Original">
            <IconButton
              size="small"
              onClick={handleReset}
              disabled={
                !editingSubtitle?.originalText ||
                editingSubtitle.originalText === editText
              }
              sx={{ color: "#F59E0B" }}
            >
              <RestoreIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Undo">
            <IconButton
              size="small"
              onClick={undo}
              disabled={undoStack.length === 0}
            >
              <UndoIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Redo">
            <IconButton
              size="small"
              onClick={redo}
              disabled={redoStack.length === 0}
            >
              <RedoIcon />
            </IconButton>
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
            label="Subtitle Text"
            value={editText}
            onChange={(e) => handleTextChange(e.target.value)}
            multiline
            rows={4}
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
              startIcon={<SaveIcon />}
              size="small"
              sx={{ flex: 1 }}
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Changes
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
                  !session ||
                  !session.currentTime ||
                  session.currentTime <= editingSubtitle.startTime ||
                  session.currentTime >= editingSubtitle.endTime
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
          startIcon={<ExportIcon />}
          sx={{
            py: 2,
            px: 3,
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: 3,
            textTransform: 'none',
            background: 'linear-gradient(45deg, #F59E0B 30%, #EAB308 90%)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #D97706 30%, #F59E0B 90%)',
              boxShadow: '0 6px 25px rgba(245, 158, 11, 0.4)',
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'translateY(0px)',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          Export Subtitles
        </Button>
      </Box>
      </Box>
    </ReviewCard>
  );
};