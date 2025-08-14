import { styled } from "@mui/material/styles";
import { Paper, Chip, Button } from "@mui/material";
import { ModificationChipProps } from "./types";

// Add CSS animation for pulse effect
export const pulseKeyframes = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
`;

// Styled components matching app theme
export const ReviewCard = styled(Paper)(({ theme }) => ({
  backgroundColor: "#2F3136",
  borderRadius: 16,
  border: "1px solid rgba(64, 68, 75, 0.3)",
  padding: theme.spacing(3),
  height: "fit-content",
}));

export const ModificationChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'modificationType',
})<ModificationChipProps>(
  ({ modificationType }) => {
    const colors = {
      added: {
        bg: "rgba(87, 242, 135, 0.1)",
        border: "rgba(87, 242, 135, 0.3)",
        color: "#57F287",
      },
      modified: {
        bg: "rgba(245, 158, 11, 0.1)",
        border: "rgba(245, 158, 11, 0.3)",
        color: "#F59E0B",
      },
      deleted: {
        bg: "rgba(237, 66, 69, 0.1)",
        border: "rgba(237, 66, 69, 0.3)",
        color: "#ED4245",
      },
    };
    const colorScheme = colors[modificationType];

    return {
      backgroundColor: colorScheme.bg,
      borderColor: colorScheme.border,
      color: colorScheme.color,
      fontWeight: 500,
      "& .MuiChip-icon": {
        color: colorScheme.color,
      },
    };
  }
);

export const ActionButton = styled(Button)(() => ({
  backgroundColor: "rgba(245, 158, 11, 0.1)",
  color: "#F59E0B",
  border: "1px solid rgba(245, 158, 11, 0.3)",
  borderRadius: 8,
  "&:hover": {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
}));