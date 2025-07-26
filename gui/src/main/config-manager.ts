import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface AppConfig {
  // File paths
  lastInputPath?: string
  lastOutputPath?: string
  
  // Processing settings
  modelSettings: {
    selectedModel?: string
    priority?: 'speed' | 'quality' | 'balanced'
    useGpu?: boolean
  }
  
  // Advanced settings
  advancedSettings: {
    chunkSize?: number
    overlap?: number
    temperature?: number
    charset?: string
    language?: string
    translation?: boolean
    speakerDiarization?: boolean
    musicDetection?: boolean
  }
  
  // API keys (stored securely)
  apiKeys: {
    openai?: string
    gemini?: string
    huggingface?: string
  }
  
  // Dependencies
  dependencies: {
    pythonPath?: string
    ffmpegPath?: string
    enginePath?: string
  }
  
  // UI preferences
  ui: {
    theme?: 'light' | 'dark' | 'system'
    showAdvanced?: boolean
    rememberSettings?: boolean
  }
  
  // Window state
  window: {
    width?: number
    height?: number
    x?: number
    y?: number
    maximized?: boolean
  }
}

export class ConfigManager {
  private configPath: string
  private config: AppConfig
  private readonly defaultConfig: AppConfig = {
    modelSettings: {
      priority: 'balanced',
      useGpu: true
    },
    advancedSettings: {
      chunkSize: 30,
      overlap: 2,
      temperature: 0.0,
      charset: 'utf-8',
      translation: false,
      speakerDiarization: true,
      musicDetection: true
    },
    apiKeys: {},
    dependencies: {},
    ui: {
      theme: 'system',
      showAdvanced: false,
      rememberSettings: true
    },
    window: {
      width: 1200,
      height: 800,
      maximized: false
    }
  }

  constructor() {
    const userDataPath = app.getPath('userData')
    const configDir = join(userDataPath, 'config')
    
    // Ensure config directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    
    this.configPath = join(configDir, 'app-config.json')
    this.config = this.loadConfig()
  }

  private loadConfig(): AppConfig {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf-8')
        const loadedConfig = JSON.parse(configData)
        
        // Merge with default config to ensure all properties exist
        return this.mergeConfig(this.defaultConfig, loadedConfig)
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error)
    }
    
    return { ...this.defaultConfig }
  }

  private mergeConfig(defaultConfig: AppConfig, loadedConfig: Partial<AppConfig>): AppConfig {
    return {
      ...defaultConfig,
      ...loadedConfig,
      modelSettings: {
        ...defaultConfig.modelSettings,
        ...(loadedConfig.modelSettings || {})
      },
      advancedSettings: {
        ...defaultConfig.advancedSettings,
        ...(loadedConfig.advancedSettings || {})
      },
      apiKeys: {
        ...defaultConfig.apiKeys,
        ...(loadedConfig.apiKeys || {})
      },
      dependencies: {
        ...defaultConfig.dependencies,
        ...(loadedConfig.dependencies || {})
      },
      ui: {
        ...defaultConfig.ui,
        ...(loadedConfig.ui || {})
      },
      window: {
        ...defaultConfig.window,
        ...(loadedConfig.window || {})
      }
    }
  }

  public saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  // Getters
  public getConfig(): AppConfig {
    return { ...this.config }
  }

  public get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.config[section]
  }

  public getLastInputPath(): string | undefined {
    return this.config.lastInputPath
  }

  public getLastOutputPath(): string | undefined {
    return this.config.lastOutputPath
  }

  public getModelSettings() {
    return this.config.modelSettings
  }

  public getAdvancedSettings() {
    return this.config.advancedSettings
  }

  public getApiKeys() {
    return this.config.apiKeys
  }

  public getDependencies() {
    return this.config.dependencies
  }

  public getUISettings() {
    return this.config.ui
  }

  public getWindowState() {
    return this.config.window
  }

  // Setters
  public set<K extends keyof AppConfig>(section: K, value: AppConfig[K]): void {
    this.config[section] = value
    this.saveConfig()
  }

  public setLastInputPath(path: string): void {
    this.config.lastInputPath = path
    this.saveConfig()
  }

  public setLastOutputPath(path: string): void {
    this.config.lastOutputPath = path
    this.saveConfig()
  }

  public updateModelSettings(settings: Partial<AppConfig['modelSettings']>): void {
    this.config.modelSettings = { ...this.config.modelSettings, ...settings }
    this.saveConfig()
  }

  public updateAdvancedSettings(settings: Partial<AppConfig['advancedSettings']>): void {
    this.config.advancedSettings = { ...this.config.advancedSettings, ...settings }
    this.saveConfig()
  }

  public updateApiKey(provider: keyof AppConfig['apiKeys'], key: string): void {
    this.config.apiKeys[provider] = key
    this.saveConfig()
  }

  public updateDependency(dep: keyof AppConfig['dependencies'], path: string): void {
    this.config.dependencies[dep] = path
    this.saveConfig()
  }

  public updateUISettings(settings: Partial<AppConfig['ui']>): void {
    this.config.ui = { ...this.config.ui, ...settings }
    this.saveConfig()
  }

  public updateWindowState(state: Partial<AppConfig['window']>): void {
    this.config.window = { ...this.config.window, ...state }
    this.saveConfig()
  }

  // Utility methods
  public reset(): void {
    this.config = { ...this.defaultConfig }
    this.saveConfig()
  }

  public resetSection<K extends keyof AppConfig>(section: K): void {
    const defaultValue = this.defaultConfig[section]
    this.config[section] = typeof defaultValue === 'object' && defaultValue !== null 
      ? { ...defaultValue } 
      : defaultValue
    this.saveConfig()
  }

  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  public importConfig(configData: string): boolean {
    try {
      const importedConfig = JSON.parse(configData)
      this.config = this.mergeConfig(this.defaultConfig, importedConfig)
      this.saveConfig()
      return true
    } catch (error) {
      console.error('Failed to import config:', error)
      return false
    }
  }

  public getConfigPath(): string {
    return this.configPath
  }
}

// Singleton instance
let configManager: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager()
  }
  return configManager
}