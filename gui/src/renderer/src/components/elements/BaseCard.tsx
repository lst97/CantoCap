import React from 'react'
import { Card, CardProps, SxProps, Theme } from '@mui/material'

interface BaseCardProps extends Omit<CardProps, 'sx'> {
  variant?: 'default' | 'important' | 'subtle' | 'highlighted'
  interactive?: boolean
  sx?: SxProps<Theme>
}

export const BaseCard: React.FC<BaseCardProps> = ({ 
  variant = 'default',
  interactive = false,
  children,
  sx,
  ...props 
}) => {
  const getVariantStyles = () => {
    const baseStyles = {
      borderRadius: 2,
      transition: 'all 0.3s ease',
      border: '1px solid',
    }

    const variants = {
      default: {
        ...baseStyles,
        background: 'rgba(255, 255, 255, 0.02)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      important: {
        ...baseStyles,
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
      },
      subtle: {
        ...baseStyles,
        background: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      highlighted: {
        ...baseStyles,
        background: 'linear-gradient(135deg, rgba(87, 242, 135, 0.08) 0%, rgba(87, 242, 135, 0.03) 100%)',
        borderColor: 'rgba(87, 242, 135, 0.2)',
      }
    }

    return variants[variant]
  }

  const getHoverStyles = () => {
    if (!interactive) return {}

    const hoverVariants = {
      default: {
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      important: {
        transform: 'translateY(-1px)',
        boxShadow: '0 8px 25px rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
      },
      subtle: {
        transform: 'translateY(-1px)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      highlighted: {
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(87, 242, 135, 0.15)',
        borderColor: 'rgba(87, 242, 135, 0.3)',
      }
    }

    return {
      '&:hover': hoverVariants[variant]
    }
  }

  return (
    <Card
      sx={{
        ...getVariantStyles(),
        ...getHoverStyles(),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Card>
  )
}