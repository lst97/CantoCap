import React from 'react'
import { TextField, TextFieldProps, SxProps, Theme } from '@mui/material'

interface BaseSelectorProps extends Omit<TextFieldProps, 'sx'> {
  variant?: 'outlined' | 'filled' | 'standard'
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

export const BaseSelector: React.FC<BaseSelectorProps> = ({
  variant = 'outlined',
  size = 'small',
  sx,
  ...props
}) => {
  const getBaseStyles = (): SxProps<Theme> => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#2F3136',
      borderRadius: 2,
      transition: 'all 0.2s ease',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
      },
      '&:hover fieldset': {
        borderColor: 'rgba(245, 158, 11, 0.4)',
      },
      '&:hover': {
        backgroundColor: '#36393F',
        '& .MuiInputBase-input': {
          color: '#DCDDDE',
        },
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main',
        borderWidth: 1,
      },
      '&.Mui-focused': {
        backgroundColor: '#36393F',
        '& .MuiInputBase-input': {
          color: '#DCDDDE',
        },
      },
      '&.Mui-error fieldset': {
        borderColor: 'error.main',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'text.secondary',
      fontSize: size === 'small' ? '0.8rem' : '0.875rem',
      '&.Mui-focused': {
        color: 'primary.main',
      },
      '&.Mui-error': {
        color: 'error.main',
      },
    },
    '& .MuiInputBase-input': {
      color: '#DCDDDE',
      fontSize: size === 'small' ? '0.8rem' : '0.875rem',
      padding: size === 'small' ? '12px 14px' : '14px 16px',
      '&::placeholder': {
        color: 'text.secondary',
        opacity: 0.7,
      },
    },
    '& .MuiFormHelperText-root': {
      fontSize: '0.7rem',
      marginLeft: 0,
      marginTop: '4px',
      '&.Mui-error': {
        color: 'error.main',
      },
    },
  })

  return (
    <TextField
      variant={variant}
      size={size}
      sx={{
        ...getBaseStyles(),
        ...sx,
      }}
      {...props}
    />
  )
}