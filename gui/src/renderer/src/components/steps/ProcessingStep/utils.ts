import React from "react";
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { StageInfo } from "./types";

// Simple stage information for display
export const getStageInfo = (stage: string): StageInfo => {
  switch (stage) {
    case "preparing":
      return { name: "Preparing", emoji: "⚙️" };
    case "transcribing":
      return { name: "Transcribing", emoji: "🗣️" };
    case "refining":
      return { name: "Refining", emoji: "✨" };
    case "completed":
      return { name: "Completed", emoji: "✅" };
    case "error":
      return { name: "Error", emoji: "❌" };
    default:
      return { name: "Processing", emoji: "🔄" };
  }
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export const getErrorIcon = (errorType: string) => {
  switch (errorType) {
    case "startup_error":
    case "setup_error":
      return React.createElement(WarningIcon, { sx: { color: "#FEE75C" } });
    case "runtime_error":
    case "exit_error":
      return React.createElement(ErrorIcon, { sx: { color: "#ED4245" } });
    case "spawn_error":
      return React.createElement(InfoIcon, { sx: { color: "#7DD3FC" } });
    default:
      return React.createElement(ErrorIcon, { sx: { color: "#ED4245" } });
  }
};

export const getStageEmoji = (stage: string): string => {
  switch (stage) {
    case "preparing":
      return "⚙️";
    case "transcribing":
      return "🗣️";
    case "refining":
      return "✨";
    case "completed":
      return "✅";
    case "error":
      return "❌";
    default:
      return "🔄";
  }
};

export const getStageDescription = (stage: string): string => {
  switch (stage) {
    case "preparing":
      return "Setting up processing environment";
    case "transcribing":
      return "Converting speech to text";
    case "refining":
      return "Enhancing quality with AI";
    case "completed":
      return "Processing completed successfully";
    case "error":
      return "An error occurred";
    default:
      return "Processing...";
  }
};