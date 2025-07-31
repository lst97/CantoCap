/**
 * Workspace Migration Service
 * 
 * Handles migration of legacy configuration to new workspace system
 * with comprehensive error handling and data validation.
 */

import { AppConfig, WorkspaceConfig } from '../types/workflow'
import { IndexedDBService } from './indexeddb-service'

export interface MigrationResult {
  success: boolean
  workspaces: WorkspaceConfig[]
  rollback?: boolean
  error?: string
}

export class WorkspaceMigrationService {
  private indexedDBService: IndexedDBService

  constructor() {
    this.indexedDBService = new IndexedDBService()
  }

  /**
   * Migrate legacy app configuration to workspace system
   */
  async migrateAppConfig(legacyConfig: any): Promise<AppConfig> {
    try {
      // Validate and clean the legacy configuration
      const cleanedConfig = this.validateAndCleanConfig(legacyConfig)
      
      // Convert to new format with defaults
      const migratedConfig: AppConfig = {
        language: cleanedConfig.language || 'en',
        model: cleanedConfig.model || 'small',
        priority: cleanedConfig.priority || 'balanced',
        numSpeakers: cleanedConfig.numSpeakers || 'auto',
        outputFormat: cleanedConfig.outputFormat || 'srt',
        batchSize: cleanedConfig.batchSize || 25,
        useGPU: cleanedConfig.useGPU || false,
        deviceId: cleanedConfig.deviceId || 'cpu',
        computeType: cleanedConfig.computeType || 'int8',
        vadFilter: cleanedConfig.vadFilter !== undefined ? cleanedConfig.vadFilter : true,
        vadThreshold: cleanedConfig.vadThreshold || 0.6,
        logProb: cleanedConfig.logProb || -1.0,
        noSpeechThreshold: cleanedConfig.noSpeechThreshold || 0.6,
        compressionRatio: cleanedConfig.compressionRatio || 2.4,
        temperature: cleanedConfig.temperature || [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        bestOf: cleanedConfig.bestOf || 5,
        patience: cleanedConfig.patience || 1.0,
        lengthPenalty: cleanedConfig.lengthPenalty || 1.0,
        repetitionPenalty: cleanedConfig.repetitionPenalty || 1.0,
        noRepeatNgramSize: cleanedConfig.noRepeatNgramSize || 0,
        maxNewTokens: cleanedConfig.maxNewTokens || null,
        promptLookupNumTokens: cleanedConfig.promptLookupNumTokens || null,
        hallucination_silence_threshold: cleanedConfig.hallucination_silence_threshold || null,
        hotwords: cleanedConfig.hotwords || null,
        language_detection_threshold: cleanedConfig.language_detection_threshold || null,
        language_detection_segments: cleanedConfig.language_detection_segments || null
      }

      return migratedConfig
    } catch (error) {
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Migrate workspace configuration
   */
  async migrateWorkspace(workspaceData: any): Promise<WorkspaceConfig> {
    try {
      const migratedAppConfig = await this.migrateAppConfig(workspaceData.appConfig || {})
      
      const workspace: WorkspaceConfig = {
        id: workspaceData.id || this.generateWorkspaceId(),
        name: workspaceData.name || 'Migrated Workspace',
        description: workspaceData.description || 'Migrated from legacy configuration',
        appConfig: migratedAppConfig,
        workflowStep: workspaceData.workflowStep || 'input',
        createdAt: workspaceData.createdAt || new Date(),
        lastUsed: workspaceData.lastUsed || new Date(),
        isActive: workspaceData.isActive || false
      }

      return workspace
    } catch (error) {
      throw new Error(`Workspace migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate and clean configuration data
   */
  private validateAndCleanConfig(config: any): any {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration data')
    }

    const cleaned: any = {}

    // Language validation
    if (config.language && typeof config.language === 'string') {
      const validLanguages = ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'it', 'ru']
      cleaned.language = validLanguages.includes(config.language) ? config.language : 'en'
    }

    // Model validation
    if (config.model && typeof config.model === 'string') {
      const validModels = ['tiny', 'small', 'medium', 'large', 'large-v2', 'large-v3']
      cleaned.model = validModels.includes(config.model) ? config.model : 'small'
    }

    // Priority validation
    if (config.priority && typeof config.priority === 'string') {
      const validPriorities = ['speed', 'balanced', 'quality']
      cleaned.priority = validPriorities.includes(config.priority) ? config.priority : 'balanced'
    }

    // Number type validations
    const numberFields = [
      'batchSize', 'vadThreshold', 'logProb', 'noSpeechThreshold', 
      'compressionRatio', 'bestOf', 'patience', 'lengthPenalty', 
      'repetitionPenalty', 'noRepeatNgramSize'
    ]

    numberFields.forEach(field => {
      if (config[field] !== undefined && config[field] !== null) {
        const num = Number(config[field])
        if (!isNaN(num)) {
          cleaned[field] = num
        }
      }
    })

    // Boolean validations
    const booleanFields = ['useGPU', 'vadFilter']
    booleanFields.forEach(field => {
      if (config[field] !== undefined && config[field] !== null) {
        cleaned[field] = Boolean(config[field])
      }
    })

    // String fields
    const stringFields = [
      'numSpeakers', 'outputFormat', 'deviceId', 'computeType',
      'hotwords'
    ]

    stringFields.forEach(field => {
      if (config[field] && typeof config[field] === 'string') {
        cleaned[field] = config[field]
      }
    })

    // Temperature array validation
    if (config.temperature && Array.isArray(config.temperature)) {
      const validTemps = config.temperature
        .filter(t => typeof t === 'number' && !isNaN(t) && t >= 0 && t <= 1)
      if (validTemps.length > 0) {
        cleaned.temperature = validTemps
      }
    }

    // Nullable number fields
    const nullableNumberFields = [
      'maxNewTokens', 'promptLookupNumTokens', 'hallucination_silence_threshold',
      'language_detection_threshold', 'language_detection_segments'
    ]

    nullableNumberFields.forEach(field => {
      if (config[field] !== undefined) {
        if (config[field] === null) {
          cleaned[field] = null
        } else {
          const num = Number(config[field])
          if (!isNaN(num)) {
            cleaned[field] = num
          }
        }
      }
    })

    return cleaned
  }

  /**
   * Generate unique workspace ID
   */
  private generateWorkspaceId(): string {
    return `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}