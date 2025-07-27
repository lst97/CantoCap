import React from 'react'
import { Slider, SliderProps, Box, Typography, SxProps, Theme } from '@mui/material'

interface BaseSliderProps extends Omit<SliderProps, 'sx'> {
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
  size?: 'small' | 'medium'
  variant?: 'primary' | 'secondary'
  sx?: SxProps<Theme>
}

export const BaseSlider: React.FC<BaseSliderProps> = ({
  label,
  showValue = false,
  formatValue = (value) => value.toString(),
  size = 'medium',
  variant = 'primary',
  value,
  sx,
  ...props
}) => {
  const getVariantStyles = () => {
    const baseStyles = {
      height: size === 'small' ? 6 : 8,
      borderRadius: 3,
    }

    const variants = {
      primary: {
        ...baseStyles,
        color: 'primary.main',
        '& .MuiSlider-track': {
          background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
          borderRadius: 3,
          border: 'none',
        },
        '& .MuiSlider-rail': {
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderRadius: 3,
        },
        '& .MuiSlider-thumb': {
          width: size === 'small' ? 16 : 20,
          height: size === 'small' ? 16 : 20,
          backgroundColor: '#F59E0B',
          border: '2px solid #FFFFFF',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
            transform: 'scale(1.1)',
          },
          '&:focus, &:hover, &.Mui-active': {
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
          },
        },
        '& .MuiSlider-valueLabel': {
          backgroundColor: '#2F3136',
          color: '#DCDDDE',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 2,
          fontSize: '0.75rem',
          fontWeight: 500,
        },
      },
      secondary: {
        ...baseStyles,
        color: 'secondary.main',
        '& .MuiSlider-track': {
          background: 'linear-gradient(90deg, #57F287 0%, #22C55E 100%)',
          borderRadius: 3,
          border: 'none',
        },
        '& .MuiSlider-rail': {
          backgroundColor: 'rgba(87, 242, 135, 0.1)',
          borderRadius: 3,
        },
        '& .MuiSlider-thumb': {
          width: size === 'small' ? 16 : 20,
          height: size === 'small' ? 16 : 20,
          backgroundColor: '#57F287',
          border: '2px solid #FFFFFF',
          boxShadow: '0 2px 8px rgba(87, 242, 135, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(87, 242, 135, 0.4)',
            transform: 'scale(1.1)',
          },
          '&:focus, &:hover, &.Mui-active': {
            boxShadow: '0 4px 12px rgba(87, 242, 135, 0.4)',
          },
        },
      },
    }

    return variants[variant]
  }

  return (
    <Box>
      {label && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          {showValue && (
            <Typography variant="body2" color="primary.main" sx={{ 
              fontWeight: 600,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}>
              {formatValue(typeof value === 'number' ? value : (Array.isArray(value) ? value[0] : 0))}
            </Typography>
          )}
        </Box>
      )}
      <Slider
        value={value}
        sx={{
          ...getVariantStyles(),
          ...sx,
        }}
        {...props}
      />
    </Box>
  )
}