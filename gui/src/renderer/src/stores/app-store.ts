import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { navigateToProcessing, navigateToConfig } from '../utils/workflow-navigation'
import { generateDebugId } from '../utils/id-generator'
import { 
  handleVideoRemovalWithCleanup, 
  performEnhancedSessionReset,
  handleWorkspaceChangeWithSessionCoordination 
} from '../utils/session-workflow-integration'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useSubtitleEditStore } from '../stores/subtitle-edit-store'
import { workflowStateManager } from '../services/workflow-state-manager'
import { StepState } from '../types/workflow-state'
import type { 
  AppState, 
  AppConfig, 
  DependencyStatus, 
  ProcessingState, 
  HardwareInfo,
  ProcessingHistoryEntry,
  Notification
} from '../../../types'

interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>
  loadConfigFromStorage: () => void
  initializeWorkspaces: () => Promise<void>

  // Dependencies
  checkDependencies: () => Promise<void>
  updateDependency: (name: string, status: Partial<DependencyStatus>) => void

  // Processing
  updateProcessing: (update: Partial<ProcessingState>) => void
  resetProcessing: () => void
  startTranscription: () => Promise<void>
  cancelTranscription: () => Promise<void>
  addDebugMessage: (stage: string, message: string, level?: 'debug' | 'info' | 'warning' | 'error', source?: string) => void

  // Hardware
  checkHardware: () => Promise<HardwareInfo>

  // Configuration
  updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void
  saveStateToStorage: () => void
  restoreUIState: () => void

  // UI Actions
  setActiveModal: (modal: string | null) => void
  closeModal: () => void
  toggleAdvanced: () => void
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void
  removeNotification: (id: number) => void
  addToHistory: (inputFile: string, status: string, outputFile?: string | null) => void

  // Utility Functions
  canStartTranscription: () => boolean
  getConfigAsCliArgs: () => string[]
  
  // Testing and workspace integration methods
  loadFromWorkspace: (workspace: any) => Promise<void>
  getConfig: () => AppConfig
  reset: () => void
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    // Application State
    isInitialized: false,
    appVersion: null,
    
    // Dependency Status
    dependencies: {
      python: { 
        name: 'Python 3.12',
        status: 'checking', 
        version: null, 
        path: null, 
        available: false,
        downloadUrl: 'https://www.python.org/downloads/release/python-3120/',
        error: null
      },
      ffmpeg: { 
        name: 'FFmpeg',
        status: 'checking', 
        version: null, 
        path: null, 
        available: false,
        downloadUrl: 'https://ffmpeg.org/download.html',
        autoInstallUrls: {
          win32: 'https://www.gyan.dev/ffmpeg/builds/',
          darwin: 'https://formulae.brew.sh/formula/ffmpeg',
          linux: 'https://ffmpeg.org/download.html#build-linux'
        },
        error: null
      }
    },
    
    // Processing State
    processing: {
      isActive: false,
      stage: 'idle',
      progress: 0,
      message: 'Ready to process',
      timeElapsed: 0,
      timeRemaining: 0,
      currentStep: null,
      totalSteps: null,
      hardwareInfo: null,
      error: null,
      startTime: null,
      debugMessages: [],
      substage: undefined,
      engineStage: undefined,
      statistics: undefined
    },
    
    // Configuration State
    config: {
      inputFile: null,
      outputFile: null,
      language: 'zh',
      model: null,
      priority: 'balanced',
      speakers: false,
      written: true,
      music: false,
      charset: 'traditional',
      geminiKey: '',
      hfToken: '',
      noGeminiRefinement: false,
      maxChunkDuration: 15,
      videoQuality: '360p',
      terminologyConfig: null,
      ffmpegPath: null,
      subtitle: null,
      duration: 10.0,
      verbose: false,
      startTime: null,
      endTime: null,
      importedJsonFile: null,
      autoSaveApiKeys: true,
      isImportedFromJson: false
    },
    
    // UI State
    ui: {
      activeModal: null,
      showAdvanced: true,
      notifications: [],
      theme: 'system',
      sidebarExpanded: true,
      processingHistory: []
    },

    // Hardware Information
    hardware: {
      info: null,
      lastChecked: null,
      checking: false,
      error: null
    },

    // Performance optimization state
    lastConfigLogTime: {} as Record<string, number>,

    // Actions
    initializeApp: async () => {
      console.log('🔄 App store initialization starting...')
      try {
        console.log('🔄 Getting app version...')
        const version = await window.cantocapAPI.getAppVersion()
        console.log('✅ App version:', version)
        
        set({ appVersion: version, isInitialized: true })
        console.log('✅ App store state updated with version')
        
        // Try workspace initialization with fallback
        console.log('🔄 Starting workspace initialization...')
        try {
          await get().initializeWorkspaces()
          console.log('✅ Workspace initialization completed')
        } catch (workspaceError) {
          console.warn('⚠️ Workspace initialization failed, using fallback:', workspaceError)
          // Fallback to localStorage only
          get().loadConfigFromStorage()
          console.log('✅ Fallback to localStorage completed')
        }
        
        console.log('🔄 Starting dependency check...')
        get().checkDependencies()
        console.log('✅ Dependency check initiated')
        
        console.log('✅ App store initialization completed successfully')
      } catch (error) {
        console.error('❌ Failed to initialize app store:', error)
        // Don't throw - let the app continue with basic functionality
        set({ isInitialized: true }) // Mark as initialized even if some features fail
      }
    },

    initializeWorkspaces: async () => {
      console.log('🔄 App store workspace initialization starting...')
      try {
        console.log('🔄 Getting workspace store state...')
        const workspaceStore = useWorkspaceStore.getState()
        console.log('✅ Workspace store state obtained')
        
        console.log('🔄 Calling workspace store initializeWorkspaces...')
        await workspaceStore.initializeWorkspaces()
        console.log('✅ Workspace store initialization completed')
        
        // Load config from current workspace if available
        console.log('🔄 Checking current workspace...')
        if (workspaceStore.currentWorkspace) {
          console.log('✅ Current workspace found, merging config')
          const workspaceConfig = workspaceStore.currentWorkspace.config
          
          // Debug workspace config to see if importedJsonFile is stored
          console.log('🔍 Workspace config details:', {
            workspaceName: workspaceStore.currentWorkspace.name,
            workspaceId: workspaceStore.currentWorkspace.id,
            hasConfig: !!workspaceConfig,
            configKeys: workspaceConfig ? Object.keys(workspaceConfig) : [],
            importedJsonFile: workspaceConfig?.importedJsonFile,
            inputFile: workspaceConfig?.inputFile,
            outputFile: workspaceConfig?.outputFile
          })
          
          set((state: AppState) => ({
            config: {
              ...state.config,
              ...workspaceConfig
            }
          }))
          console.log('✅ Workspace config merged', {
            finalImportedJsonFile: get().config.importedJsonFile
          })
        } else {
          console.log('ℹ️ No current workspace, falling back to localStorage')
          get().loadConfigFromStorage()
        }
        
        // Restore subtitle session data from IndexedDB if workspace exists
        if (workspaceStore.currentWorkspace) {
          try {
            console.log('🔄 Checking for existing subtitle session data...')
            const { useSubtitleEditStore } = await import('./subtitle-edit-store')
            const subtitleStore = useSubtitleEditStore.getState()
            
            const restoredSessionId = await subtitleStore.checkAndRestoreWorkspaceSession(workspaceStore.currentWorkspace.id)
            
            if (restoredSessionId) {
              console.log('✅ Subtitle session restored from IndexedDB:', restoredSessionId)
            } else {
              console.log('ℹ️ No existing subtitle session found for workspace:', workspaceStore.currentWorkspace.id)
            }
          } catch (error) {
            console.warn('⚠️ Failed to restore subtitle session from IndexedDB:', error)
            // Continue with normal initialization even if session restoration fails
          }
        }
        
        console.log('✅ App store workspace initialization completed')
      } catch (error) {
        console.error('❌ Failed to initialize workspaces:', error)
        console.log('🔄 Falling back to localStorage loading...')
        // Fallback to localStorage loading if workspace initialization fails
        get().loadConfigFromStorage()
        throw error // Re-throw to be caught by parent initializeApp
      }
    },

    checkDependencies: async () => {
      try {
        const results = await window.cantocapAPI.checkDependencies()
        set((state: AppStore) => {
          const newState = {
            dependencies: {
              ...state.dependencies,
              ...results
            }
          }
          
          // Auto-set ffmpegPath when FFmpeg is detected with resolved path
          if (results.ffmpeg?.available && results.ffmpeg?.path) {
            // Always update if we have a resolved path that's different from current config
            if (state.config.ffmpegPath !== results.ffmpeg.path) {
              get().updateConfig('ffmpegPath', results.ffmpeg.path)
            }
          }
          
          return newState
        })
      } catch (error) {
        console.error('Failed to check dependencies:', error)
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        set((state: AppStore) => ({
          dependencies: {
            python: { ...state.dependencies.python, status: 'error', error: errorMsg },
            ffmpeg: { ...state.dependencies.ffmpeg, status: 'error', error: errorMsg }
          }
        }))
      }
    },

    updateDependency: (name: string, status: Partial<DependencyStatus>) => 
      set((state: AppStore) => ({
        dependencies: {
          ...state.dependencies,
          [name]: { ...state.dependencies[name as keyof typeof state.dependencies], ...status }
        }
      })),
    
    updateProcessing: (update: Partial<ProcessingState>) => {
      const currentTime = Date.now()
      set((state: AppStore) => {
        const newProcessing = { ...state.processing, ...update }
        
        // Calculate time elapsed if process is active
        if (newProcessing.isActive && !state.processing.startTime) {
          newProcessing.startTime = currentTime
        }
        
        if (newProcessing.isActive && state.processing.startTime) {
          newProcessing.timeElapsed = Math.floor((currentTime - state.processing.startTime) / 1000)
        }
        
        return { processing: newProcessing }
      })
    },

    addDebugMessage: (stage: string, message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info', source?: string) => {
      set((state: AppStore) => {
        const debugMessage = {
          id: generateDebugId(),
          timestamp: Date.now(),
          stage,
          message,
          level,
          source
        }
        
        const newDebugMessages = [...state.processing.debugMessages, debugMessage]
        
        // Keep only last 100 messages per stage to prevent memory issues
        const messagesPerStage = newDebugMessages.reduce((acc, msg) => {
          acc[msg.stage] = (acc[msg.stage] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        let filteredMessages = newDebugMessages
        if (Object.values(messagesPerStage).some(count => count > 100)) {
          // Keep only last 50 messages per stage
          const stageMessages = newDebugMessages.reduce((acc, msg) => {
            if (!acc[msg.stage]) acc[msg.stage] = []
            acc[msg.stage].push(msg)
            return acc
          }, {} as Record<string, typeof debugMessage[]>)
          
          filteredMessages = Object.values(stageMessages)
            .flatMap(messages => messages.slice(-50))
            .sort((a, b) => a.timestamp - b.timestamp)
        }
        
        return {
          processing: {
            ...state.processing,
            debugMessages: filteredMessages
          }
        }
      })
    },
    
    updateConfig: async <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
      const previousConfig = get().config
      
      // Skip update if value hasn't changed
      if (previousConfig[key] === value) {
        return
      }
      
      // Throttled logging to prevent spam
      const now = Date.now()
      const state = get()
      if (!state.lastConfigLogTime) {
        state.lastConfigLogTime = {}
      }
      
      const shouldLog = process.env.NODE_ENV === 'development' && 
        (!state.lastConfigLogTime[key] || now - state.lastConfigLogTime[key] > 1000)
      
      if (shouldLog) {
        if (key === 'inputFile') {
          console.log('🔧 [VIDEO DEBUG] App Store: inputFile update:', {
            key,
            previousValue: previousConfig[key],
            newValue: value,
            timestamp: new Date().toISOString()
          })
        } else {
          console.log('🔧 Config Update:', {
            key,
            previousValue: previousConfig[key],
            newValue: value,
            timestamp: new Date().toISOString()
          })
        }
        state.lastConfigLogTime[key] = now
      }
      
      // Update app store state immediately for UI responsiveness
      set((state: AppStore) => ({
        config: { ...state.config, [key]: value }
      }))
      
      // Verify the state update took effect (especially important for inputFile)
      const immediateConfig = get().config
      if (key === 'inputFile') {
        console.log('🔧 [VIDEO DEBUG] App Store: State update verification:', {
          timestamp: new Date().toISOString(),
          requestedValue: value,
          actualStateValue: immediateConfig[key],
          updateSuccessful: immediateConfig[key] === value,
          stateKeys: Object.keys(immediateConfig)
        });
      }
      
      // Get updated config for persistence
      const currentConfig = get().config
      const updatedConfig = { ...currentConfig, [key]: value }
      
      // Handle explicit session resets for critical file changes ONLY if they're actually different
      try {
        const subtitleStore = useSubtitleEditStore.getState()
        const workspaceStore = useWorkspaceStore.getState()
        
        // Video file change (upload/remove) - Enhanced with workspace rebinding
        if (key === 'inputFile' && previousConfig.inputFile !== value) {
          console.log('🎬 Config: Video file changed via updateConfig, triggering enhanced session reset')
          
          // PERFORMANCE FIX: Check if session is already in correct state
          const currentSession = subtitleStore.session
          const hasExistingContent = currentSession && (currentSession.subtitles?.length > 0 || currentSession.isDirty)
          
          // If removing video file, trigger comprehensive integrated cleanup
          if (!value && previousConfig.inputFile) {
            console.log('🗑️ Video file removed, performing integrated cleanup operation')
            
            // Use the integrated atomic operation for comprehensive cleanup
            handleVideoRemovalWithCleanup()
              .then(result => {
                console.log('✅ Integrated video removal completed:', result)
              })
              .catch(error => {
                console.warn('⚠️ Integrated video removal failed:', error)
                // Fallback to standard session reset
                subtitleStore.resetSessionForNewContent('step1_video_change')
              })
          } else if (hasExistingContent) {
            // Only reset if we have existing content that needs to be cleared
            console.log('🔄 Video upload with existing content, performing enhanced session reset')
            performEnhancedSessionReset('step1_video_change', workspaceStore.currentWorkspace?.id)
              .then(result => {
                console.log('✅ Enhanced session reset completed for video change:', result)
              })
              .catch(error => {
                console.warn('⚠️ Enhanced session reset failed, using fallback:', error)
                // Fallback to standard session reset
                subtitleStore.resetSessionForNewContent('step1_video_change')
              })
          } else {
            console.log('🔧 [PERFORMANCE] Video file change but no existing content - skipping session reset')
          }
        }
        
        // JSON import file change (upload/remove) - Enhanced with atomic navigation
        if (key === 'importedJsonFile' && previousConfig.importedJsonFile !== value) {
          console.log('📄 Config: JSON file changed via updateConfig', {
            previousValue: previousConfig.importedJsonFile,
            newValue: value,
            changeType: value ? 'upload' : 'remove',
            triggeredBy: 'updateConfig',
            timestamp: new Date().toISOString()
          })
          
          // PERFORMANCE FIX: Only trigger session reset for significant changes
          const currentSession = subtitleStore.session
          const hasExistingContent = currentSession && (currentSession.subtitles?.length > 0 || currentSession.isDirty)
          const isSignificantChange = (value && !previousConfig.importedJsonFile) || (!value && previousConfig.importedJsonFile)
          
          if (isSignificantChange && (hasExistingContent || value)) {
            console.log('📄 Significant JSON file change, triggering enhanced session reset')
            
            // Use enhanced session reset for better coordination
            performEnhancedSessionReset('step1_import', workspaceStore.currentWorkspace?.id)
              .then(result => {
                console.log('✅ Enhanced session reset completed for JSON import:', result)
                
                // If adding JSON file, prepare for atomic navigation to review
                if (value && !previousConfig.importedJsonFile) {
                  console.log('📄 Session prepared for atomic navigation after JSON import')
                  // Navigation will be handled by the component that processes subtitle data
                  // This ensures session reset happens before navigation
                }
                
                // If removing JSON file, ensure proper workflow navigation
                if (!value && previousConfig.importedJsonFile) {
                  console.log('🔄 JSON file removed, navigating to config')
                  try {
                    navigateToConfig()
                  } catch (navError) {
                    console.warn('Failed to navigate to config after JSON removal:', navError)
                  }
                }
              })
              .catch(error => {
                console.warn('⚠️ Enhanced session reset failed for JSON import, using fallback:', error)
                // Fallback to standard session reset
                subtitleStore.resetSessionForNewContent('step1_import')
              })
          } else {
            console.log('🔧 [PERFORMANCE] JSON file change but no reset needed - skipping session reset')
          }
        }
        
        // Output file change from subtitle generation - Enhanced cleanup
        if (key === 'outputFile' && previousConfig.outputFile !== value && !updatedConfig.importedJsonFile) {
          console.log('⚡ Config: Output file changed via updateConfig (generation), triggering enhanced session reset')
          
          // Use enhanced session reset for generation
          performEnhancedSessionReset('step3_generation', workspaceStore.currentWorkspace?.id)
            .then(result => {
              console.log('✅ Enhanced session reset completed for generation:', result)
              
              // If we have a new output file, prepare workflow for review
              if (value && !previousConfig.outputFile) {
                console.log('✅ New subtitle output generated, workflow prepared for review')
                // Navigation to review will be handled by the processing completion logic
                // This ensures proper session state before navigation
              }
            })
            .catch(error => {
              console.warn('⚠️ Enhanced session reset failed for generation, using fallback:', error)
              // Fallback to standard session reset
              subtitleStore.resetSessionForNewContent('step3_generation')
            })
        }
        
        // Subtitle data change from JSON import - Enhanced session integration with batch protection
        if (key === 'subtitle' && previousConfig.subtitle !== value) {
          console.log('📥 Config: Subtitle data changed via updateConfig, checking for session integration needs', {
            previousDataLength: Array.isArray(previousConfig.subtitle) ? previousConfig.subtitle.length : 0,
            newDataLength: Array.isArray(value) ? value.length : 0,
            isJsonImport: !!updatedConfig.importedJsonFile || !!updatedConfig.isImportedFromJson,
            hasInputFile: !!updatedConfig.inputFile,
            isImportInProgress: !!(window as any).__JSON_IMPORT_IN_PROGRESS,
            timestamp: new Date().toISOString()
          })
          
          // If we have subtitle data from JSON import and an input file, trigger session integration
          if (value && Array.isArray(value) && value.length > 0 && 
              (updatedConfig.importedJsonFile || updatedConfig.isImportedFromJson) && 
              updatedConfig.inputFile) {
            
            console.log('📥 JSON import subtitle data detected, triggering session integration')
            
            // Simple debouncing to prevent multiple rapid integrations
            const integrationKey = 'json-import-integration';
            if ((window as any).__INTEGRATION_TIMEOUTS) {
              clearTimeout((window as any).__INTEGRATION_TIMEOUTS[integrationKey]);
            } else {
              (window as any).__INTEGRATION_TIMEOUTS = {};
            }
            
            (window as any).__INTEGRATION_TIMEOUTS[integrationKey] = setTimeout(async () => {
              // Trigger session integration using the enhanced integration utilities
              try {
                import('../utils/session-workflow-integration')
                  .then(integrationModule => {
                    const { handleJsonImportWithSessionReset } = integrationModule
                    
                    return handleJsonImportWithSessionReset(value, {
                      sourceType: 'json-import-config',
                      timestamp: Date.now(),
                      metadata: {
                        fileName: updatedConfig.importedJsonFile || 'imported-json',
                        subtitleCount: value.length,
                        triggeredBy: 'config-subtitle-update'
                      }
                    })
                  })
                  .then(result => {
                    if (result.success) {
                      console.log('✅ JSON import session integration completed successfully:', result)
                    } else {
                      console.warn('⚠️ JSON import session integration failed:', result.error)
                    }
                  })
                  .catch(error => {
                    console.warn('⚠️ Failed to integrate JSON import with session:', error)
                  })
              } catch (error) {
                console.warn('⚠️ Could not load session integration module:', error)
              }
            }, 300);
          }
          
          // If subtitle data is being cleared, ensure session cleanup
          else if (!value && previousConfig.subtitle) {
            console.log('🗑️ Subtitle data cleared, ensuring session cleanup')
            subtitleStore.resetSessionForNewContent('subtitle_cleared')
          }
        }
      } catch (error) {
        console.warn('Could not trigger enhanced session reset from updateConfig:', error)
        // Continue with normal config update even if session reset fails
      }
      
      // Define which config keys are workspace-specific vs global/system-wide
      const workspaceSpecificKeys: (keyof AppConfig)[] = [
        'inputFile', 'outputFile', 'language', 'model', 'priority', 
        'speakers', 'written', 'music', 'charset', 'noGeminiRefinement',
        'maxChunkDuration', 'videoQuality', 'terminologyConfig', 
        'subtitle', 'duration', 'verbose', 'startTime', 'endTime', 'importedJsonFile'
      ]
      
      const globalKeys: (keyof AppConfig)[] = [
        'geminiKey', 'hfToken', 'ffmpegPath', 'autoSaveApiKeys'
      ]
      
      const isWorkspaceSpecific = workspaceSpecificKeys.includes(key)
      const isGlobal = globalKeys.includes(key)
      
      // Save config to workspace if it's workspace-specific and we have an active workspace
      const workspaceStore = useWorkspaceStore.getState()
      if (isWorkspaceSpecific && workspaceStore.currentWorkspace) {
        // For critical config changes like inputFile/outputFile/importedJsonFile, ensure immediate workspace sync
        if (key === 'inputFile' || key === 'outputFile' || key === 'importedJsonFile') {
          console.log(`🔄 Critical config change: ${key} = ${value}, forcing immediate workspace sync`)
          
          // Update workspace config immediately to prevent race conditions during workspace switching
          try {
            // Force immediate update to workspace store state
            const currentWorkspace = workspaceStore.currentWorkspace
            if (currentWorkspace) {
              // Update the workspace config in memory immediately
              currentWorkspace.config = {
                ...currentWorkspace.config,
                [key]: value
              }
              
              // Also persist to database asynchronously
              workspaceStore.updateWorkspaceConfig(currentWorkspace.id, { [key]: value })
                .then(() => {
                  console.log(`✅ Workspace-specific config '${key}' saved to workspace:`, currentWorkspace.name)
                  
                  // Special logging for importedJsonFile to debug persistence
                  if (key === 'importedJsonFile') {
                    console.log('📄 JSON file path saved to workspace config:', {
                      workspaceId: currentWorkspace.id,
                      workspaceName: currentWorkspace.name,
                      jsonFilePath: value,
                      fullConfigUpdate: { [key]: value }
                    })
                  }
                })
                .catch(error => {
                  console.error('❌ Failed to persist workspace config:', error)
                  
                  // Special error logging for importedJsonFile
                  if (key === 'importedJsonFile') {
                    console.error('📄 Failed to save JSON file path to workspace:', {
                      workspaceId: currentWorkspace.id,
                      jsonFilePath: value,
                      error: error
                    })
                  }
                  
                  // Fallback to localStorage if workspace update fails
                  localStorage.setItem('cantocap-config', JSON.stringify(updatedConfig))
                  console.log('💾 Config saved to localStorage as fallback')
                })
            }
          } catch (syncError) {
            console.error('❌ Failed to sync workspace config immediately:', syncError)
            localStorage.setItem('cantocap-config', JSON.stringify(updatedConfig))
            console.log('💾 Config saved to localStorage as fallback')
          }
        } else {
          // For non-critical changes, use async update as before
          workspaceStore.updateWorkspaceConfig(workspaceStore.currentWorkspace.id, { [key]: value })
            .then(() => {
              console.log(`✅ Workspace-specific config '${key}' saved to workspace:`, workspaceStore.currentWorkspace?.name)
              
              // Special logging for importedJsonFile to debug persistence
              if (key === 'importedJsonFile') {
                console.log('📄 JSON file path saved to workspace config (async):', {
                  workspaceId: workspaceStore.currentWorkspace?.id,
                  workspaceName: workspaceStore.currentWorkspace?.name,
                  jsonFilePath: value,
                  fullConfigUpdate: { [key]: value }
                })
              }
            })
            .catch(error => {
              console.error('❌ Failed to update workspace config:', error)
              
              // Special error logging for importedJsonFile
              if (key === 'importedJsonFile') {
                console.error('📄 Failed to save JSON file path to workspace (async):', {
                  workspaceId: workspaceStore.currentWorkspace?.id,
                  jsonFilePath: value,
                  error: error
                })
              }
              
              // Fallback to localStorage if workspace update fails
              localStorage.setItem('cantocap-config', JSON.stringify(updatedConfig))
              console.log('💾 Config saved to localStorage as fallback')
            })
        }
      } else if (isGlobal || !workspaceStore.currentWorkspace) {
        // Save global settings or fallback to localStorage for persistence
        localStorage.setItem('cantocap-config', JSON.stringify(updatedConfig))
        console.log(`💾 Global config '${key}' saved to localStorage`)
      }
      
      // Also persist certain settings to main process config manager
      try {
        // Save important paths to main process
        if (key === 'inputFile' && value) {
          window.cantocapAPI.setLastInputPath(value as string).catch(console.error)
        }
        if (key === 'outputFile' && value) {
          window.cantocapAPI.setLastOutputPath(value as string).catch(console.error)
        }
        
        // Save other relevant config sections
        if (key === 'geminiKey' || key === 'hfToken' || key === 'apiKeys') {
          window.cantocapAPI.updateConfigSection('apiKeys', { 
            gemini: updatedConfig.geminiKey,
            huggingface: updatedConfig.hfToken
          }).catch(console.error)
        }
        
        if (key === 'ffmpegPath') {
          window.cantocapAPI.updateConfigSection('dependencies', {
            ffmpegPath: value
          }).catch(console.error)
        }
        
        // Save UI preferences
        if (['theme', 'showAdvanced'].includes(key)) {
          window.cantocapAPI.updateConfigSection('ui', {
            theme: updatedConfig.theme || 'system',
            showAdvanced: updatedConfig.showAdvanced !== undefined ? updatedConfig.showAdvanced : true
          }).catch(console.error)
        }
        
        // Save processing preferences
        if (['priority', 'language', 'charset', 'speakers', 'music', 'written'].includes(key)) {
          const modelSettings = {
            priority: updatedConfig.priority || 'balanced'
          }
          const advancedSettings = {
            language: updatedConfig.language || 'zh',
            charset: updatedConfig.charset || 'traditional',
            translation: updatedConfig.written || true,
            speakerDiarization: updatedConfig.speakers || false,
            musicDetection: updatedConfig.music || false
          }
          
          window.cantocapAPI.updateConfigSection('modelSettings', modelSettings).catch(console.error)
          window.cantocapAPI.updateConfigSection('advancedSettings', advancedSettings).catch(console.error)
        }
        
        // Save imported JSON file path
        if (key === 'importedJsonFile') {
          window.cantocapAPI.updateConfigSection('importedCaption', {
            jsonFilePath: value
          }).catch(console.error)
        }
      } catch (error) {
        console.error('Failed to persist config to main process:', error)
      }
    },

    saveStateToStorage: () => {
      try {
        const state = get()
        
        // Save UI state to localStorage
        const uiState = {
          theme: state.ui.theme,
          showAdvanced: state.ui.showAdvanced,
          sidebarExpanded: state.ui.sidebarExpanded,
          processingHistory: state.ui.processingHistory
        }
        
        localStorage.setItem('cantocap-ui-state', JSON.stringify(uiState))
        
        // Also save to main process if relevant
        window.cantocapAPI.updateConfigSection('ui', {
          theme: state.ui.theme,
          showAdvanced: state.ui.showAdvanced
        }).catch(console.error)
        
      } catch (error) {
        console.error('Failed to save state to storage:', error)
      }
    },

    restoreUIState: () => {
      try {
        const savedState = localStorage.getItem('cantocap-ui-state')
        if (savedState) {
          const uiState = JSON.parse(savedState)
          set((state: AppStore) => ({
            ui: {
              ...state.ui,
              ...uiState,
              notifications: [] // Don't restore notifications
            }
          }))
        }
      } catch (error) {
        console.error('Failed to restore UI state:', error)
      }
    },

    loadConfigFromStorage: async () => {
      try {
        // First try to load from main process config manager
        const mainConfig = await window.cantocapAPI.getConfig().catch(() => null)
        
        // Also load from localStorage as fallback
        const localStorageConfig = localStorage.getItem('cantocap-config')
        const localConfig = localStorageConfig ? JSON.parse(localStorageConfig) : null
        
        // Map main process config structure to renderer structure
        let mappedMainConfig = null
        if (mainConfig) {
          mappedMainConfig = {
            ...mainConfig,
            // Map nested API keys to flat structure
            geminiKey: mainConfig.apiKeys?.gemini || '',
            hfToken: mainConfig.apiKeys?.huggingface || '',
            // Map other nested structures as needed
            ffmpegPath: mainConfig.dependencies?.ffmpegPath || null,
            // Map imported JSON file path
            importedJsonFile: mainConfig.importedCaption?.jsonFilePath || null,
            // Remove nested structures to avoid conflicts
            apiKeys: undefined,
            dependencies: undefined,
            modelSettings: undefined,
            advancedSettings: undefined,
            ui: undefined,
            window: undefined,
            importedCaption: undefined
          }
        }
        
        // Merge configs with main process taking priority for certain settings
        const mergedConfig = {
          ...get().config, // Start with defaults
          ...localConfig,  // Apply localStorage config
          ...mappedMainConfig    // Main process overrides (properly mapped)
        }
        
        set((state: AppStore) => ({
          config: { ...state.config, ...mergedConfig }
        }))
        
        // Set paths from main config if available
        if (mainConfig?.lastInputPath) {
          set((state: AppStore) => ({
            config: { ...state.config, inputFile: mainConfig.lastInputPath }
          }))
        }
        if (mainConfig?.lastOutputPath) {
          set((state: AppStore) => ({
            config: { ...state.config, outputFile: mainConfig.lastOutputPath }
          }))
        }

        // Load temp subtitle data if it exists (for JSON imports)
        try {
          const tempResult = await window.cantocapAPI.loadTempSubtitleData();
          if (tempResult.success && tempResult.data) {
            console.log('📄 Restored temp subtitle data from temp file');
            set((state: AppStore) => ({
              config: { 
                ...state.config, 
                subtitle: tempResult.data,
                isImportedFromJson: true 
              }
            }));
          }
        } catch (error) {
          console.error('Failed to load temp subtitle data:', error);
        }

        // Log final config state for debugging JSON file path restoration
        console.log('🔧 Config loaded from storage:', {
          importedJsonFile: get().config.importedJsonFile,
          hasMainConfig: !!mainConfig,
          mainConfigJsonPath: mainConfig?.importedCaption?.jsonFilePath,
          hasLocalConfig: !!localConfig,
          localConfigJsonPath: localConfig?.importedJsonFile,
          mergedJsonPath: mergedConfig.importedJsonFile
        })
        
      } catch (error) {
        console.error('Failed to load config from storage:', error)
        // Fallback to localStorage only
        try {
          const saved = localStorage.getItem('cantocap-config')
          if (saved) {
            const config = JSON.parse(saved) as Partial<AppConfig>
            set((state: AppStore) => ({
              config: { ...state.config, ...config }
            }))
          }
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError)
        }
      }
    },
    
    resetProcessing: () =>
      set((state: AppStore) => ({
        processing: {
          isActive: false,
          stage: 'idle',
          progress: 0,
          message: 'Ready to process',
          timeElapsed: 0,
          timeRemaining: 0,
          currentStep: null,
          totalSteps: null,
          hardwareInfo: null,
          error: null,
          startTime: null,
          debugMessages: [],
          substage: undefined,
          engineStage: undefined,
          statistics: undefined
        }
      })),

    startTranscription: async () => {
      const { config, dependencies } = get()
      
      if (!config.inputFile) {
        get().showNotification('Please select an input file', 'error')
        return
      }

      if (!config.hfToken) {
        get().showNotification('HuggingFace token is required for Whisper model downloads', 'error')
        return
      }

      if (!dependencies.ffmpeg.available) {
        get().showNotification('FFmpeg is not available. Please install FFmpeg and restart the app.', 'error')
        return
      }

      // Trigger enhanced session reset for subtitle generation BEFORE starting transcription
      try {
        const workspaceStore = useWorkspaceStore.getState()
        
        console.log('⚡ User clicked generate subtitle button, triggering enhanced session reset')
        
        // Use the integrated enhanced session reset
        performEnhancedSessionReset('step3_generation', workspaceStore.currentWorkspace?.id)
          .then(result => {
            console.log('✅ Enhanced session reset completed before transcription:', result)
          })
          .catch(error => {
            console.warn('⚠️ Enhanced session reset failed, using fallback:', error)
            // Fallback to standard reset if enhancement fails
            const subtitleStore = useSubtitleEditStore.getState()
            subtitleStore.resetSessionForNewContent('step3_generation')
          })
        
        console.log('✅ Pre-transcription session reset initiated')
      } catch (error) {
        console.warn('Could not trigger enhanced session reset from startTranscription:', error)
      }

      set((state: AppStore) => ({
        processing: {
          ...state.processing,
          isActive: true,
          stage: 'preparing',
          progress: 0,
          message: 'Starting transcription...',
          error: null,
          startTime: Date.now()
        }
      }))

      // Reset steps 4-5 when generate subtitle button is clicked and clear processing errors
      await workflowStateManager.transitionState('review', StepState.Blocked, {
        reason: 'Resetting for new processing'
      })
      await workflowStateManager.transitionState('export', StepState.Blocked, {
        reason: 'Resetting for new processing'
      })
      
      // Clear any error state from processing step when starting new transcription
      await workflowStateManager.transitionState('processing', StepState.Ready, {
        reason: 'Starting new transcription'
      })
      
      // Ensure processing step is accessible and navigate to it
      await workflowStateManager.transitionState('config', StepState.Complete, {
        reason: 'Configuration completed - processing started'
      })
      navigateToProcessing()

      // Add to processing history
      get().addToHistory(config.inputFile, 'started')

      window.cantocapAPI.startTranscription(config)
    },

    cancelTranscription: async () => {
      window.cantocapAPI.cancelProcess()
      set((state: AppStore) => ({
        processing: {
          ...state.processing,
          isActive: false,
          stage: 'cancelled',
          message: 'Transcription cancelled'
        }
      }))
      
      // Disable processing step and reset workflow from config step
      await workflowStateManager.transitionState('processing', StepState.Blocked, {
        reason: 'Processing cancelled by user'
      })
      await workflowStateManager.transitionState('review', StepState.Blocked, {
        reason: 'Processing cancelled - resetting downstream steps'
      })
      await workflowStateManager.transitionState('export', StepState.Blocked, {
        reason: 'Processing cancelled - resetting downstream steps'
      })
      
      // Navigate back to config step when cancelled
      navigateToConfig()
    },

    checkHardware: async () => {
      set((state: AppStore) => ({
        hardware: { ...state.hardware, checking: true, error: null }
      }))

      try {
        const info = await window.cantocapAPI.checkHardware()
        set((state: AppStore) => ({
          hardware: {
            ...state.hardware,
            info,
            lastChecked: Date.now(),
            checking: false,
            error: null
          }
        }))
        return info
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        set((state: AppStore) => ({
          hardware: {
            ...state.hardware,
            checking: false,
            error: errorMsg
          }
        }))
        throw error
      }
    },

    // UI Actions
    setActiveModal: (modal: string | null) => 
      set((state: AppStore) => ({
        ui: { ...state.ui, activeModal: modal }
      })),

    closeModal: () => 
      set((state: AppStore) => ({
        ui: { ...state.ui, activeModal: null }
      })),

    toggleAdvanced: () => {
      set((state: AppStore) => ({
        ui: { ...state.ui, showAdvanced: !state.ui.showAdvanced }
      }))
      // Auto-save UI state when toggling advanced options
      setTimeout(() => get().saveStateToStorage(), 100)
    },

    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 5000) => {
      const id = Date.now()
      const notification: Notification = { id, message, type, timestamp: Date.now() }
      
      set((state: AppStore) => ({
        ui: {
          ...state.ui,
          notifications: [...state.ui.notifications, notification]
        }
      }))

      // Auto-remove notification
      setTimeout(() => {
        get().removeNotification(id)
      }, duration)
    },

    removeNotification: (id: number) =>
      set((state: AppStore) => ({
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(n => n.id !== id)
        }
      })),

    addToHistory: (inputFile: string, status: string, outputFile: string | null = null) => {
      const entry: ProcessingHistoryEntry = {
        id: Date.now(),
        inputFile,
        outputFile,
        status,
        timestamp: Date.now(),
        config: { ...get().config }
      }

      set((state: AppStore) => ({
        ui: {
          ...state.ui,
          processingHistory: [entry, ...state.ui.processingHistory.slice(0, 9)] // Keep last 10
        }
      }))
      
      // Auto-save when adding to history
      setTimeout(() => get().saveStateToStorage(), 100)
    },

    // Utility Functions
    canStartTranscription: () => {
      const { config, dependencies, processing } = get()
      return (
        !!config.inputFile &&
        !!config.hfToken &&
        dependencies.python.available &&
        dependencies.ffmpeg.available &&
        !processing.isActive &&
        !config.importedJsonFile // Disable if JSON caption is imported
      )
    },

    getConfigAsCliArgs: () => {
      const { config } = get()
      const args: string[] = []

      if (config.inputFile) args.push(config.inputFile)
      if (config.outputFile) args.push('--output', config.outputFile)
      if (config.language !== 'zh') args.push('--language', config.language)
      if (config.model) args.push('--model', config.model)
      if (config.priority !== 'balanced') args.push('--priority', config.priority)
      if (config.speakers) args.push('--speakers')
      if (config.written) args.push('--written')
      if (config.music) args.push('--music')
      if (config.charset !== 'traditional') args.push('--charset', config.charset)
      if (config.geminiKey) args.push('--gemini-key', config.geminiKey)
      if (config.noGeminiRefinement) args.push('--no-gemini-refinement')
      if (config.maxChunkDuration !== 15) args.push('--max-chunk-duration', String(config.maxChunkDuration))
      if (config.videoQuality !== '360p') args.push('--video-quality', config.videoQuality)
      if (config.terminologyConfig) args.push('--config', config.terminologyConfig)
      if (config.ffmpegPath) args.push('--ffmpeg-path', config.ffmpegPath)
      if (config.subtitle && typeof config.subtitle === 'string') args.push('--subtitle', config.subtitle)
      if (config.startTime !== null && config.endTime !== null) {
        args.push('--start-time', String(config.startTime))
        args.push('--end-time', String(config.endTime))
      } else if (config.duration !== 10.0) {
        args.push('--duration', String(config.duration))
      }
      if (config.verbose) args.push('--verbose')

      return args
    },

    // Testing and workspace integration methods
    loadFromWorkspace: async (workspace: unknown) => {
      if (workspace && workspace.appConfig) {
        set((state: AppStore) => ({
          config: {
            ...state.config,
            ...workspace.appConfig
          }
        }))
      }
    },

    getConfig: () => {
      return get().config
    },

    reset: () => {
      set({
        isInitialized: false,
        processing: {
          isActive: false,
          stage: 'idle',
          progress: 0,
          message: 'Ready to process',
          timeElapsed: 0,
          timeRemaining: 0,
          currentStep: null,
          totalSteps: null,
          hardwareInfo: null,
          error: null,
          startTime: null,
          debugMessages: [],
          substage: undefined,
          engineStage: undefined,
          statistics: undefined
        },
        ui: {
          activeModal: null,
          showAdvanced: true,
          notifications: [],
          theme: 'system',
          sidebarExpanded: true,
          processingHistory: []
        }
      })
    }
  }))
)


