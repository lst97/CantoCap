import React, { useState, useCallback } from 'react'
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

import { useExportStore } from '../../../stores/export-store'
import { BaseCard } from '../../elements'
import { detectLanguageFromFormat, addLineNumbers } from './utils'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/vs2015.css'

// Register languages we might need for subtitle formats
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('xml', xml)

export const ExportPreview: React.FC = () => {
  const { preview, formatFileSize } = useExportStore()
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [copySnackbar, setCopySnackbar] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  
  const handleCopyContent = useCallback(async () => {
    if (!preview?.content) return
    
    try {
      await navigator.clipboard.writeText(preview.content)
      setCopySnackbar(true)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }, [preview?.content])
  
  const getHighlightedContent = useCallback((content: string, format: string) => {
    const language = detectLanguageFromFormat(format)
    
    try {
      const highlighted = hljs.highlight(content, { language })
      return highlighted.value
    } catch {
      // Fallback to plain text if highlighting fails
      return content
    }
  }, [])
  
  const addLineNumbersToContent = useCallback((content: string) => {
    return addLineNumbers(content, showLineNumbers)
  }, [showLineNumbers])
  
  if (!preview) {
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
            Select a format and configure options to see preview
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
          <Tooltip title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}>
            <IconButton 
              size="small" 
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              color={showLineNumbers ? "primary" : "default"}
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
            <IconButton size="small" onClick={() => setFullscreenOpen(true)}>
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
            __html: addLineNumbersToContent(getHighlightedContent(preview.content, preview.format.id))
          }}
        />
      </Box>
      
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Format:</Typography>
          <Typography variant="body2">{preview.format.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Estimated Size:</Typography>
          <Typography variant="body2">{formatFileSize(preview.estimatedSize)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Subtitles:</Typography>
          <Typography variant="body2">{preview.subtitleCount} entries</Typography>
        </Box>
      </Stack>
      
      {/* Fullscreen Preview Dialog */}
      <Dialog 
        open={fullscreenOpen} 
        onClose={() => setFullscreenOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography>Preview - {preview.format.name}</Typography>
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
                __html: addLineNumbersToContent(getHighlightedContent(preview.content, preview.format.id))
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFullscreenOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Copy Success Snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message="Content copied to clipboard!"
      />
    </BaseCard>
  )
}