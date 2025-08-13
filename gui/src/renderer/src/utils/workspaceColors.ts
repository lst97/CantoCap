// ============================================================================
// WORKSPACE COLOR UTILITIES
// ============================================================================

export const WORKSPACE_COLORS = [
  '#5865F2', // Discord Blurple
  '#57F287', // Green
  '#FEE75C', // Yellow
  '#ED4245', // Red
  '#EB459E', // Pink
  '#FF7A00', // Orange
  '#00D4AA', // Teal
  '#9C59B6', // Purple
  '#3498DB', // Blue
  '#E67E22', // Dark Orange
] as const;

export type WorkspaceColor = typeof WORKSPACE_COLORS[number];

/**
 * Generate a random color from the predefined workspace color palette
 */
export const getRandomWorkspaceColor = (): WorkspaceColor => {
  const randomIndex = Math.floor(Math.random() * WORKSPACE_COLORS.length);
  return WORKSPACE_COLORS[randomIndex];
};

/**
 * Check if a color is valid workspace color
 */
export const isValidWorkspaceColor = (color: string): color is WorkspaceColor => {
  return WORKSPACE_COLORS.includes(color as WorkspaceColor);
};

/**
 * Get color name for display purposes
 */
export const getColorName = (color: WorkspaceColor): string => {
  const colorNames: Record<WorkspaceColor, string> = {
    '#5865F2': 'Blurple',
    '#57F287': 'Green',
    '#FEE75C': 'Yellow',
    '#ED4245': 'Red',
    '#EB459E': 'Pink',
    '#FF7A00': 'Orange',
    '#00D4AA': 'Teal',
    '#9C59B6': 'Purple',
    '#3498DB': 'Blue',
    '#E67E22': 'Dark Orange',
  };
  
  return colorNames[color] || 'Custom';
};