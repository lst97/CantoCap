import React from "react";
import {
  Typography,
  Stack,
  Box,
} from "@mui/material";
import {
  Info as InfoIcon,
} from "@mui/icons-material";
import { useAppStore } from "../../../stores/app-store";
import { ProcessingCard } from "./styles";
import { getStageEmoji, getStageDescription } from "./utils";

export const ProcessingStatus: React.FC = () => {
  const { processing } = useAppStore();

  return (
    <ProcessingCard>
      <Typography
        variant="h6"
        sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
      >
        <InfoIcon sx={{ color: "#7DD3FC" }} />
        Current Status
      </Typography>

      <Stack spacing={3}>
        {/* Current Stage */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 2, color: "text.secondary" }}
          >
            Processing Stage
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              borderRadius: 2,
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <Typography sx={{ fontSize: 24 }}>
              {getStageEmoji(processing.stage)}
            </Typography>
            <Box>
              <Typography
                variant="body1"
                sx={{ fontWeight: 600, textTransform: "capitalize" }}
              >
                {processing.stage}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getStageDescription(processing.stage)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Current Message */}
        {processing.message && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, color: "text.secondary" }}
            >
              Current Activity
            </Typography>
            <Typography
              variant="body2"
              sx={{
                p: 2,
                backgroundColor: "rgba(64, 68, 75, 0.3)",
                borderRadius: 1,
                fontStyle: "italic",
              }}
            >
              {processing.message}
            </Typography>
          </Box>
        )}
      </Stack>
    </ProcessingCard>
  );
};