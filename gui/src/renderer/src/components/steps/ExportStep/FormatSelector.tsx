import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Chip,
  Alert,
  Tooltip
} from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'

import { useExportStore } from '../../../stores/export-store'
import { validateForFormat } from '../../../utils/format-converters'

export const FormatSelector: React.FC = () => {
  const { 
    settings, 
    formats, 
    getSubtitleData, 
    updateSettings,
    clearError 
  } = useExportStore()
  
  const subtitles = getSubtitleData()
  const [validationIssues, setValidationIssues] = useState<Record<string, string[]>>({})
  
  // Validate formats when subtitles or selected format changes
  useEffect(() => {
    const issues: Record<string, string[]> = {}
    formats.forEach(format => {
      const formatIssues = validateForFormat(subtitles, format.id)
      if (formatIssues.length > 0) {
        issues[format.id] = formatIssues
      }
    })
    setValidationIssues(issues)
  }, [subtitles, formats])
  
  const handleFormatChange = useCallback((formatId: string) => {
    updateSettings({ selectedFormat: formatId })
    clearError()
  }, [updateSettings, clearError])

  return (
    <Box role="region" aria-labelledby="format-selector-title">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2,
          width: '100%'
        }}
      >
        {formats.map((format) => {
          const hasIssues = validationIssues[format.id]?.length > 0
          const isSelected = settings.selectedFormat === format.id
          
          return (
            <Box 
              key={format.id}
              sx={{ 
                p: 2, 
                border: 1,
                borderRadius: 2,
                borderColor: isSelected 
                  ? 'primary.main' 
                  : hasIssues 
                    ? 'warning.main' 
                    : 'rgba(255, 255, 255, 0.1)',
                backgroundColor: hasIssues 
                  ? 'rgba(245, 158, 11, 0.02)'
                  : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s ease-in-out',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  transform: 'translateY(-1px)'
                }
              }}
              onClick={() => handleFormatChange(format.id)}
            >
              <Box sx={{ width: '100%', flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {format.name}
                  </Typography>
                  {hasIssues && (
                    <Tooltip title={validationIssues[format.id]?.join(', ')}>
                      <WarningIcon color="warning" fontSize="small" />
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {format.description}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: hasIssues ? 1 : 0 }}>
                  {format.features.map((feature) => (
                    <Chip key={feature} label={feature} size="small" variant="outlined" />
                  ))}
                </Box>
                {hasIssues && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      {validationIssues[format.id]?.slice(0, 2).join('; ')}
                      {validationIssues[format.id]?.length > 2 && '...'}
                    </Typography>
                  </Alert>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}