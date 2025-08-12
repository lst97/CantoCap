import React, { useState, useCallback } from 'react'
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Fade
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  SmartToy as ModelIcon,
  Build as ConfigIcon
} from '@mui/icons-material'
import { ModelSettings } from './ModelSettings'
import { AdvancedSettings } from './AdvancedSettings'
import { useAppStore } from '../../stores/useAppStore'

interface AccordionSection {
  id: string
  title: string
  icon: React.ReactNode
  badge?: string | number
  badgeColor?: 'error' | 'warning' | 'success' | 'info' | 'primary'
  defaultExpanded?: boolean
  component: React.ReactNode
}

export const AdvancedPanel: React.FC = () => {
  const { config } = useAppStore()
  
  // Track which accordion sections are expanded
  const [expanded, setExpanded] = useState<string[]>(['model-processing'])

  const handleAccordionChange = useCallback((panel: string) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpanded(prev => 
      isExpanded 
        ? [...prev.filter(p => p !== panel), panel]
        : prev.filter(p => p !== panel)
    )
  }, [])

  const accordionSections: AccordionSection[] = [
    {
      id: 'model-processing',
      title: 'Model & Processing',
      icon: <ModelIcon sx={{ fontSize: 20 }} />,
      defaultExpanded: true,
      component: <ModelSettings />
    },
    {
      id: 'advanced-config',
      title: 'Advanced Configuration',
      icon: <ConfigIcon sx={{ fontSize: 20 }} />,
      badge: config.terminologyConfig || config.ffmpegPath ? '●' : undefined,
      badgeColor: 'warning',
      component: <AdvancedSettings />
    }
  ]

  const accordionSx = {
    backgroundColor: '#2F3136',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px !important',
    overflow: 'hidden',
    mb: 2,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    '&:before': {
      display: 'none', // Remove default MUI accordion border
    },
    '&.Mui-expanded': {
      margin: '0 0 16px 0',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      backgroundColor: '#36393F',
      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)',
    },
    '&:hover': {
      borderColor: 'rgba(245, 158, 11, 0.3)',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const accordionSummarySx = {
    backgroundColor: 'transparent',
    minHeight: '64px',
    padding: '0 20px',
    '&.Mui-expanded': {
      minHeight: '64px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(245, 158, 11, 0.05)',
    },
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '& .MuiAccordionSummary-expandIconWrapper': {
      color: '#96989D',
      transition: 'all 0.3s',
      '&.Mui-expanded': {
        color: '#F59E0B',
        transform: 'rotate(180deg)',
      },
    },
    '& .MuiAccordionSummary-content': {
      margin: '16px 0',
      '&.Mui-expanded': {
        margin: '16px 0',
      },
    },
  }

  const accordionDetailsSx = {
    backgroundColor: '#36393F',
    padding: '20px 24px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  }

  return (
    <Fade in={true} timeout={400}>
      <Box sx={{ width: '100%' }}>
        {/* Accordion Sections */}
        {accordionSections.map((section) => (
          <Accordion
            key={section.id}
            expanded={expanded.includes(section.id)}
            onChange={handleAccordionChange(section.id)}
            sx={accordionSx}
            disableGutters
            elevation={0}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={accordionSummarySx}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                width: '100%' 
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  backgroundColor: expanded.includes(section.id) 
                    ? 'rgba(245, 158, 11, 0.15)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: expanded.includes(section.id) ? '#F59E0B' : '#96989D',
                  transition: 'all 0.3s',
                  border: `1px solid ${expanded.includes(section.id) 
                    ? 'rgba(245, 158, 11, 0.3)' 
                    : 'rgba(255, 255, 255, 0.1)'}`
                }}>
                  {section.icon}
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ 
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: expanded.includes(section.id) ? '#DCDDDE' : '#B9BBBE',
                    transition: 'color 0.2s',
                    mb: 0.5
                  }}>
                    {section.title}
                  </Box>
                  {section.id === 'model-processing' && (
                    <Box sx={{ 
                      fontSize: '0.8rem',
                      color: '#96989D'
                    }}>
                      AI model selection and processing settings
                    </Box>
                  )}
                  {section.id === 'advanced-config' && (
                    <Box sx={{ 
                      fontSize: '0.8rem',
                      color: '#96989D'
                    }}>
                      Advanced configuration and file paths
                    </Box>
                  )}
                </Box>
                
                {section.badge && (
                  <Badge
                    badgeContent={section.badge}
                    color={section.badgeColor || 'primary'}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.7rem',
                        height: 20,
                        minWidth: 20,
                        right: 10,
                        backgroundColor: section.badgeColor === 'error' 
                          ? '#ED4245' 
                          : section.badgeColor === 'warning'
                          ? '#FF9800'
                          : '#F59E0B',
                        fontWeight: 600
                      }
                    }}
                  />
                )}
              </Box>
            </AccordionSummary>
            
            <AccordionDetails sx={accordionDetailsSx}>
              {section.component}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Fade>
  )
}