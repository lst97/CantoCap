import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { navigateToProcessing, navigateToConfig } from '../utils/workflow-navigation'
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

  // Dependencies
  checkDependencies: () => Promise<void>
  updateDependency: (name: string, status: Partial<DependencyStatus>) => void

  // Processing
  updateProcessing: (update: Partial<ProcessingState>) => void
  resetProcessing: () => void
  startTranscription: () => void
  cancelTranscription: () => void
  addDebugMessage: (stage: string, message: string, level?: 'debug' | 'info' | 'warning' | 'error', source?: string) => void

  // Hardware
  checkHardware: () => Promise<HardwareInfo>

  // Configuration
  updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void

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
      speakers: true,
      written: true,
      music: false,
      charset: 'traditional',
      geminiKey: '',
      noGeminiRefinement: false,
      maxChunkDuration: 15,
      videoQuality: '360p',
      terminologyConfig: null,
      ffmpegPath: null,
      subtitle: null,
      duration: 10.0,
      verbose: false,
      startTime: null,
      endTime: null
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

    // Actions
    initializeApp: async () => {
      try {
        const version = await window.cantocapAPI.getAppVersion()
        set({ appVersion: version, isInitialized: true })
        
        // Check dependencies on startup
        get().checkDependencies()
      } catch (error) {
        console.error('Failed to initialize app:', error)
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
          id: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    
    updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
      set((state: AppStore) => ({
        config: { ...state.config, [key]: value }
      }))
      
      // Save config to localStorage for persistence
      const currentConfig = get().config
      localStorage.setItem('cantocap-config', JSON.stringify({
        ...currentConfig,
        [key]: value
      }))
    },

    loadConfigFromStorage: () => {
      try {
        const saved = localStorage.getItem('cantocap-config')
        if (saved) {
          const config = JSON.parse(saved) as Partial<AppConfig>
          set((state: AppStore) => ({
            config: { ...state.config, ...config }
          }))
        }
      } catch (error) {
        console.error('Failed to load config from storage:', error)
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

    startTranscription: () => {
      const { config, dependencies } = get()
      
      if (!config.inputFile) {
        get().showNotification('Please select an input file', 'error')
        return
      }

      if (!dependencies.ffmpeg.available) {
        get().showNotification('FFmpeg is not available. Please install FFmpeg and restart the app.', 'error')
        return
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

      // Navigate to processing step (step 3)
      navigateToProcessing()

      // Add to processing history
      get().addToHistory(config.inputFile, 'started')

      window.cantocapAPI.startTranscription(config)
    },

    cancelTranscription: () => {
      window.cantocapAPI.cancelProcess()
      set((state: AppStore) => ({
        processing: {
          ...state.processing,
          isActive: false,
          stage: 'cancelled',
          message: 'Transcription cancelled'
        }
      }))
      
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

    toggleAdvanced: () =>
      set((state: AppStore) => ({
        ui: { ...state.ui, showAdvanced: !state.ui.showAdvanced }
      })),

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
    },

    // Utility Functions
    canStartTranscription: () => {
      const { config, dependencies, processing } = get()
      return (
        !!config.inputFile &&
        dependencies.python.available &&
        dependencies.ffmpeg.available &&
        !processing.isActive
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
      if (config.subtitle) args.push('--subtitle', config.subtitle)
      if (config.startTime !== null && config.endTime !== null) {
        args.push('--start-time', String(config.startTime))
        args.push('--end-time', String(config.endTime))
      } else if (config.duration !== 10.0) {
        args.push('--duration', String(config.duration))
      }
      if (config.verbose) args.push('--verbose')

      return args
    }
  }))
)

// Persist config changes
useAppStore.subscribe(
  (state) => state.config,
  (config) => {
    localStorage.setItem('cantocap-config', JSON.stringify(config))
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
)