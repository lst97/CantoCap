import { DiffPart, DiffOperation } from "./types";

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60; // Keep decimal precision
  
  // Format seconds with 2 decimal places
  const formattedSecs = secs.toFixed(2).padStart(5, "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${formattedSecs}`;
  }
  return `${minutes}:${formattedSecs}`;
};

export const parseTime = (timeString: string): number => {
  const parts = timeString.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

// Bilingual diff function for Chinese text and translation
export const generateBilingualDiff = (
  originalChinese: string,
  currentChinese: string,
  originalTranslation: string,
  currentTranslation: string
): { chinese: DiffPart[]; translation: DiffPart[] } => {
  const chineseDiff = generateCharacterDiff(originalChinese, currentChinese);
  const translationDiff = generateCharacterDiff(originalTranslation, currentTranslation);
  
  return {
    chinese: chineseDiff,
    translation: translationDiff
  };
};

// Character-level diff function using proper edit distance algorithm
export const generateCharacterDiff = (
  originalText: string,
  modifiedText: string
): DiffPart[] => {
  const diff: DiffPart[] = [];
  const original = originalText.split("");
  const modified = modifiedText.split("");

  // Create edit distance matrix using Wagner-Fischer algorithm
  const dp = Array(original.length + 1)
    .fill(null)
    .map(() => Array(modified.length + 1).fill(0));

  // Fill the matrix with edit distances
  for (let i = 0; i <= original.length; i++) {
    for (let j = 0; j <= modified.length; j++) {
      if (i === 0) {
        dp[i][j] = j; // All insertions
      } else if (j === 0) {
        dp[i][j] = i; // All deletions
      } else if (original[i - 1] === modified[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]; // No operation needed
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // Deletion
            dp[i][j - 1], // Insertion
            dp[i - 1][j - 1] // Substitution
          );
      }
    }
  }

  // Backtrack to construct the diff operations
  let i = original.length,
    j = modified.length;
  const operations: DiffOperation[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
      // Characters match - unchanged
      operations.unshift({ type: "unchanged", char: original[i - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution - treat as removal + addition
      operations.unshift({ type: "removed", char: original[i - 1] });
      operations.unshift({ type: "added", char: modified[j - 1] });
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      // Insertion
      operations.unshift({ type: "added", char: modified[j - 1] });
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      // Deletion
      operations.unshift({ type: "removed", char: original[i - 1] });
      i--;
    }
  }

  // Group consecutive operations of the same type
  for (const op of operations) {
    if (diff.length > 0 && diff[diff.length - 1].type === op.type) {
      diff[diff.length - 1].text += op.char;
    } else {
      diff.push({ type: op.type, text: op.char });
    }
  }

  return diff;
};