// Listen for workspace changes and reload configuration
useWorkspaceStore.subscribe(
  (state) => state.currentWorkspace,
  (currentWorkspace, previousWorkspace) => {
    if (currentWorkspace && currentWorkspace.id !== previousWorkspace?.id) {
      console.log('🔄 Workspace changed, reloading configuration...', {
        from: previousWorkspace?.name || 'none',
        to: currentWorkspace.name,
        workspaceId: currentWorkspace.id
      })
      
      // Use integrated session coordination for workspace changes
      handleWorkspaceChangeWithSessionCoordination(
        currentWorkspace.id,
        previousWorkspace?.id
      )
        .then(result => {
          console.log('✅ Integrated workspace change completed:', result)
        })
        .catch(error => {
          console.warn('⚠️ Integrated workspace change failed, using fallback:', error)
        })
      
      // Ensure any pending config changes are saved to the previous workspace before switching
      if (previousWorkspace) {
        try {
          const currentConfig = appStore.config
          const workspaceStore = useWorkspaceStore.getState()
          
          // Force save current config to previous workspace to prevent data loss
          console.log('💾 Saving current config to previous workspace before switch:', previousWorkspace.name)
          workspaceStore.updateWorkspaceConfig(previousWorkspace.id, currentConfig).catch(error => {
            console.warn('⚠️ Failed to save config to previous workspace:', error)
          })
        } catch (error) {
          console.warn('⚠️ Error saving config to previous workspace:', error)
        }
      }
      
      // Reset workflow state for new workspace
      try {
        workflowStateManager.reset()
      } catch (error) {
        console.error('Failed to reset workflow for new workspace:', error)
      }
      
      // Get the app store instance
      const appStore = useAppStore.getState()
      
      // Simple workspace config loading
      const workspaceConfig = currentWorkspace.config || {}
      
      // Update app store config with workspace data, preserving system settings
      useAppStore.setState((state) => ({
        config: {
          ...state.config,
          ...workspaceConfig
        }
      }))
      
      console.log('✅ Configuration loaded for workspace:', currentWorkspace.name)
    }
  },
  { 
    equalityFn: (a, b) => a?.id === b?.id,
    fireImmediately: false
  }
)