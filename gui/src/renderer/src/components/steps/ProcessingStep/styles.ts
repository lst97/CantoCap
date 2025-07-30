import { styled } from "@mui/material/styles";
import { Paper, Button, Box } from "@mui/material";

// Custom styled components matching Discord theme
export const ProcessingCard = styled(Paper)(({ theme }) => ({
  backgroundColor: "#2F3136",
  borderRadius: 16,
  border: "1px solid rgba(64, 68, 75, 0.3)",
  padding: theme.spacing(3),
  height: "fit-content",
}));

export const TerminateButton = styled(Button)(() => ({
  backgroundColor: "#ED4245",
  color: "#FFFFFF",
  borderRadius: 12,
  padding: "12px 24px",
  fontSize: "0.875rem",
  fontWeight: 600,
  textTransform: "none",
  "&:hover": {
    backgroundColor: "#DC2626",
    transform: "translateY(-1px)",
    boxShadow: "0px 4px 8px rgba(237, 66, 69, 0.3)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
}));

export const ErrorCard = styled(Paper)(({ theme }) => ({
  backgroundColor: "rgba(237, 66, 69, 0.1)",
  borderRadius: 16,
  border: "1px solid rgba(237, 66, 69, 0.3)",
  padding: 0, // Remove padding to let internal content handle spacing
  marginTop: theme.spacing(2),
  maxHeight: "80vh",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  // Custom scrollbar styling
  "&::-webkit-scrollbar": {
    width: "8px",
  },
  "&::-webkit-scrollbar-track": {
    background: "rgba(0, 0, 0, 0.1)",
    borderRadius: "4px",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(237, 66, 69, 0.3)",
    borderRadius: "4px",
    "&:hover": {
      background: "rgba(237, 66, 69, 0.5)",
    },
  },
}));

export const SuccessCard = styled(Paper)(({ theme }) => ({
  backgroundColor: "rgba(87, 242, 135, 0.08)",
  borderRadius: 16,
  border: "2px solid rgba(87, 242, 135, 0.2)",
  padding: theme.spacing(3),
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    background: "linear-gradient(90deg, #57F287 0%, #22C55E 50%, #16A34A 100%)",
  },
}));

export const InfoSection = styled(Box)(({ theme }) => ({
  backgroundColor: "rgba(64, 68, 75, 0.2)",
  borderRadius: 12,
  border: "1px solid rgba(64, 68, 75, 0.4)",
  padding: theme.spacing(2.5),
  position: "relative",
}));

export const CelebrationHeader = styled(Box)(({ theme }) => ({
  textAlign: "center",
  marginBottom: theme.spacing(3),
  position: "relative",
  "& .celebration-icon": {
    fontSize: "4rem",
    color: "#57F287",
    marginBottom: theme.spacing(1),
    filter: "drop-shadow(0px 4px 8px rgba(87, 242, 135, 0.3))",
  },
}));

export const GuideButton = styled(Button)(() => ({
  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  color: "#000000",
  borderRadius: 12,
  padding: "16px 24px",
  fontSize: "0.95rem",
  fontWeight: 600,
  textTransform: "none",
  border: "none",
  minHeight: "64px",
  boxShadow:
    "0px 1px 3px rgba(245, 158, 11, 0.12), 0px 1px 2px rgba(245, 158, 11, 0.24)",
  "&:hover": {
    background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
    transform: "translateY(-1px)",
    boxShadow:
      "0px 4px 8px rgba(245, 158, 11, 0.15), 0px 2px 4px rgba(245, 158, 11, 0.3)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
}));

export const SecondaryGuideButton = styled(Button)(() => ({
  background: "transparent",
  color: "#F59E0B",
  border: "2px solid #F59E0B",
  borderRadius: 12,
  padding: "14px 22px", // Slightly adjusted for border
  fontSize: "0.95rem",
  fontWeight: 600,
  textTransform: "none",
  minHeight: "64px",
  "&:hover": {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "#FCD34D",
    color: "#FCD34D",
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
}));