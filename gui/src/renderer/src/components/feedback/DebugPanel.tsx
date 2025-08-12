import React from 'react'
import { Box, Typography } from '@mui/material'

/**
 * DebugPanel - Simplified placeholder during migration
 * TODO: Implement proper debug panel with new stores
 */
export const DebugPanel: React.FC = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">
        Debug Panel
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Debug functionality coming soon...
      </Typography>
    </Box>
  )
}