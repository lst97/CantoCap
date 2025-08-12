import React, { useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material'
import {
  Preview as PreviewIcon,
  ContentCopy as ContentCopyIcon,
  Fullscreen as FullscreenIcon,
  Info as InfoIcon,
  FormatListNumbered as LineNumbersIcon
} from '@mui/icons-material'

import { 
  useExportStepContent, 
  useExportActions,
  useExportPreviewState,
  useExportPreviewContent,
  useSubtitles
} from '../../../stores/useStepStore'
import { BaseCard } from '../../elements'
import { detectLanguageFromFormat, addLineNumbers } from './utils'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import plaintext from 'highlight.js/lib/languages/plaintext'
import 'highlight.js/styles/vs2015.css'

// Register languages we might need for subtitle formats
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('plaintext', plaintext)

export const ExportPreview: React.FC = () => {
  const exportStep = useExportStepContent()
  const { updatePreviewState, generatePreviewContent } = useExportActions()
  const previewState = useExportPreviewState()
  const previewContent = useExportPreviewContent()
  const subtitles = useSubtitles()
  
  // Generate preview content when format or subtitles change
  useEffect(() => {
    generatePreviewContent()
  }, [exportStep.format, subtitles.length, generatePreviewContent])
  
  // Format file size helper
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])
  
  const handleCopyContent = useCallback(async () => {
    if (!previewContent) return
    
    try {
      await navigator.clipboard.writeText(previewContent)
      updatePreviewState({ copySnackbar: true })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }, [previewContent, updatePreviewState])
  
  const getHighlightedContent = useCallback((content: string, format: string) => {
    const language = detectLanguageFromFormat(format)
    
    try {
      // Check if language is registered before highlighting
      if (hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(content, { language })
        return highlighted.value
      } else {
        // If language not found, try plaintext fallback
        if (hljs.getLanguage('plaintext')) {
          const highlighted = hljs.highlight(content, { language: 'plaintext' })
          return highlighted.value
        }
      }
    } catch (error) {
      console.warn('Highlight.js error:', error)
    }
    
    // Ultimate fallback to plain text without highlighting
    return content
  }, [])
  
  const addLineNumbersToContent = useCallback((content: string) => {
    return addLineNumbers(content, previewState.showLineNumbers)
  }, [previewState.showLineNumbers])
  
  if (!previewContent) {
    return (
      <BaseCard variant="subtle" sx={{ p: 3, height: 'fit-content' }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PreviewIcon color="primary" />
          Export Preview
        </Typography>
        
        <Box sx={{ 
          p: 3,
          textAlign: 'center',
          color: 'text.secondary'
        }}>
          <InfoIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
          <Typography variant="body2">
            {subtitles.length === 0 
              ? 'Complete the transcription process to see preview'
              : 'Generating preview...'
            }
          </Typography>
        </Box>
      </BaseCard>
    )
  }
  
  return (
    <BaseCard variant="subtle" sx={{ p: 3, height: 'fit-content' }} role="region" aria-labelledby="preview-title">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography id="preview-title" variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PreviewIcon color="primary" />
          Export Preview
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={previewState.showLineNumbers ? "Hide line numbers" : "Show line numbers"}>
            <IconButton 
              size="small" 
              onClick={() => updatePreviewState({ showLineNumbers: !previewState.showLineNumbers })}
              color={previewState.showLineNumbers ? "primary" : "default"}
            >
              <LineNumbersIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={handleCopyContent}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View fullscreen">
            <IconButton size="small" onClick={() => updatePreviewState({ fullscreenOpen: true })}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Box sx={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        p: 2,
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        mb: 2,
        minHeight: 400,
        maxHeight: 600,
        overflow: 'auto',
        position: 'relative',
        '&::-webkit-scrollbar': {
          width: 8,
          height: 8
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          borderRadius: 4
        },
        '& .line-number': {
          color: 'rgba(255, 255, 255, 0.4)',
          marginRight: '12px',
          userSelect: 'none',
          fontWeight: 'normal'
        },
        '& .hljs': {
          background: 'transparent !important',
          padding: 0
        }
      }}>
        <pre 
          style={{ 
            margin: 0, 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            lineHeight: 1.5
          }}
          dangerouslySetInnerHTML={{
            __html: addLineNumbersToContent(getHighlightedContent(previewContent, exportStep.format))
          }}
        />
      </Box>
      
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Format:</Typography>
          <Typography variant="body2">{exportStep.format.toUpperCase()}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Estimated Size:</Typography>
          <Typography variant="body2">{formatFileSize(previewContent.length * 2)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Subtitles:</Typography>
          <Typography variant="body2">{subtitles.length} entries</Typography>
        </Box>
      </Stack>
      
      {/* Fullscreen Preview Dialog */}
      <Dialog 
        open={previewState.fullscreenOpen} 
        onClose={() => updatePreviewState({ fullscreenOpen: false })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography>Preview - {exportStep.format.toUpperCase()}</Typography>
          <IconButton onClick={handleCopyContent}>
            <ContentCopyIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            p: 2,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            height: '100%',
            overflow: 'auto',
            '& .line-number': {
              color: 'rgba(255, 255, 255, 0.4)',
              marginRight: '12px',
              userSelect: 'none',
              fontWeight: 'normal'
            },
            '& .hljs': {
              background: 'transparent !important',
              padding: 0
            }
          }}>
            <pre 
              style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                lineHeight: 1.5
              }}
              dangerouslySetInnerHTML={{
                __html: addLineNumbersToContent(getHighlightedContent(previewContent, exportStep.format))
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => updatePreviewState({ fullscreenOpen: false })}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Copy Success Snackbar */}
      <Snackbar
        open={previewState.copySnackbar}
        autoHideDuration={2000}
        onClose={() => updatePreviewState({ copySnackbar: false })}
        message="Content copied to clipboard!"
      />
    </BaseCard>
  )
}