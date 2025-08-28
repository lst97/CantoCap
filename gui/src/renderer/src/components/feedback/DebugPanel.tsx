import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useInputStepContent, useConfigStepContent } from '../../stores/useStepStore'

export const DebugPanel: React.FC = () => {
  const inputStep = useInputStepContent()
  const configStep = useConfigStepContent()

  const [command, setCommand] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  // Build the command preview whenever input/config changes
  const deps = useMemo(() => ({
    inputFile: inputStep?.inputFile || inputStep?.selectedFile,
    outputFile: configStep?.outputFile,
    charset: configStep?.charset,
    language: configStep?.language,
    subtitle: configStep?.subtitle,
    model: configStep?.modelSettings?.whisperModel,
    gemini: configStep?.apiKeys?.gemini,
    hf: configStep?.apiKeys?.huggingface,
    speakers: configStep?.speakers,
    written: configStep?.written,
    music: configStep?.music,
    chunk: configStep?.advancedSettings?.chunkDuration,
    workers: configStep?.advancedSettings?.numWorkers,
    diar: configStep?.advancedSettings?.enableSpeakerDiarization,
    md: configStep?.advancedSettings?.enableMusicDetection,
    priority: configStep?.priority,
    noGemini: configStep?.noGeminiRefinement,
    maxChunk: configStep?.maxChunkDuration,
    vq: configStep?.videoQuality,
    term: configStep?.terminologyConfig,
    ffmpeg: configStep?.ffmpegPath,
    verbose: configStep?.verbose,
  }), [
    inputStep?.inputFile,
    inputStep?.selectedFile,
    configStep?.outputFile,
    configStep?.charset,
    configStep?.language,
    configStep?.subtitle,
    configStep?.modelSettings?.whisperModel,
    configStep?.apiKeys?.gemini,
    configStep?.apiKeys?.huggingface,
    configStep?.speakers,
    configStep?.written,
    configStep?.music,
    configStep?.advancedSettings?.chunkDuration,
    configStep?.advancedSettings?.numWorkers,
    configStep?.advancedSettings?.enableSpeakerDiarization,
    configStep?.advancedSettings?.enableMusicDetection,
    configStep?.priority,
    configStep?.noGeminiRefinement,
    configStep?.maxChunkDuration,
    configStep?.videoQuality,
    configStep?.terminologyConfig,
    configStep?.ffmpegPath,
    configStep?.verbose,
  ])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        setError('')

        if (!deps.inputFile) {
          if (!cancelled) {
            setCommand('')
            setError('Select an input file to preview the command')
          }
          return
        }

        // 1) Convert step store to ProcessingConfig
        const conversion = await (window as any).cantocapAPI.processingConvertConfig({
          inputStep,
          configStep,
        })
        if (!conversion?.success || !conversion.config) {
          const err = conversion?.error || 'Failed to convert configuration'
          if (!cancelled) {
            setCommand('')
            setError(String(err))
          }
          return
        }

        // 2) Ask main process for the full command
        const preview = await (window as any).cantocapAPI.processingGetCommandPreview(conversion.config)
        if (!preview?.success || !preview.command) {
          const err = preview?.error || 'Failed to build command'
          if (!cancelled) {
            setCommand('')
            setError(String(err))
          }
          return
        }

        if (!cancelled) {
          setCommand(preview.command)
          setError('')
        }
      } catch (e) {
        if (!cancelled) {
          setCommand('')
          setError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [deps, inputStep, configStep])

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        maxWidth: '60vw',
        width: 'calc(100vw - 24px)',
        px: 1,
      }}
    >
      <Accordion sx={{ backgroundColor: '#2F3136', color: '#fff', border: '1px solid #3b3e45', borderRadius: 2 }} defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#bbb' }} />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Python Engine Command</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {loading ? (
            <Typography variant="body2" color="text.secondary">Generating command…</Typography>
          ) : error ? (
            <Typography variant="body2" color="warning.main">{error}</Typography>
          ) : command ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  flex: 1,
                  p: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 1,
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  overflowX: 'auto',
                }}
                title={command}
              >
                {command}
              </Box>
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() => navigator.clipboard && command && navigator.clipboard.writeText(command)}
                  sx={{ color: '#ddd' }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Select an input file to preview the command.</Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
