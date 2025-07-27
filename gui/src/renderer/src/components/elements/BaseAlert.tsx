import React from 'react'
import { Alert, AlertProps, SxProps, Theme } from '@mui/material'

interface BaseAlertProps extends Omit<AlertProps, 'sx'> {
  variant?: 'filled' | 'outlined' | 'standard'
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

export const BaseAlert: React.FC<BaseAlertProps> = ({
  severity = 'info',
  variant = 'standard',
  size = 'medium',
  sx,
  children,
  ...props
}) => {
  const getVariantStyles = () => {
    const baseStyles = {
      borderRadius: size === 'small' ? 2 : 3,
      fontSize: size === 'small' ? '0.8rem' : '0.875rem',
      py: size === 'small' ? 1 : 1.5,
    }

    const severityColors = {
      error: {
        backgroundColor: 'rgba(237, 66, 69, 0.1)',
        border: '1px solid rgba(237, 66, 69, 0.3)',
        '& .MuiAlert-icon': {
          color: '#ED4245',
        },
      },
      warning: {
        backgroundColor: 'rgba(254, 231, 92, 0.1)',
        border: '1px solid rgba(254, 231, 92, 0.3)',
        '& .MuiAlert-icon': {
          color: '#FEE75C',
        },
      },
      info: {
        backgroundColor: 'rgba(125, 211, 252, 0.08)',
        border: '1px solid rgba(125, 211, 252, 0.2)',
        '& .MuiAlert-icon': {
          color: '#7DD3FC',
        },
      },
      success: {
        backgroundColor: 'rgba(87, 242, 135, 0.1)',
        border: '1px solid rgba(87, 242, 135, 0.3)',
        '& .MuiAlert-icon': {
          color: '#57F287',
        },
      },
    }

    return {
      ...baseStyles,
      ...severityColors[severity],
    }
  }

  return (
    <Alert
      severity={severity}
      variant={variant}
      sx={{
        ...getVariantStyles(),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Alert>
  )
}