/**
 * Configuration Manager Implementation Examples
 * 
 * Demonstrates type-safe usage patterns, integration examples,
 * and advanced TypeScript features for the configuration manager.
 */

import type {
  ConfigurationManager,
  ConfigUpdateOptions,
  ConfigValidationResult,
  ConfigOperationResult,
  ConfigError,
  ConfigErrorType,
  WorkspaceConfigTarget,
  UnifiedConfigHook,
  TypeSafeConfigOperation,
  WorkspaceSpecificKeys,
  GlobalConfigKeys,
  ConfigValidator,
  ConfigTransformer,
  DEFAULT_CONFIG_UPDATE_OPTIONS
} from './config-manager'
import type { AppConfig } from './index'

// ============================================================================
// TYPE-SAFE CONFIGURATION OPERATIONS
// ============================================================================

/**
 * Example: Type-safe configuration update with automatic routing
 */
export const typesSafeConfigExample = async (
  configManager: ConfigurationManager,
  workspaceId: string | null
) => {
  // ✅ Type-safe workspace-specific configuration
  const inputFileResult = await configManager.setConfig('inputFile', '/path/to/video.mp4', {
    validate: true,
    backup: true
  })
  
  // ✅ Type-safe global configuration
  const geminiKeyResult = await configManager.setConfig('geminiKey', 'sk-...')
  
  // ✅ Type-safe batch updates with validation
  const batchResult = await configManager.updateConfig({
    language: 'en',
    priority: 'quality',
    speakers: true,
    written: false
  }, {
    validate: true,
    timeout: 10000
  })
  
  // ✅ Type-safe configuration retrieval
  const currentLanguage = await configManager.getConfig('language', workspaceId)
  const currentModel = await configManager.getConfig('model', workspaceId)
  
  return {
    inputFileResult,
    geminiKeyResult,
    batchResult,
    currentLanguage,
    currentModel
  }
}

// ============================================================================
// ADVANCED GENERIC OPERATIONS
// ============================================================================

/**
 * Generic configuration operation builder with full type safety
 */
export class TypeSafeConfigBuilder {
  private operations: Array<TypeSafeConfigOperation<any>> = []
  
  /**
   * Add workspace-specific configuration operation
   */
  public setWorkspaceConfig<K extends WorkspaceSpecificKeys>(
    key: K,
    value: AppConfig[K],
    workspaceId: string,
    validator?: ConfigValidator<AppConfig[K]>,
    transformer?: ConfigTransformer<AppConfig[K], AppConfig[K]>
  ): this {
    this.operations.push({
      key,
      value,
      target: { type: 'workspace', workspaceId },
      validator,
      transformer
    })
    return this
  }
  
  /**
   * Add global configuration operation
   */
  public setGlobalConfig<K extends GlobalConfigKeys>(
    key: K,
    value: AppConfig[K],
    validator?: ConfigValidator<AppConfig[K]>,
    transformer?: ConfigTransformer<AppConfig[K], AppConfig[K]>
  ): this {
    this.operations.push({
      key,
      value,
      target: { type: 'global' },
      validator,
      transformer
    })
    return this
  }
  
  /**
   * Execute all operations with type safety
   */
  public async execute(
    configManager: ConfigurationManager,
    options?: ConfigUpdateOptions
  ): Promise<ConfigOperationResult[]> {
    const results: ConfigOperationResult[] = []
    
    for (const operation of this.operations) {
      // Apply transformer if provided
      const finalValue = operation.transformer 
        ? operation.transformer(operation.value)
        : operation.value
      
      // Validate if validator provided
      if (operation.validator) {
        const validation = operation.validator(finalValue)
        if (!validation.isValid) {
          results.push({
            success: false,
            error: new ConfigError(
              ConfigErrorType.VALIDATION_FAILED,
              `Validation failed for ${operation.key}: ${validation.errors.map(e => e.message).join(', ')}`,
              {
                key: operation.key,
                value: finalValue,
                target: operation.target
              }
            )
          })
          continue
        }
      }
      
      // Execute the operation
      const result = await configManager.setConfig(
        operation.key,
        finalValue,
        { ...DEFAULT_CONFIG_UPDATE_OPTIONS, ...options }
      )
      
      results.push(result)
    }
    
    return results
  }
  
