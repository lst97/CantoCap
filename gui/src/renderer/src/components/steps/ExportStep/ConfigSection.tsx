import React from 'react'
import { Typography, Box } from '@mui/material'
import { BaseCard } from '../../elements'

interface ConfigSectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  important?: boolean
  action?: React.ReactNode
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ 
  title, 
  icon, 
  children, 
  important = false,
  action
}) => {
  return (
    <BaseCard 
      variant={important ? 'important' : 'default'} 
      interactive
      sx={{ p: 3 }}
    >
      <Typography variant="h6" sx={{ 
        mb: 3, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: 1.5,
        fontWeight: 600,
        color: important ? 'primary.main' : 'text.primary'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {icon}
          {title}
        </Box>
        {action}
      </Typography>
      {children}
    </BaseCard>
  )
}