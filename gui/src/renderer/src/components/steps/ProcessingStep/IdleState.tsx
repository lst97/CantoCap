import React from "react";
import {
  Box,
  Typography,
  Stack,
} from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Visibility as ReviewIcon,
  RestartAlt as RestartIcon,
} from "@mui/icons-material";
import { useAppStore } from "../../../stores/app-store";
import { useWorkflowStore } from "../../../stores/workflow-store";
import { ProcessingCard, GuideButton, SecondaryGuideButton } from "./styles";

export const IdleState: React.FC = () => {
  const { setCurrentStep } = useWorkflowStore();
  const { config } = useAppStore();

  const handleNewGeneration = () => {
    setCurrentStep("config");
  };

  const handleReviewResults = () => {
    setCurrentStep("review");
  };

  return (
    <ProcessingCard>
      <Box sx={{ textAlign: "center", py: 2 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <RestartIcon sx={{ fontSize: "3rem", color: "#F59E0B", mb: 2 }} />
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, mb: 1, color: "#FFFFFF" }}
          >
            Ready to Process
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: "text.secondary", maxWidth: 400, mx: "auto" }}
          >
            Choose what you'd like to do next. You can generate new subtitles or
            review previous results.
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Stack spacing={3} sx={{ maxWidth: 500, mx: "auto" }}>
          <GuideButton
            fullWidth
            startIcon={<PlayIcon />}
            onClick={handleNewGeneration}
          >
            <Box sx={{ textAlign: "left", flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Generate New Subtitles
              </Typography>
              <Typography
                variant="body2"
                sx={{ opacity: 0.8, fontSize: "0.85rem" }}
              >
                Go to Configuration step to set up and start a new transcription
              </Typography>
            </Box>
          </GuideButton>

          <SecondaryGuideButton
            fullWidth
            startIcon={<ReviewIcon />}
            onClick={handleReviewResults}
          >
            <Box sx={{ textAlign: "left", flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Review Previous Results
              </Typography>
              <Typography
                variant="body2"
                sx={{ opacity: 0.8, fontSize: "0.85rem" }}
              >
                View and edit previously generated subtitles
              </Typography>
            </Box>
          </SecondaryGuideButton>
        </Stack>

        {/* Current Configuration Info */}
        {config.inputFile && (
          <Box
            sx={{
              mt: 4,
              pt: 3,
              borderTop: "1px solid rgba(64, 68, 75, 0.3)",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              Last processed file:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#7DD3FC",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                wordBreak: "break-all",
              }}
            >
              {config.inputFile}
            </Typography>
          </Box>
        )}
      </Box>
    </ProcessingCard>
  );
};