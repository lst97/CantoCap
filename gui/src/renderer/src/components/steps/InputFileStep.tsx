import React from 'react'
import { Box } from '@mui/material'
import { InputPanel } from '../InputPanel'

export const InputFileStep: React.FC = () => {
  return (
    <Box sx={{ height: '100%', p: 3 }}>
      {/* File Upload, Media Preview & Range Selection */}
      <InputPanel />
    </Box>
  )
}