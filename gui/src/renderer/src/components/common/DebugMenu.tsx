import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  Info as InfoIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon
} from '@mui/icons-material'

interface DebugMenuProps {
  show?: boolean
}

/**
 * DebugMenu - Development debugging interface
 * Shows application state, performance info, and debugging controls
 */
export const DebugMenu: React.FC<DebugMenuProps> = ({ show = false }) => {
  const [isVisible, setIsVisible] = useState(show)

  // Only show in development
  if (process.env.NODE_ENV === 'production' && !show) {
    return null
  }

  if (!isVisible) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={() => setIsVisible(true)}
        startIcon={<BugReportIcon />}
        sx={{
          position: 'fixed',
          top: 64,
          right: 16,
          zIndex: 9998,
          backgroundColor: 'background.paper',
          borderColor: 'primary.main',
        }}
      >
        Debug Info
      </Button>
    )
  }

  const debugInfo = {
    environment: process.env.NODE_ENV || 'unknown',
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    location: window.location.href,
    electronAPI: !!window.electronAPI,
    cantocapAPI: !!window.cantocapAPI,
  }

  const handleOpenDevTools = async () => {
    try {
      if (window.electronAPI?.toggleDevTools) {
        await window.electronAPI.toggleDevTools()
      }
    } catch (error) {
      console.error('Failed to open DevTools:', error)
    }
  }

  const handleReload = () => {
    window.location.reload()
  }

  const handleClearStorage = () => {
    localStorage.clear()
    sessionStorage.clear()
    console.log('Local storage cleared')
  }

  return (
    <Card
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 400,
        maxHeight: 600,
        overflow: 'auto',
        zIndex: 9998,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'primary.main',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReportIcon />
            Debug Console
          </Typography>
          <Button size="small" onClick={() => setIsVisible(false)}>
            ×
          </Button>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            onClick={handleOpenDevTools}
            startIcon={<BugReportIcon />}
          >
            DevTools
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleReload}
          >
            Reload
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={handleClearStorage}
          >
            Clear Storage
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* System Information */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" />
              <Typography variant="subtitle2">System Information</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Environment:</Typography>
                <Chip 
                  label={debugInfo.environment} 
                  size="small" 
                  color={debugInfo.environment === 'development' ? 'success' : 'default'}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Viewport:</Typography>
                <Typography variant="body2" color="text.secondary">
                  {debugInfo.viewport}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">ElectronAPI:</Typography>
                <Chip 
                  label={debugInfo.electronAPI ? 'Available' : 'Missing'} 
                  size="small" 
                  color={debugInfo.electronAPI ? 'success' : 'error'}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">CantoCap API:</Typography>
                <Chip 
                  label={debugInfo.cantocapAPI ? 'Available' : 'Missing'} 
                  size="small" 
                  color={debugInfo.cantocapAPI ? 'success' : 'error'}
                />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Storage Information */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon fontSize="small" />
              <Typography variant="subtitle2">Storage</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">localStorage items:</Typography>
                <Typography variant="body2" color="text.secondary">
                  {localStorage.length}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">sessionStorage items:</Typography>
                <Typography variant="body2" color="text.secondary">
                  {sessionStorage.length}
                </Typography>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Performance Information */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MemoryIcon fontSize="small" />
              <Typography variant="subtitle2">Performance</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Timestamp: {debugInfo.timestamp}
              </Typography>
              {(performance as any).memory && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Used JS Heap:</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total JS Heap:</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024)}MB
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Development Debug Interface - Press F12 or use DevTools button for Chrome DevTools
        </Typography>
      </CardContent>
    </Card>
  )
}

export default DebugMenu