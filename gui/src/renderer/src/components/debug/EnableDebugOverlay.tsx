import React, { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { StepLoadingDebug } from './StepLoadingDebug'

/**
 * Component to easily enable the debug overlay for testing
 * Add this to MainContentArea temporarily to test overlay behavior
 */
export const EnableDebugOverlay: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false)

  return (
    <>
      {/* Debug Toggle Button */}
      <Box 
        sx={{ 
          position: 'fixed', 
          top: 10, 
          left: 10, 
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        <Button 
          variant="contained" 
          size="small" 
          onClick={() => setShowDebug(!showDebug)}
          sx={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </Button>
        
        {showDebug && (
          <Typography variant="caption" sx={{ color: 'white', backgroundColor: 'rgba(0, 0, 0, 0.8)', p: 1, borderRadius: 1 }}>
            Test workspace switching to see smooth transitions
          </Typography>
        )}
      </Box>

      {/* Debug Overlay */}
      {showDebug && <StepLoadingDebug />}
    </>
  )
}

// To use this component, temporarily add it to MainContentArea:
// 
// import { EnableDebugOverlay } from '../debug/EnableDebugOverlay'
//
// Then in the JSX:
// <EnableDebugOverlay />

export default EnableDebugOverlay