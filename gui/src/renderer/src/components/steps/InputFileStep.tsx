import React from 'react'
import { Box } from '@mui/material'
import { InputPanel } from '../ui/InputPanel'
import { ErrorBoundary } from '../common/ErrorBoundary'

export const InputFileStep: React.FC = () => {
  return (
    <Box sx={{ 
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* File Upload, Media Preview & Range Selection */}
      <ErrorBoundary 
        fallbackTitle="File Upload Error" 
        fallbackMessage="An error occurred while processing your video file. This might be due to a corrupted file, unsupported format, or insufficient system resources. Please try again with a different file or use the 'Browse Files' button instead of drag and drop."
      >
        <InputPanel />
      </ErrorBoundary>
    </Box>
  )
}