  /**
   * Get all operations for inspection
   */
  public getOperations(): ReadonlyArray<TypeSafeConfigOperation<any>> {
    return [...this.operations]
  }
  
  /**
   * Clear all operations
   */
  public clear(): this {
    this.operations = []
    return this
  }
}

// ============================================================================
// CONFIGURATION VALIDATORS
// ============================================================================

/**
 * Type-safe configuration validators
 */
export const ConfigValidators = {
  /**
   * Validate input file path
   */
  inputFile: (value: string | null): ConfigValidationResult<string | null> => {
    if (!value) {
      return { isValid: true, errors: [], warnings: [] }
    }
    
    const errors: any[] = []
    const warnings: any[] = []
    
    // Check file extension
    const validExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v']
    const hasValidExtension = validExtensions.some(ext => 
      value.toLowerCase().endsWith(ext)
    )
    
    if (!hasValidExtension) {
      warnings.push({
        key: 'inputFile',
        message: 'File extension may not be supported',
        value,
        recommendation: `Use one of: ${validExtensions.join(', ')}`
      })
    }
    
    // Check file path format
    if (!/^[a-zA-Z]:|^\//.test(value)) {
      errors.push({
        key: 'inputFile',
        message: 'Invalid file path format',
        value,
        expected: 'Absolute file path',
        severity: 'error' as const
      })
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedValue: value
    }
  },
  
  /**
   * Validate language setting
   */
  language: (value: string): ConfigValidationResult<string> => {
    const supportedLanguages = ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'it', 'ru']
    const errors: any[] = []
    
    if (!supportedLanguages.includes(value)) {
      errors.push({
        key: 'language',
        message: 'Unsupported language code',
        value,
        expected: `One of: ${supportedLanguages.join(', ')}`,
        severity: 'error' as const
      })
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      validatedValue: value
    }
  },
  
  /**
   * Validate API key format
   */
  geminiKey: (value: string): ConfigValidationResult<string> => {
    const errors: any[] = []
    const warnings: any[] = []
    
    if (!value || value.trim().length === 0) {
      errors.push({
        key: 'geminiKey',
        message: 'API key is required',
        value,
        expected: 'Non-empty string',
        severity: 'error' as const
      })
    } else if (value.length < 20) {
      warnings.push({
        key: 'geminiKey',
        message: 'API key appears to be too short',
        value: '***',
        recommendation: 'Verify API key is complete'
      })
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedValue: value
    }
  },
  
  /**
   * Validate time range
   */
  timeRange: (startTime: number | null, endTime: number | null): ConfigValidationResult<{
    startTime: number | null
    endTime: number | null
  }> => {
    const errors: any[] = []
    const warnings: any[] = []
    
    if (startTime !== null && endTime !== null) {
      if (startTime >= endTime) {
        errors.push({
          key: 'startTime',
          message: 'Start time must be less than end time',
          value: startTime,
          expected: `Less than ${endTime}`,
          severity: 'error' as const
        })
      }
      
      if (startTime < 0) {
        errors.push({
          key: 'startTime',
          message: 'Start time cannot be negative',
          value: startTime,
          expected: 'Non-negative number',
          severity: 'error' as const
        })
      }
      
      if (endTime - startTime < 1) {
        warnings.push({
          key: 'endTime',
          message: 'Very short time range may not produce meaningful results',
          value: endTime - startTime,
          recommendation: 'Consider a longer time range'
        })
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedValue: { startTime, endTime }
    }
  }
} as const

// ============================================================================
// CONFIGURATION TRANSFORMERS
// ============================================================================

/**
 * Type-safe configuration transformers
 */
