import React, { useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Breadcrumbs,
  Link,
  useTheme,
  alpha
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Computer as SystemIcon,
  Palette as UIIcon,
  Security as SecurityIcon,
  Storage as DataIcon
} from '@mui/icons-material'
import { useUIStore, selectSettingsUI, selectDynamicTitle } from '../../stores/ui-store'
import { SystemStatus } from '../feedback/SystemStatus'

// Settings Tab Component Interface
interface SettingsTabProps {
  title: string
  description: string
  children?: React.ReactNode
}

const SettingsTabContainer: React.FC<SettingsTabProps> = ({ title, description, children }) => {
  const theme = useTheme()
  
  return (
    <Box sx={{ 
      p: 3,
      maxWidth: 800,
      mx: 'auto'
    }}>
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            color: 'text.primary',
            mb: 1
          }}
        >
          {title}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary',
            lineHeight: 1.6
          }}
        >
          {description}
        </Typography>
      </Box>
      
      {children && (
        <Box sx={{
          mt: 3,
          p: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          borderRadius: 1,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`
        }}>
          {children}
        </Box>
      )}
    </Box>
  )
}

// Settings Tab Components
const SystemSettingsTab: React.FC = () => (
  <SettingsTabContainer 
    title="System & Dependencies"
    description="Configure system dependencies, paths, and hardware settings for optimal performance."
  >
    <SystemStatus />
  </SettingsTabContainer>
)

const UISettingsTab: React.FC = () => (
  <SettingsTabContainer 
    title="User Interface"
    description="Customize the application appearance, themes, and user interface behavior."
  >
    <Typography variant="body2" color="text.secondary">
      UI customization options will be implemented here.
    </Typography>
  </SettingsTabContainer>
)

const SecuritySettingsTab: React.FC = () => (
  <SettingsTabContainer 
    title="Security & Privacy"
    description="Manage API keys, privacy settings, and security configurations for secure operation."
  >
    <Typography variant="body2" color="text.secondary">
      Security configuration options will be implemented here.
    </Typography>
  </SettingsTabContainer>
)

const DataSettingsTab: React.FC = () => (
  <SettingsTabContainer 
    title="Data & Storage"
    description="Configure data storage locations, backup settings, and workspace management options."
  >
    <Typography variant="body2" color="text.secondary">
      Data management options will be implemented here.
    </Typography>
  </SettingsTabContainer>
)

// Tab configuration with enhanced type safety
interface SettingsTab {
  readonly id: string
  readonly label: string
  readonly icon: React.ReactElement
  readonly component: React.ComponentType
  readonly description?: string
  readonly isExperimental?: boolean
}

const settingsTabs: readonly SettingsTab[] = [
  {
    id: 'system',
    label: 'System & Dependencies',
    icon: <SystemIcon />,
    component: SystemSettingsTab,
    description: 'System configuration and dependencies'
  },
  {
    id: 'ui',
    label: 'User Interface',
    icon: <UIIcon />,
    component: UISettingsTab,
    description: 'UI themes and preferences'
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: <SecurityIcon />,
    component: SecuritySettingsTab,
    description: 'Security and privacy settings'
  },
  {
    id: 'data',
    label: 'Data & Storage',
    icon: <DataIcon />,
    component: DataSettingsTab,
    description: 'Data management and storage'
  }
] as const

// Tab ID type for better type safety
export type SettingsTabId = typeof settingsTabs[number]['id']

// Create a map for O(1) tab lookups
const tabsMap = new Map(settingsTabs.map(tab => [tab.id, tab]))

// Error Boundary for tab content
class SettingsErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Settings content error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || SettingsErrorFallback
      return <FallbackComponent error={this.state.error!} />
    }

    return this.props.children
  }
}

// Default error fallback component
const SettingsErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box sx={{ 
    p: 3, 
    textAlign: 'center',
    maxWidth: 600,
    mx: 'auto'
  }}>
    <Typography variant="h6" color="error" gutterBottom>
      Settings Error
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      An error occurred while loading this settings page.
    </Typography>
    <Typography variant="caption" sx={{ 
      fontFamily: 'monospace', 
      backgroundColor: 'grey.100',
      p: 1,
      borderRadius: 1,
      display: 'block'
    }}>
      {error.message}
    </Typography>
  </Box>
)

export interface SettingsContentAreaProps {
  /** Callback function called when the back button is pressed */
  onBack?: () => void
  /** Optional className for styling */
  className?: string
  /** Optional aria-label for accessibility */
  'aria-label'?: string
}

/**
 * SettingsContentArea - Replaces main content when in settings mode
 * 
 * Features:
 * - Tabbed interface for different settings categories
 * - Breadcrumb navigation with accessibility support
 * - Settings history navigation with back button
 * - Integration with UI store for state management
 * - Responsive design with proper spacing
 * - Enhanced error boundaries and loading states
 */
export const SettingsContentArea: React.FC<SettingsContentAreaProps> = ({ 
  onBack, 
  className,
  'aria-label': ariaLabel = 'Settings content area'
}) => {
  const theme = useTheme()
  const settingsUI = useUIStore(selectSettingsUI)
  const dynamicTitle = useUIStore(selectDynamicTitle)
  const { setActiveSettingsTab, goBackInSettings, exitSettingsMode } = useUIStore()
  
  // Optimized current tab lookup using Map for O(1) performance
  const currentTab = useMemo(() => 
    tabsMap.get(settingsUI.activeSettingsTab) ?? settingsTabs[0],
    [settingsUI.activeSettingsTab]
  )
  
  const CurrentTabComponent = currentTab.component
  
  // Memoized handlers to prevent unnecessary re-renders
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
    // Use Map for O(1) validation
    if (tabsMap.has(newValue)) {
      setActiveSettingsTab(newValue)
    } else {
      console.warn(`Invalid settings tab: ${newValue}`)
    }
  }, [setActiveSettingsTab])
  
  const handleBack = useCallback(() => {
    try {
      if (settingsUI.settingsHistory.length > 1) {
        goBackInSettings()
      } else {
        onBack?.() ?? exitSettingsMode()
      }
    } catch (error) {
      console.error('Error navigating back from settings:', error)
      exitSettingsMode() // Fallback to exit settings
    }
  }, [settingsUI.settingsHistory.length, goBackInSettings, onBack, exitSettingsMode])
  
  return (
    <Box 
      className={className}
      aria-label={ariaLabel}
      sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        backgroundColor: 'background.default',
        minHeight: 0 // Ensures proper flex behavior
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          height: 64,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          boxShadow: theme.shadows[1]
        }}
      >
        <IconButton 
          onClick={handleBack} 
          size="small"
          aria-label="Go back"
          sx={{
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.08)
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        
        <SettingsIcon sx={{ color: 'text.secondary' }} />
        
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Setting
          </Typography>
          
          {/* Enhanced Breadcrumbs */}
          <Breadcrumbs
            aria-label="Settings navigation breadcrumbs"
            sx={{ 
              '& .MuiBreadcrumbs-separator': { 
                mx: 0.5 
              },
              '& .MuiBreadcrumbs-ol': {
                flexWrap: 'nowrap'
              }
            }}
          >
            <Link
              component="button"
              variant="body2"
              onClick={() => setActiveSettingsTab('system')}
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                fontSize: '0.875rem',
                '&:hover': {
                  textDecoration: 'underline',
                  color: 'primary.main'
                },
                '&:focus': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                  borderRadius: 1
                }
              }}
            >
              Setting
            </Link>
            <Typography 
              variant="body2" 
              color="text.primary"
              sx={{ fontSize: '0.875rem', fontWeight: 500 }}
            >
              {currentTab.label}
            </Typography>
          </Breadcrumbs>
        </Box>
      </Box>
      
      {/* Tab Navigation */}
      <Box
        component="nav"
        aria-label="Settings categories"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}
      >
        <Tabs
          value={settingsUI.activeSettingsTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Settings category tabs"
          sx={{
            '& .MuiTab-root': {
              minWidth: 120,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              py: 2,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04)
              },
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          {settingsTabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              aria-label={`${tab.label} settings`}
              title={tab.description}
              sx={{
                '& .MuiTab-iconWrapper': {
                  marginRight: 1,
                  marginBottom: 0,
                  '& svg': {
                    fontSize: '1.125rem'
                  }
                }
              }}
            />
          ))}
        </Tabs>
      </Box>
      
      {/* Tab Content */}
      <Box 
        component="main"
        role="tabpanel"
        aria-labelledby={`tab-${currentTab.id}`}
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          backgroundColor: 'background.default',
          scrollBehavior: 'smooth'
        }}
      >
        <SettingsErrorBoundary>
          <React.Suspense fallback={
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: 200,
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography color="text.secondary">Loading settings...</Typography>
              <Box sx={{ 
                width: 100, 
                height: 2, 
                backgroundColor: 'grey.200',
                borderRadius: 1,
                overflow: 'hidden'
              }}>
                <Box sx={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'primary.main',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              </Box>
            </Box>
          }>
            <CurrentTabComponent />
          </React.Suspense>
        </SettingsErrorBoundary>
      </Box>
    </Box>
  )
}

/**
 * Hook for settings content area integration with enhanced functionality
 * Provides a clean API for interacting with the settings system
 */
export const useSettingsContentArea = () => {
  const settingsUI = useUIStore(selectSettingsUI)
  const { 
    enterSettingsMode, 
    exitSettingsMode, 
    setActiveSettingsTab, 
    navigateSettings,
    goBackInSettings 
  } = useUIStore()
  
  // Memoized available tabs for performance
  const availableTabs = useMemo(() => 
    settingsTabs.map(tab => ({
      id: tab.id,
      label: tab.label,
      description: tab.description,
      isExperimental: tab.isExperimental
    })),
    []
  )
  
  // Enhanced tab navigation with O(1) validation
  const navigateToTab = useCallback((tabId: string, addToHistory = true) => {
    if (tabsMap.has(tabId)) {
      navigateSettings(tabId, addToHistory)
    } else {
      console.warn(`Settings tab '${tabId}' does not exist`)
    }
  }, [navigateSettings])
  
  return {
    // State
    isSettingsMode: settingsUI.isSettingsMode,
    activeTab: settingsUI.activeSettingsTab,
    settingsHistory: settingsUI.settingsHistory,
    canGoBack: settingsUI.settingsHistory.length > 1,
    
    // Enhanced Actions with O(1) validation
    enterSettings: useCallback((initialTab?: string) => {
      const validTab = initialTab && tabsMap.has(initialTab) 
        ? initialTab 
        : 'system'
      enterSettingsMode(validTab)
    }, [enterSettingsMode]),
    
    exitSettings: exitSettingsMode,
    setTab: setActiveSettingsTab,
    navigate: navigateToTab,
    goBack: goBackInSettings,
    
    // Utility functions with O(1) performance
    isValidTab: useCallback((tabId: string) => 
      tabsMap.has(tabId),
      []
    ),
    
    getCurrentTabInfo: useCallback(() => {
      const currentTab = tabsMap.get(settingsUI.activeSettingsTab)
      return currentTab ? {
        id: currentTab.id,
        label: currentTab.label,
        description: currentTab.description,
        isExperimental: currentTab.isExperimental
      } : null
    }, [settingsUI.activeSettingsTab]),
    
    // Available tabs
    availableTabs
  }
}