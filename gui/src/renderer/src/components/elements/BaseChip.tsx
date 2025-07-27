import React from 'react'
import { Chip, ChipProps, SxProps, Theme } from '@mui/material'

interface BaseChipProps extends Omit<ChipProps, 'sx'> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

export const BaseChip: React.FC<BaseChipProps> = ({
  variant = 'neutral',
  size = 'medium',
  sx,
  ...props
}) => {
  const getVariantStyles = () => {
    const baseStyles = {
      borderRadius: size === 'small' ? 20 : 24,
      fontSize: size === 'small' ? '0.7rem' : '0.75rem',
      height: size === 'small' ? 20 : 24,
      fontWeight: 500,
      transition: 'all 0.2s ease',
    }

    const variants = {
      primary: {
        ...baseStyles,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        '&:hover': {
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
        },
      },
      secondary: {
        ...baseStyles,
        backgroundColor: 'rgba(87, 242, 135, 0.15)',
        color: '#57F287',
        border: '1px solid rgba(87, 242, 135, 0.3)',
        '&:hover': {
          backgroundColor: 'rgba(87, 242, 135, 0.2)',
        },
      },
      success: {
        ...baseStyles,
        backgroundColor: 'rgba(87, 242, 135, 0.15)',
        color: 'success.main',
        border: '1px solid rgba(87, 242, 135, 0.3)',
        '&:hover': {
          backgroundColor: 'rgba(87, 242, 135, 0.2)',
        },
      },
      warning: {
        ...baseStyles,
        backgroundColor: 'rgba(254, 231, 92, 0.15)',
        color: '#FEE75C',
        border: '1px solid rgba(254, 231, 92, 0.3)',
        '&:hover': {
          backgroundColor: 'rgba(254, 231, 92, 0.2)',
        },
      },
      error: {
        ...baseStyles,
        backgroundColor: 'rgba(237, 66, 69, 0.15)',
        color: '#ED4245',
        border: '1px solid rgba(237, 66, 69, 0.3)',
        '&:hover': {
          backgroundColor: 'rgba(237, 66, 69, 0.2)',
        },
      },
      neutral: {
        ...baseStyles,
        backgroundColor: 'rgba(150, 152, 157, 0.15)',
        color: 'text.secondary',
        border: '1px solid rgba(150, 152, 157, 0.2)',
        '&:hover': {
          backgroundColor: 'rgba(150, 152, 157, 0.2)',
        },
      },
    }

    return variants[variant]
  }

  return (
    <Chip
      sx={{
        ...getVariantStyles(),
        ...sx,
      }}
      {...props}
    />
  )
}