export const ConfigTransformers = {
  /**
   * Normalize file path
   */
  normalizeFilePath: (path: string | null): string | null => {
    if (!path) return null
    return path.replace(/\\/g, '/').trim()
  },
  
  /**
   * Sanitize API key (for logging)
   */
  sanitizeApiKey: (key: string): string => {
    if (!key || key.length < 8) return '***'
    return key.substring(0, 4) + '***' + key.substring(key.length - 4)
  },
  
  /**
   * Round time values
   */
  roundTime: (time: number | null): number | null => {
    if (time === null) return null
    return Math.round(time * 100) / 100
  },
  
  /**
   * Normalize language code
   */
  normalizeLanguage: (lang: string): string => {
    return lang.toLowerCase().substring(0, 2)
  }
} as const

// ============================================================================
// REACT HOOK INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example React hook implementation with full type safety
 */
export const useTypeSafeConfig = (): UnifiedConfigHook => {
  // This would be implemented using React hooks in practice
  const configManager = {} as ConfigurationManager // Injected via context
  const config = {} as AppConfig // Current config state
  const workspaceId = null as string | null // Current workspace
  const isLoading = false // Loading state
  const error = null as ConfigError | null // Error state
  const syncStatus = {} as any // Sync status
  
  return {
    config,
    getConfig: <K extends keyof AppConfig>(key: K) => config[key] ?? null,
    
    setConfig: async <K extends keyof AppConfig>(
      key: K,
      value: AppConfig[K],
      options?: ConfigUpdateOptions
    ) => {
      return configManager.setConfig(key, value, options)
    },
    
    updateConfig: async (
      updates: Partial<AppConfig>,
      options?: ConfigUpdateOptions
    ) => {
      return configManager.updateConfig(updates, options)
    },
    
    resetConfig: async (
      keys?: (keyof AppConfig)[],
      options?: ConfigUpdateOptions
    ) => {
      return configManager.resetConfig(keys, options)
    },
    
    validateConfig: async <K extends keyof AppConfig>(
      key: K,
      value: AppConfig[K]
    ) => {
      return configManager.validateConfig(key, value)
    },
    
    workspaceId,
    isLoading,
    error,
    syncStatus,
    
    switchWorkspace: async (newWorkspaceId: string) => {
      return configManager.switchWorkspace(newWorkspaceId)
    },
    
    clearErrors: () => {
      configManager.clearErrors()
    }
  }
}

// ============================================================================
// USAGE PATTERNS
// ============================================================================

/**
 * Comprehensive usage example demonstrating all type safety features
 */
export const comprehensiveUsageExample = async () => {
  const configManager = {} as ConfigurationManager
  const workspaceId = 'workspace-123'
  
  // 1. Type-safe configuration builder
  const builder = new TypeSafeConfigBuilder()
    .setWorkspaceConfig(
      'inputFile',
      '/path/to/video.mp4',
      workspaceId,
      ConfigValidators.inputFile,
      ConfigTransformers.normalizeFilePath
    )
    .setWorkspaceConfig(
      'language',
      'en',
      workspaceId,
      ConfigValidators.language,
      ConfigTransformers.normalizeLanguage
    )
    .setGlobalConfig(
      'geminiKey',
      'sk-1234567890abcdef',
      ConfigValidators.geminiKey
    )
  
  // Execute operations
  const results = await builder.execute(configManager, {
    validate: true,
    backup: true,
    timeout: 10000
  })
  
  // 2. Manual validation with type safety
  const timeRangeValidation = ConfigValidators.timeRange(0, 120)
  if (!timeRangeValidation.isValid) {
    console.error('Time range validation failed:', timeRangeValidation.errors)
  }
  
  // 3. Batch configuration with error handling
  try {
    const batchResult = await configManager.updateConfig({
      priority: 'quality',
      speakers: true,
      written: false,
      music: true,
      videoQuality: '720p'
    }, {
      validate: true,
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitterFactor: 0.1
      }
    })
    
    if (!batchResult.success) {
      console.error('Batch update failed:', batchResult.error)
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }
  
  // 4. Configuration migration
  const migrationResult = await configManager.migrateFromLegacy()
  if (migrationResult.success && migrationResult.data) {
    console.log('Migration progress:', migrationResult.data.percentage + '%')
  }
  
  return {
    builderResults: results,
    timeRangeValidation,
    operationsCount: builder.getOperations().length
  }
}