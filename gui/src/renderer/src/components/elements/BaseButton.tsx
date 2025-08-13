import React from 'react';
import { Button, ButtonProps, SxProps, Theme } from '@mui/material';

interface BaseButtonProps extends Omit<ButtonProps, 'sx' | 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  sx?: SxProps<Theme>;
}

export const BaseButton: React.FC<BaseButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  children,
  disabled,
  sx,
  ...props
}) => {
  const baseStyles: SxProps<Theme> = {
    borderRadius: 3,
    fontWeight: 600,
    textTransform: 'none' as const,
    transition: 'all 0.3s ease',
    letterSpacing: '0.025em',
  };

  const sizeStyles: Record<string, SxProps<Theme>> = {
    small: { py: 1, px: 2, fontSize: '0.8rem' },
    medium: { py: 1.5, px: 3, fontSize: '0.875rem' },
    large: { py: 2, px: 4, fontSize: '1rem' },
  };

  const variantStyles: Record<string, SxProps<Theme>> = {
    primary: {
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      color: '#000000',
      border: 'none',
      boxShadow: '0px 1px 3px rgba(245, 158, 11, 0.12), 0px 1px 2px rgba(245, 158, 11, 0.24)',
      '&:hover': {
        background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
        boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.15), 0px 2px 4px rgba(245, 158, 11, 0.3)',
        transform: 'translateY(-1px)',
      },
      '&:disabled': {
        background:
          'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.3) 100%)',
        color: 'rgba(255, 255, 255, 0.5)',
      },
    },
    secondary: {
      background: 'linear-gradient(135deg, #57F287 0%, #22C55E 100%)',
      color: '#000000',
      border: 'none',
      '&:hover': {
        background: 'linear-gradient(135deg, #7DD3FC 0%, #57F287 100%)',
        transform: 'translateY(-1px)',
      },
    },
    outline: {
      background: 'transparent',
      color: 'primary.main',
      border: '2px solid',
      borderColor: 'primary.main',
      '&:hover': {
        borderColor: 'primary.light',
        backgroundColor: 'rgba(245, 158, 11, 0.04)',
        transform: 'translateY(-1px)',
      },
    },
    ghost: {
      background: 'transparent',
      color: 'text.primary',
      border: 'none',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        transform: 'translateY(-1px)',
      },
    },
    danger: {
      background: 'linear-gradient(135deg, #ED4245 0%, #DC2626 100%)',
      color: '#FFFFFF',
      border: 'none',
      '&:hover': {
        background: 'linear-gradient(135deg, #F87171 0%, #ED4245 100%)',
        transform: 'translateY(-1px)',
      },
    },
  };

  const loadingStyles: SxProps<Theme> = loading
    ? {
        '&:disabled': {
          cursor: 'wait',
        },
      }
    : {};

  return (
    <Button
      disabled={disabled || loading}
      sx={[
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        loadingStyles,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </Button>
  );
};
