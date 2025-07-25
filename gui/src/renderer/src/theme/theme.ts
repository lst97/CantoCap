import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F59E0B', // Amber 500
      light: '#FCD34D', // Amber 300
      dark: '#D97706', // Amber 600
      contrastText: '#000000',
    },
    secondary: {
      main: '#57F287', // Discord Green
      light: '#7DD3FC', // Light Blue
      dark: '#22C55E', // Green 600
      contrastText: '#000000',
    },
    success: {
      main: '#57F287', // Discord Green
      light: '#7DD3FC', // Light Success
      dark: '#22C55E', // Dark Success
    },
    warning: {
      main: '#FEE75C', // Discord Yellow
      light: '#FEF3C7', // Light Warning
      dark: '#EAB308', // Dark Warning
    },
    error: {
      main: '#ED4245', // Discord Red
      light: '#F87171', // Light Error
      dark: '#DC2626', // Dark Error
    },
    background: {
      default: '#36393F', // Discord Dark Gray
      paper: '#2F3136', // Discord Darker Gray
    },
    text: {
      primary: '#DCDDDE', // Discord Light Text
      secondary: '#96989D', // Discord Medium Text
    },
    divider: '#40444B', // Discord Border Color
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
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
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
          border: '1px solid rgba(64, 68, 75, 0.3)',
          backgroundColor: '#2F3136',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15), 0px 2px 4px rgba(0, 0, 0, 0.3)',
            transform: 'translateY(-2px)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#40444B',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
            },
            '&.Mui-focused': {
              backgroundColor: '#40444B',
              boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.1)',
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: '1px',
            borderColor: 'rgba(64, 68, 75, 0.5)',
          },
          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(245, 158, 11, 0.5)',
          },
          '& .MuiInputLabel-root': {
            color: '#96989D',
          },
          '& .MuiOutlinedInput-input': {
            color: '#DCDDDE',
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
          backgroundColor: '#2F3136',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
          borderBottom: '1px solid #40444B',
          color: '#DCDDDE',
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
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2F3136',
          backgroundImage: 'none',
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
            },
          },
        },
      },
    },
  },
})

export default theme