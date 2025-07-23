import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#F59E0B', // Amber 500
      light: '#FCD34D', // Amber 300
      dark: '#D97706', // Amber 600
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#EF4444', // Red 500 - Complementary accent
      light: '#F87171', // Red 400
      dark: '#DC2626', // Red 600
      contrastText: '#ffffff',
    },
    success: {
      main: '#10B981', // Emerald 500
      light: '#34D399', // Emerald 400
      dark: '#059669', // Emerald 600
    },
    warning: {
      main: '#F59E0B', // Amber 500 (matching primary)
      light: '#FCD34D', // Amber 300
      dark: '#D97706', // Amber 600
    },
    error: {
      main: '#EF4444', // Red 500
      light: '#F87171', // Red 400
      dark: '#DC2626', // Red 600
    },
    background: {
      default: '#FFFBEB', // Amber 50
      paper: '#FFFFFF',
    },
    grey: {
      50: '#FFFBEB', // Warm amber-tinted whites
      100: '#FEF3C7', // Amber 100
      200: '#FDE68A', // Amber 200
      300: '#FCD34D', // Amber 300
      400: '#F59E0B', // Amber 500
      500: '#D97706', // Amber 600
      600: '#B45309', // Amber 700
      700: '#92400E', // Amber 800
      800: '#78350F', // Amber 900
      900: '#451A03', // Amber 950
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '2.125rem',
      lineHeight: 1.235,
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.5rem',
      lineHeight: 1.334,
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
      lineHeight: 1.6,
    },
    subtitle1: {
      fontSize: '1rem',
      lineHeight: 1.75,
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: '0.875rem',
      lineHeight: 1.57,
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
          fontSize: '0.875rem',
          fontWeight: 600,
          textTransform: 'none',
          letterSpacing: '0.025em',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: '0px 1px 3px rgba(245, 158, 11, 0.12), 0px 1px 2px rgba(245, 158, 11, 0.24)',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.15), 0px 2px 4px rgba(245, 158, 11, 0.3)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            backgroundColor: 'rgba(245, 158, 11, 0.04)',
          },
        },
        large: {
          padding: '14px 32px',
          fontSize: '1rem',
          borderRadius: 16,
        },
        small: {
          padding: '6px 16px',
          fontSize: '0.75rem',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 1px 2px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.08)',
          backgroundColor: '#FFFFFF',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08), 0px 2px 4px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-2px)',
            borderColor: 'rgba(245, 158, 11, 0.12)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(245, 158, 11, 0.02)',
            },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.1)',
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: '2px',
            borderColor: 'rgba(245, 158, 11, 0.2)',
          },
          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(245, 158, 11, 0.4)',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(245, 158, 11, 0.02)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          fontWeight: 500,
          fontSize: '0.75rem',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          color: '#D97706',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          '&:hover': {
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 1px 3px rgba(245, 158, 11, 0.08), 0px 1px 2px rgba(245, 158, 11, 0.16)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.08)',
          color: '#92400E',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 8,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
        },
        bar: {
          borderRadius: 6,
          background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 52,
          height: 32,
          padding: 0,
        },
        switchBase: {
          padding: 2,
          '&.Mui-checked': {
            transform: 'translateX(20px)',
            '& + .MuiSwitch-track': {
              backgroundColor: '#F59E0B',
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 28,
          height: 28,
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
        },
        track: {
          borderRadius: 16,
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          opacity: 1,
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: 'rgba(245, 158, 11, 0.5)',
          '&.Mui-checked': {
            color: '#F59E0B',
          },
        },
      },
    },
  },
})

export default theme