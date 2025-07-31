/**
 * Step Configuration Validation System
 * Comprehensive validation functions for each step configuration type
 * Provides detailed error reporting and recovery suggestions
 */

import type {
  WorkflowStepId,
  StepConfigMap,
  StepConfigValidationResult,
  BatchValidationResult,
  InputFileStepConfig,
  ConfigStepConfig,
  ProcessingStepConfig,
  ReviewStepConfig,
  ExportStepConfig
} from '../types/workspace'

import {
  isValidWorkflowStepId,
  isValidObject,
  isNonEmptyString,
  isPositiveNumber,
  isBoolean,
  isVideoMetadata,
  isFileValidationResult
} from './typeGuards'

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

interface ValidationError {
  field: string
  message: string
  value: any
  severity: 'error' | 'warning'
  code?: string
  suggestion?: string
}

interface ValidationWarning {
  field: string
  message: string
  value: any
  suggestion?: string
}

interface ValidationSuggestion {
  field: string
  suggestion: string
  autoApply: boolean
  fixValue?: any
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const VALIDATION_CONSTANTS = {
  // File sizes
  MAX_FILE_PATH_LENGTH: 260,
  MAX_CHUNK_DURATION: 300, // 5 minutes
  MIN_CHUNK_DURATION: 1,
  
  // Quality thresholds
  MIN_CONFIDENCE: 0.1,
  MAX_CONFIDENCE: 1.0,
  MIN_ACCURACY: 0.1,
  MAX_ACCURACY: 1.0,
  
  // UI limits
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 72,
  MAX_BATCH_SIZE: 100,
  
  // File formats
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'],
  SUPPORTED_AUDIO_FORMATS: ['mp3', 'wav', 'aac', 'flac', 'ogg'],
  SUPPORTED_SUBTITLE_FORMATS: ['srt', 'vtt', 'ass', 'ssa', 'sub'],
  
  // Language codes
  SUPPORTED_LANGUAGES: ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru'],
  
  // Video qualities
  SUPPORTED_VIDEO_QUALITIES: ['360p', '480p', '720p', '1080p'],
  
  // Export formats
  SUPPORTED_EXPORT_FORMATS: ['srt', 'vtt', 'json', 'txt', 'ass'],
  SUPPORTED_ENCODINGS: ['utf8', 'utf16', 'gbk']
} as const

// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Create validation error
 */
function createError(
  field: string,
  message: string,
  value: any,
  severity: 'error' | 'warning' = 'error',
  suggestion?: string
): ValidationError {
  return { field, message, value, severity, suggestion }
}

/**
 * Create validation warning
 */
function createWarning(
  field: string,
  message: string,
  value: any,
  suggestion?: string
): ValidationWarning {
  return { field, message, value, suggestion }
}

/**
 * Create validation suggestion
 */
function createSuggestion(
  field: string,
  suggestion: string,
  autoApply: boolean = false,
  fixValue?: any
): ValidationSuggestion {
  return { field, suggestion, autoApply, fixValue }
}

/**
 * Validate file path
 */
function validateFilePath(path: string, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (path.length > VALIDATION_CONSTANTS.MAX_FILE_PATH_LENGTH) {
    errors.push(createError(
      fieldName,
      `File path too long (${path.length} characters, max ${VALIDATION_CONSTANTS.MAX_FILE_PATH_LENGTH})`,
      path,
      'error',
      'Choose a file with a shorter path'
    ))
  }
  
  // Check for invalid characters
  if (/[<>"|?*]/.test(path)) {
    errors.push(createError(
      fieldName,
      'File path contains invalid characters',
      path,
      'error',
      'Choose a file without special characters'
    ))
  }
  
  return errors
}

/**
 * Validate language code
 */
function validateLanguage(language: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!VALIDATION_CONSTANTS.SUPPORTED_LANGUAGES.includes(language)) {
    errors.push(createError(
      'language',
      `Unsupported language: ${language}`,
      language,
      'warning',
      `Use one of: ${VALIDATION_CONSTANTS.SUPPORTED_LANGUAGES.join(', ')}`
    ))
  }
  
  return errors
}

// ============================================================================
// INPUT FILE STEP VALIDATION
// ============================================================================

/**
 * Validate InputFileStepConfig
 */
export function validateInputFileStepConfig(
  config: Partial<InputFileStepConfig>
): StepConfigValidationResult<'input-file'> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: ValidationSuggestion[] = []
  
  if (!isValidObject(config)) {
    errors.push(createError('root', 'Configuration must be an object', config))
    return {
      stepId: 'input-file',
      isValid: false,
      errors,
      warnings,
      suggestions
    }
  }
  
  // Validate selectedFile
  if (config.selectedFile !== undefined) {
    if (!isNonEmptyString(config.selectedFile)) {
      errors.push(createError('selectedFile', 'Selected file must be a non-empty string', config.selectedFile))
    } else {
      errors.push(...validateFilePath(config.selectedFile, 'selectedFile'))
    }
  }
  
  // Validate importedJsonFile
  if (config.importedJsonFile !== undefined) {
    if (!isNonEmptyString(config.importedJsonFile)) {
      errors.push(createError('importedJsonFile', 'Imported JSON file must be a non-empty string', config.importedJsonFile))
    } else {
      errors.push(...validateFilePath(config.importedJsonFile, 'importedJsonFile'))
      
      if (!config.importedJsonFile.toLowerCase().endsWith('.json')) {
        warnings.push(createWarning(
          'importedJsonFile',
          'File does not have .json extension',
          config.importedJsonFile,
          'Ensure the file contains valid JSON data'
        ))
      }
    }
  }
  
  // Validate videoMetadata
  if (config.videoMetadata !== undefined && !isVideoMetadata(config.videoMetadata)) {
    errors.push(createError('videoMetadata', 'Invalid video metadata format', config.videoMetadata))
  }
  
  // Validate selectedRange
  if (config.selectedRange !== undefined) {
    const range = config.selectedRange
    if (!isValidObject(range)) {
      errors.push(createError('selectedRange', 'Selected range must be an object', range))
    } else {
      if (!isPositiveNumber(range.start)) {
        errors.push(createError('selectedRange.start', 'Start time must be a positive number', range.start))
      }
      if (!isPositiveNumber(range.end)) {
        errors.push(createError('selectedRange.end', 'End time must be a positive number', range.end))
      }
      if (!isPositiveNumber(range.duration)) {
        errors.push(createError('selectedRange.duration', 'Duration must be a positive number', range.duration))
      }
      
      if (isPositiveNumber(range.start) && isPositiveNumber(range.end) && range.start >= range.end) {
        errors.push(createError('selectedRange', 'Start time must be less than end time', range))
      }
    }
  }
  
  // Validate fileValidation
  if (config.fileValidation !== undefined && !isFileValidationResult(config.fileValidation)) {
    errors.push(createError('fileValidation', 'Invalid file validation result format', config.fileValidation))
  }
  
  // Validate lastInputDirectory
  if (config.lastInputDirectory !== undefined && !isNonEmptyString(config.lastInputDirectory)) {
    errors.push(createError('lastInputDirectory', 'Last input directory must be a non-empty string', config.lastInputDirectory))
  }
  
  // Validate filePreferences
  if (config.filePreferences !== undefined) {
    const prefs = config.filePreferences
    if (!isValidObject(prefs)) {
      errors.push(createError('filePreferences', 'File preferences must be an object', prefs))
    } else {
      if (prefs.autoValidate !== undefined && !isBoolean(prefs.autoValidate)) {
        errors.push(createError('filePreferences.autoValidate', 'Auto validate must be a boolean', prefs.autoValidate))
      }
      if (prefs.extractMetadata !== undefined && !isBoolean(prefs.extractMetadata)) {
        errors.push(createError('filePreferences.extractMetadata', 'Extract metadata must be a boolean', prefs.extractMetadata))
      }
      if (prefs.suggestOptimalSettings !== undefined && !isBoolean(prefs.suggestOptimalSettings)) {
        errors.push(createError('filePreferences.suggestOptimalSettings', 'Suggest optimal settings must be a boolean', prefs.suggestOptimalSettings))
      }
    }
  }
  
  // Add suggestions
  if (!config.selectedFile) {
    suggestions.push(createSuggestion('selectedFile', 'Select an input video or audio file to begin processing'))
  }
  
  if (config.filePreferences?.autoValidate === false) {
    suggestions.push(createSuggestion(
      'filePreferences.autoValidate', 
      'Enable auto validation for better error detection',
      true,
      true
    ))
  }
  
  return {
    stepId: 'input-file',
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// CONFIG STEP VALIDATION
// ============================================================================

/**
 * Validate ConfigStepConfig
 */
export function validateConfigStepConfig(
  config: Partial<ConfigStepConfig>
): StepConfigValidationResult<'config'> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: ValidationSuggestion[] = []
  
  if (!isValidObject(config)) {
    errors.push(createError('root', 'Configuration must be an object', config))
    return {
      stepId: 'config',
      isValid: false,
      errors,
      warnings,
      suggestions
    }
  }
  
  // Validate language
  if (config.language !== undefined) {
    if (!isNonEmptyString(config.language)) {
      errors.push(createError('language', 'Language must be a non-empty string', config.language))
    } else {
      errors.push(...validateLanguage(config.language))
    }
  }
  
  // Validate model
  if (config.model !== undefined && config.model !== null && !isNonEmptyString(config.model)) {
    errors.push(createError('model', 'Model must be a non-empty string or null', config.model))
  }
  
  // Validate priority
  if (config.priority !== undefined) {
    const validPriorities = ['speed', 'balanced', 'quality']
    if (!validPriorities.includes(config.priority)) {
      errors.push(createError(
        'priority',
        `Invalid priority: ${config.priority}`,
        config.priority,
        'error',
        `Use one of: ${validPriorities.join(', ')}`
      ))
    }
  }
  
  // Validate boolean fields
  const booleanFields = ['speakers', 'written', 'music', 'noGeminiRefinement']
  for (const field of booleanFields) {
    if (config[field as keyof ConfigStepConfig] !== undefined && !isBoolean(config[field as keyof ConfigStepConfig])) {
      errors.push(createError(field, `${field} must be a boolean`, config[field as keyof ConfigStepConfig]))
    }
  }
  
  // Validate charset
  if (config.charset !== undefined) {
    const validCharsets = ['traditional', 'simplified']
    if (!validCharsets.includes(config.charset)) {
      errors.push(createError(
        'charset',
        `Invalid charset: ${config.charset}`,
        config.charset,
        'error',
        `Use one of: ${validCharsets.join(', ')}`
      ))
    }
  }
  
  // Validate API keys
  if (config.geminiKey !== undefined && config.geminiKey !== '' && !isNonEmptyString(config.geminiKey)) {
    errors.push(createError('geminiKey', 'Gemini key must be a non-empty string', config.geminiKey))
  }
  
  if (config.hfToken !== undefined && config.hfToken !== '' && !isNonEmptyString(config.hfToken)) {
    errors.push(createError('hfToken', 'Hugging Face token must be a non-empty string', config.hfToken))
  }
  
  // Validate maxChunkDuration
  if (config.maxChunkDuration !== undefined) {
    if (!isPositiveNumber(config.maxChunkDuration)) {
      errors.push(createError('maxChunkDuration', 'Max chunk duration must be a positive number', config.maxChunkDuration))
    } else if (config.maxChunkDuration < VALIDATION_CONSTANTS.MIN_CHUNK_DURATION) {
      errors.push(createError(
        'maxChunkDuration',
        `Max chunk duration too small (minimum ${VALIDATION_CONSTANTS.MIN_CHUNK_DURATION} seconds)`,
        config.maxChunkDuration
      ))
    } else if (config.maxChunkDuration > VALIDATION_CONSTANTS.MAX_CHUNK_DURATION) {
      warnings.push(createWarning(
        'maxChunkDuration',
        `Max chunk duration is very large (${config.maxChunkDuration} seconds)`,
        config.maxChunkDuration,
        'Consider using a smaller value for better performance'
      ))
    }
  }
  
  // Validate videoQuality
  if (config.videoQuality !== undefined) {
    const validQualities = ['360p', '480p', '720p']
    if (!validQualities.includes(config.videoQuality)) {
      errors.push(createError(
        'videoQuality',
        `Invalid video quality: ${config.videoQuality}`,
        config.videoQuality,
        'error',
        `Use one of: ${validQualities.join(', ')}`
      ))
    }
  }
  
  // Validate file paths
  if (config.terminologyConfig !== undefined && config.terminologyConfig !== null) {
    if (!isNonEmptyString(config.terminologyConfig)) {
      errors.push(createError('terminologyConfig', 'Terminology config must be a non-empty string or null', config.terminologyConfig))
    } else {
      errors.push(...validateFilePath(config.terminologyConfig, 'terminologyConfig'))
    }
  }
  
  if (config.ffmpegPath !== undefined && config.ffmpegPath !== null) {
    if (!isNonEmptyString(config.ffmpegPath)) {
      errors.push(createError('ffmpegPath', 'FFmpeg path must be a non-empty string or null', config.ffmpegPath))
    } else {
      errors.push(...validateFilePath(config.ffmpegPath, 'ffmpegPath'))
    }
  }
  
  // Validate advancedOptions
  if (config.advancedOptions !== undefined) {
    const advanced = config.advancedOptions
    if (!isValidObject(advanced)) {
      errors.push(createError('advancedOptions', 'Advanced options must be an object', advanced))
    } else {
      // Validate qualityThresholds
      if (advanced.qualityThresholds !== undefined) {
        const thresholds = advanced.qualityThresholds
        if (!isValidObject(thresholds)) {
          errors.push(createError('advancedOptions.qualityThresholds', 'Quality thresholds must be an object', thresholds))
        } else {
          if (thresholds.confidence !== undefined) {
            if (!isPositiveNumber(thresholds.confidence) || 
                thresholds.confidence < VALIDATION_CONSTANTS.MIN_CONFIDENCE || 
                thresholds.confidence > VALIDATION_CONSTANTS.MAX_CONFIDENCE) {
              errors.push(createError(
                'advancedOptions.qualityThresholds.confidence',
                `Confidence must be between ${VALIDATION_CONSTANTS.MIN_CONFIDENCE} and ${VALIDATION_CONSTANTS.MAX_CONFIDENCE}`,
                thresholds.confidence
              ))
            }
          }
          
          if (thresholds.accuracy !== undefined) {
            if (!isPositiveNumber(thresholds.accuracy) || 
                thresholds.accuracy < VALIDATION_CONSTANTS.MIN_ACCURACY || 
                thresholds.accuracy > VALIDATION_CONSTANTS.MAX_ACCURACY) {
              errors.push(createError(
                'advancedOptions.qualityThresholds.accuracy',
                `Accuracy must be between ${VALIDATION_CONSTANTS.MIN_ACCURACY} and ${VALIDATION_CONSTANTS.MAX_ACCURACY}`,
                thresholds.accuracy
              ))
            }
          }
        }
      }
      
      // Validate batchSize
      if (advanced.batchSize !== undefined) {
        if (!isPositiveNumber(advanced.batchSize)) {
          errors.push(createError('advancedOptions.batchSize', 'Batch size must be a positive number', advanced.batchSize))
        } else if (advanced.batchSize > VALIDATION_CONSTANTS.MAX_BATCH_SIZE) {
          warnings.push(createWarning(
            'advancedOptions.batchSize',
            `Batch size is very large (${advanced.batchSize})`,
            advanced.batchSize,
            'Consider using a smaller batch size for better memory usage'
          ))
        }
      }
      
      // Validate parallelProcessing
      if (advanced.parallelProcessing !== undefined && !isBoolean(advanced.parallelProcessing)) {
        errors.push(createError('advancedOptions.parallelProcessing', 'Parallel processing must be a boolean', advanced.parallelProcessing))
      }
      
      // Validate customPrompts
      if (advanced.customPrompts !== undefined && !isValidObject(advanced.customPrompts)) {
        errors.push(createError('advancedOptions.customPrompts', 'Custom prompts must be an object', advanced.customPrompts))
      }
    }
  }
  
  // Add suggestions
  if (!config.language) {
    suggestions.push(createSuggestion('language', 'Select a processing language', false))
  }
  
  if (!config.geminiKey && !config.noGeminiRefinement) {
    suggestions.push(createSuggestion('geminiKey', 'Add Gemini API key for enhanced subtitle quality'))
  }
  
  if (config.priority === 'speed' && config.advancedOptions?.qualityThresholds?.accuracy && config.advancedOptions.qualityThresholds.accuracy > 0.9) {
    warnings.push(createWarning(
      'priority',
      'High accuracy threshold with speed priority may cause conflicts',
      config.priority,
      'Consider using balanced or quality priority for high accuracy requirements'
    ))
  }
  
  return {
    stepId: 'config',
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// PROCESSING STEP VALIDATION
// ============================================================================

/**
 * Validate ProcessingStepConfig
 */
export function validateProcessingStepConfig(
  config: Partial<ProcessingStepConfig>
): StepConfigValidationResult<'processing'> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: ValidationSuggestion[] = []
  
  if (!isValidObject(config)) {
    errors.push(createError('root', 'Configuration must be an object', config))
    return {
      stepId: 'processing',
      isValid: false,
      errors,
      warnings,
      suggestions
    }
  }
  
  // Validate verbose
  if (config.verbose !== undefined && !isBoolean(config.verbose)) {
    errors.push(createError('verbose', 'Verbose must be a boolean', config.verbose))
  }
  
  // Validate hardwareAcceleration
  if (config.hardwareAcceleration !== undefined) {
    const hw = config.hardwareAcceleration
    if (!isValidObject(hw)) {
      errors.push(createError('hardwareAcceleration', 'Hardware acceleration must be an object', hw))
    } else {
      if (!isBoolean(hw.useGPU)) {
        errors.push(createError('hardwareAcceleration.useGPU', 'Use GPU must be a boolean', hw.useGPU))
      }
      
      if (hw.preferredDevice !== undefined && !isNonEmptyString(hw.preferredDevice)) {
        errors.push(createError('hardwareAcceleration.preferredDevice', 'Preferred device must be a non-empty string', hw.preferredDevice))
      }
      
      if (hw.memoryLimit !== undefined) {
        if (!isPositiveNumber(hw.memoryLimit)) {
          errors.push(createError('hardwareAcceleration.memoryLimit', 'Memory limit must be a positive number', hw.memoryLimit))
        } else if (hw.memoryLimit < 512) {
          warnings.push(createWarning(
            'hardwareAcceleration.memoryLimit',
            'Memory limit is very low (< 512MB)',
            hw.memoryLimit,
            'Consider increasing memory limit for better performance'
          ))
        }
      }
    }
  }
  
  // Validate qualitySettings
  if (config.qualitySettings !== undefined) {
    const quality = config.qualitySettings
    if (!isValidObject(quality)) {
      errors.push(createError('qualitySettings', 'Quality settings must be an object', quality))
    } else {
      if (quality.targetAccuracy !== undefined) {
        if (!isPositiveNumber(quality.targetAccuracy) || 
            quality.targetAccuracy < VALIDATION_CONSTANTS.MIN_ACCURACY || 
            quality.targetAccuracy > VALIDATION_CONSTANTS.MAX_ACCURACY) {
          errors.push(createError(
            'qualitySettings.targetAccuracy',
            `Target accuracy must be between ${VALIDATION_CONSTANTS.MIN_ACCURACY} and ${VALIDATION_CONSTANTS.MAX_ACCURACY}`,
            quality.targetAccuracy
          ))
        }
      }
      
      if (quality.minimumConfidence !== undefined) {
        if (!isPositiveNumber(quality.minimumConfidence) || 
            quality.minimumConfidence < VALIDATION_CONSTANTS.MIN_CONFIDENCE || 
            quality.minimumConfidence > VALIDATION_CONSTANTS.MAX_CONFIDENCE) {
          errors.push(createError(
            'qualitySettings.minimumConfidence',
            `Minimum confidence must be between ${VALIDATION_CONSTANTS.MIN_CONFIDENCE} and ${VALIDATION_CONSTANTS.MAX_CONFIDENCE}`,
            quality.minimumConfidence
          ))
        }
      }
      
      if (quality.enableQualityChecks !== undefined && !isBoolean(quality.enableQualityChecks)) {
        errors.push(createError('qualitySettings.enableQualityChecks', 'Enable quality checks must be a boolean', quality.enableQualityChecks))
      }
    }
  }
  
  // Validate monitoring
  if (config.monitoring !== undefined) {
    const monitoring = config.monitoring
    if (!isValidObject(monitoring)) {
      errors.push(createError('monitoring', 'Monitoring must be an object', monitoring))
    } else {
      const booleanFields = ['enableDetailedLogging', 'trackPerformanceMetrics', 'saveDebugInfo']
      for (const field of booleanFields) {
        if (monitoring[field as keyof typeof monitoring] !== undefined && 
            !isBoolean(monitoring[field as keyof typeof monitoring])) {
          errors.push(createError(`monitoring.${field}`, `${field} must be a boolean`, monitoring[field as keyof typeof monitoring]))
        }
      }
    }
  }
  
  // Validate constraints
  if (config.constraints !== undefined) {
    const constraints = config.constraints
    if (!isValidObject(constraints)) {
      errors.push(createError('constraints', 'Constraints must be an object', constraints))
    } else {
      if (constraints.maxProcessingTime !== undefined) {
        if (!isPositiveNumber(constraints.maxProcessingTime)) {
          errors.push(createError('constraints.maxProcessingTime', 'Max processing time must be a positive number', constraints.maxProcessingTime))
        } else if (constraints.maxProcessingTime < 60) {
          warnings.push(createWarning(
            'constraints.maxProcessingTime',
            'Max processing time is very low (< 1 minute)',
            constraints.maxProcessingTime,
            'Consider allowing more time for complex processing tasks'
          ))
        }
      }
      
      if (constraints.memoryLimit !== undefined) {
        if (!isPositiveNumber(constraints.memoryLimit)) {
          errors.push(createError('constraints.memoryLimit', 'Memory limit must be a positive number', constraints.memoryLimit))
        } else if (constraints.memoryLimit < 512) {
          warnings.push(createWarning(
            'constraints.memoryLimit',
            'Memory limit is very low (< 512MB)',
            constraints.memoryLimit,
            'Consider increasing memory limit for better performance'
          ))
        }
      }
      
      if (constraints.cpuUsageLimit !== undefined) {
        if (!isPositiveNumber(constraints.cpuUsageLimit)) {
          errors.push(createError('constraints.cpuUsageLimit', 'CPU usage limit must be a positive number', constraints.cpuUsageLimit))
        } else if (constraints.cpuUsageLimit > 100) {
          errors.push(createError('constraints.cpuUsageLimit', 'CPU usage limit cannot exceed 100%', constraints.cpuUsageLimit))
        }
      }
    }
  }
  
  // Add suggestions
  if (config.qualitySettings?.enableQualityChecks === false) {
    suggestions.push(createSuggestion(
      'qualitySettings.enableQualityChecks',
      'Enable quality checks for better output validation',
      true,
      true
    ))
  }
  
  if (config.monitoring?.trackPerformanceMetrics === false) {
    suggestions.push(createSuggestion(
      'monitoring.trackPerformanceMetrics',
      'Enable performance tracking for optimization insights'
    ))
  }
  
  return {
    stepId: 'processing',
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// REVIEW STEP VALIDATION
// ============================================================================

/**
 * Validate ReviewStepConfig
 */
export function validateReviewStepConfig(
  config: Partial<ReviewStepConfig>
): StepConfigValidationResult<'review'> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: ValidationSuggestion[] = []
  
  if (!isValidObject(config)) {
    errors.push(createError('root', 'Configuration must be an object', config))
    return {
      stepId: 'review',
      isValid: false,
      errors,
      warnings,
      suggestions
    }
  }
  
  // Validate subtitleData
  if (config.subtitleData !== undefined && !Array.isArray(config.subtitleData)) {
    errors.push(createError('subtitleData', 'Subtitle data must be an array', config.subtitleData))
  }
  
  // Validate editingPreferences
  if (config.editingPreferences !== undefined) {
    const prefs = config.editingPreferences
    if (!isValidObject(prefs)) {
      errors.push(createError('editingPreferences', 'Editing preferences must be an object', prefs))
    } else {
      const booleanFields = ['autoSave', 'showConfidenceScores', 'highlightLowConfidence', 'enableSpellCheck']
      for (const field of booleanFields) {
        if (prefs[field as keyof typeof prefs] !== undefined && 
            !isBoolean(prefs[field as keyof typeof prefs])) {
          errors.push(createError(`editingPreferences.${field}`, `${field} must be a boolean`, prefs[field as keyof typeof prefs]))
        }
      }
      
      if (prefs.defaultEditMode !== undefined) {
        const validModes = ['simple', 'advanced']
        if (!validModes.includes(prefs.defaultEditMode)) {
          errors.push(createError(
            'editingPreferences.defaultEditMode',
            `Invalid edit mode: ${prefs.defaultEditMode}`,
            prefs.defaultEditMode,
            'error',
            `Use one of: ${validModes.join(', ')}`
          ))
        }
      }
    }
  }
  
  // Validate qualityValidation
  if (config.qualityValidation !== undefined) {
    const validation = config.qualityValidation
    if (!isValidObject(validation)) {
      errors.push(createError('qualityValidation', 'Quality validation must be an object', validation))
    } else {
      const booleanFields = ['checkTimingOverlaps', 'validateTextLength', 'enforceMinimumDuration', 'flagSuspiciousContent']
      for (const field of booleanFields) {
        if (validation[field as keyof typeof validation] !== undefined && 
            !isBoolean(validation[field as keyof typeof validation])) {
          errors.push(createError(`qualityValidation.${field}`, `${field} must be a boolean`, validation[field as keyof typeof validation]))
        }
      }
    }
  }
  
  // Validate displayOptions
  if (config.displayOptions !== undefined) {
    const display = config.displayOptions
    if (!isValidObject(display)) {
      errors.push(createError('displayOptions', 'Display options must be an object', display))
    } else {
      if (display.fontSize !== undefined) {
        if (!isPositiveNumber(display.fontSize)) {
          errors.push(createError('displayOptions.fontSize', 'Font size must be a positive number', display.fontSize))
        } else if (display.fontSize < VALIDATION_CONSTANTS.MIN_FONT_SIZE) {
          errors.push(createError(
            'displayOptions.fontSize',
            `Font size too small (minimum ${VALIDATION_CONSTANTS.MIN_FONT_SIZE}px)`,
            display.fontSize
          ))
        } else if (display.fontSize > VALIDATION_CONSTANTS.MAX_FONT_SIZE) {
          warnings.push(createWarning(
            'displayOptions.fontSize',
            `Font size is very large (${display.fontSize}px)`,
            display.fontSize,
            'Consider using a smaller font size for better readability'
          ))
        }
      }
      
      const booleanFields = ['showOriginalText', 'showTranslation', 'showTimestamps', 'waveformDisplay']
      for (const field of booleanFields) {
        if (display[field as keyof typeof display] !== undefined && 
            !isBoolean(display[field as keyof typeof display])) {
          errors.push(createError(`displayOptions.${field}`, `${field} must be a boolean`, display[field as keyof typeof display]))
        }
      }
    }
  }
  
  // Validate reviewState
  if (config.reviewState !== undefined) {
    const state = config.reviewState
    if (!isValidObject(state)) {
      errors.push(createError('reviewState', 'Review state must be an object', state))
    } else {
      if (state.completedSegments !== undefined) {
        if (!Array.isArray(state.completedSegments)) {
          errors.push(createError('reviewState.completedSegments', 'Completed segments must be an array', state.completedSegments))
        } else if (!state.completedSegments.every((id: any) => typeof id === 'number')) {
          errors.push(createError('reviewState.completedSegments', 'Completed segments must contain only numbers', state.completedSegments))
        }
      }
      
      if (state.flaggedIssues !== undefined) {
        if (!Array.isArray(state.flaggedIssues)) {
          errors.push(createError('reviewState.flaggedIssues', 'Flagged issues must be an array', state.flaggedIssues))
        } else {
          state.flaggedIssues.forEach((issue: any, index: number) => {
            if (!isValidObject(issue)) {
              errors.push(createError(`reviewState.flaggedIssues[${index}]`, 'Issue must be an object', issue))
            } else {
              if (typeof issue.subtitleId !== 'number') {
                errors.push(createError(`reviewState.flaggedIssues[${index}].subtitleId`, 'Subtitle ID must be a number', issue.subtitleId))
              }
              if (!isNonEmptyString(issue.issue)) {
                errors.push(createError(`reviewState.flaggedIssues[${index}].issue`, 'Issue description must be a non-empty string', issue.issue))
              }
              if (!['low', 'medium', 'high'].includes(issue.severity)) {
                errors.push(createError(`reviewState.flaggedIssues[${index}].severity`, 'Invalid severity level', issue.severity))
              }
              if (!isBoolean(issue.resolved)) {
                errors.push(createError(`reviewState.flaggedIssues[${index}].resolved`, 'Resolved must be a boolean', issue.resolved))
              }
            }
          })
        }
      }
      
      if (state.reviewProgress !== undefined && (typeof state.reviewProgress !== 'number' || state.reviewProgress < 0 || state.reviewProgress > 100)) {
        errors.push(createError('reviewState.reviewProgress', 'Review progress must be a number between 0 and 100', state.reviewProgress))
      }
      
      if (state.lastReviewedAt !== undefined && typeof state.lastReviewedAt !== 'number') {
        errors.push(createError('reviewState.lastReviewedAt', 'Last reviewed at must be a timestamp number', state.lastReviewedAt))
      }
    }
  }
  
  // Add suggestions
  if (config.editingPreferences?.autoSave === false) {
    suggestions.push(createSuggestion(
      'editingPreferences.autoSave',
      'Enable auto-save to prevent losing changes',
      true,
      true
    ))
  }
  
  if (config.qualityValidation?.checkTimingOverlaps === false) {
    suggestions.push(createSuggestion(
      'qualityValidation.checkTimingOverlaps',
      'Enable timing overlap checks for better subtitle quality'
    ))
  }
  
  return {
    stepId: 'review',
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// EXPORT STEP VALIDATION
// ============================================================================

/**
 * Validate ExportStepConfig
 */
export function validateExportStepConfig(
  config: Partial<ExportStepConfig>
): StepConfigValidationResult<'export'> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: ValidationSuggestion[] = []
  
  if (!isValidObject(config)) {
    errors.push(createError('root', 'Configuration must be an object', config))
    return {
      stepId: 'export',
      isValid: false,
      errors,
      warnings,
      suggestions
    }
  }
  
  // Validate outputFile
  if (config.outputFile !== undefined && config.outputFile !== null) {
    if (!isNonEmptyString(config.outputFile)) {
      errors.push(createError('outputFile', 'Output file must be a non-empty string or null', config.outputFile))
    } else {
      errors.push(...validateFilePath(config.outputFile, 'outputFile'))
    }
  }
  
  // Validate formatSettings
  if (config.formatSettings !== undefined) {
    const format = config.formatSettings
    if (!isValidObject(format)) {
      errors.push(createError('formatSettings', 'Format settings must be an object', format))
    } else {
      if (!VALIDATION_CONSTANTS.SUPPORTED_EXPORT_FORMATS.includes(format.format)) {
        errors.push(createError(
          'formatSettings.format',
          `Unsupported export format: ${format.format}`,
          format.format,
          'error',
          `Use one of: ${VALIDATION_CONSTANTS.SUPPORTED_EXPORT_FORMATS.join(', ')}`
        ))
      }
      
      if (!VALIDATION_CONSTANTS.SUPPORTED_ENCODINGS.includes(format.encoding)) {
        errors.push(createError(
          'formatSettings.encoding',
          `Unsupported encoding: ${format.encoding}`,
          format.encoding,
          'error',
          `Use one of: ${VALIDATION_CONSTANTS.SUPPORTED_ENCODINGS.join(', ')}`
        ))
      }
      
      const booleanFields = ['includeMetadata', 'includeConfidenceScores']
      for (const field of booleanFields) {
        if (format[field as keyof typeof format] !== undefined && 
            !isBoolean(format[field as keyof typeof format])) {
          errors.push(createError(`formatSettings.${field}`, `${field} must be a boolean`, format[field as keyof typeof format]))
        }
      }
    }
  }
  
  // Validate postProcessing
  if (config.postProcessing !== undefined) {
    const postProc = config.postProcessing
    if (!isValidObject(postProc)) {
      errors.push(createError('postProcessing', 'Post processing must be an object', postProc))
    } else {
      const booleanFields = ['removeEmptyLines', 'normalizeWhitespace', 'applyTextFormatting', 'generateSummary']
      for (const field of booleanFields) {
        if (postProc[field as keyof typeof postProc] !== undefined && 
            !isBoolean(postProc[field as keyof typeof postProc])) {
          errors.push(createError(`postProcessing.${field}`, `${field} must be a boolean`, postProc[field as keyof typeof postProc]))
        }
      }
    }
  }
  
  // Validate qualityAssurance
  if (config.qualityAssurance !== undefined) {
    const qa = config.qualityAssurance
    if (!isValidObject(qa)) {
      errors.push(createError('qualityAssurance', 'Quality assurance must be an object', qa))
    } else {
      const booleanFields = ['finalValidation', 'backupOriginal']
      for (const field of booleanFields) {
        if (qa[field as keyof typeof qa] !== undefined && 
            !isBoolean(qa[field as keyof typeof qa])) {
          errors.push(createError(`qualityAssurance.${field}`, `${field} must be a boolean`, qa[field as keyof typeof qa]))
        }
      }
      
      if (qa.exportChecklist !== undefined) {
        if (!Array.isArray(qa.exportChecklist)) {
          errors.push(createError('qualityAssurance.exportChecklist', 'Export checklist must be an array', qa.exportChecklist))
        } else if (!qa.exportChecklist.every(isNonEmptyString)) {
          errors.push(createError('qualityAssurance.exportChecklist', 'Export checklist must contain only non-empty strings', qa.exportChecklist))
        }
      }
    }
  }
  
  // Validate exportHistory
  if (config.exportHistory !== undefined) {
    if (!Array.isArray(config.exportHistory)) {
      errors.push(createError('exportHistory', 'Export history must be an array', config.exportHistory))
    } else {
      config.exportHistory.forEach((entry: any, index: number) => {
        if (!isValidObject(entry)) {
          errors.push(createError(`exportHistory[${index}]`, 'Export history entry must be an object', entry))
        } else {
          if (!isNonEmptyString(entry.filePath)) {
            errors.push(createError(`exportHistory[${index}].filePath`, 'File path must be a non-empty string', entry.filePath))
          }
          if (!isNonEmptyString(entry.format)) {
            errors.push(createError(`exportHistory[${index}].format`, 'Format must be a non-empty string', entry.format))
          }
          if (typeof entry.timestamp !== 'number') {
            errors.push(createError(`exportHistory[${index}].timestamp`, 'Timestamp must be a number', entry.timestamp))
          }
          if (typeof entry.fileSize !== 'number') {
            errors.push(createError(`exportHistory[${index}].fileSize`, 'File size must be a number', entry.fileSize))
          }
          if (!isBoolean(entry.success)) {
            errors.push(createError(`exportHistory[${index}].success`, 'Success must be a boolean', entry.success))
          }
        }
      })
    }
  }
  
  // Validate lastExportDirectory
  if (config.lastExportDirectory !== undefined && !isNonEmptyString(config.lastExportDirectory)) {
    errors.push(createError('lastExportDirectory', 'Last export directory must be a non-empty string', config.lastExportDirectory))
  }
  
  // Add suggestions
  if (!config.outputFile) {
    suggestions.push(createSuggestion('outputFile', 'Specify an output file path for export'))
  }
  
  if (config.qualityAssurance?.finalValidation === false) {
    suggestions.push(createSuggestion(
      'qualityAssurance.finalValidation',
      'Enable final validation for quality assurance',
      true,
      true
    ))
  }
  
  if (config.qualityAssurance?.backupOriginal === false) {
    suggestions.push(createSuggestion(
      'qualityAssurance.backupOriginal',
      'Enable backup of original files for safety'
    ))
  }
  
  return {
    stepId: 'export',
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// GENERIC VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate any step configuration using the appropriate validator
 */
export function validateStepConfig<K extends WorkflowStepId>(
  stepId: K,
  config: any
): StepConfigValidationResult<K> {
  if (!isValidWorkflowStepId(stepId)) {
    return {
      stepId: stepId as K,
      isValid: false,
      errors: [createError('stepId', 'Invalid step ID', stepId)],
      warnings: [],
      suggestions: []
    }
  }
  
  switch (stepId) {
    case 'input-file':
      return validateInputFileStepConfig(config) as StepConfigValidationResult<K>
    case 'config':
      return validateConfigStepConfig(config) as StepConfigValidationResult<K>
    case 'processing':
      return validateProcessingStepConfig(config) as StepConfigValidationResult<K>
    case 'review':
      return validateReviewStepConfig(config) as StepConfigValidationResult<K>
    case 'export':
      return validateExportStepConfig(config) as StepConfigValidationResult<K>
    default:
      return {
        stepId: stepId as K,
        isValid: false,
        errors: [createError('stepId', `Unsupported step ID: ${stepId}`, stepId)],
        warnings: [],
        suggestions: []
      }
  }
}

/**
 * Validate multiple step configurations in batch
 */
export function validateBatchStepConfigs(
  stepConfigs: Partial<Record<WorkflowStepId, any>>
): BatchValidationResult {
  const stepResults: Partial<Record<WorkflowStepId, StepConfigValidationResult<WorkflowStepId>>> = {}
  let totalErrors = 0
  let totalWarnings = 0
  const criticalErrors: WorkflowStepId[] = []
  
  for (const [stepId, config] of Object.entries(stepConfigs)) {
    if (isValidWorkflowStepId(stepId)) {
      const result = validateStepConfig(stepId, config)
      stepResults[stepId] = result
      
      totalErrors += result.errors.length
      totalWarnings += result.warnings.length
      
      if (!result.isValid) {
        criticalErrors.push(stepId)
      }
    }
  }
  
  return {
    overallValid: totalErrors === 0,
    stepResults,
    totalErrors,
    totalWarnings,
    criticalErrors
  }
}

/**
 * Get validation summary for a step configuration
 */
export function getValidationSummary<K extends WorkflowStepId>(
  result: StepConfigValidationResult<K>
): string {
  if (result.isValid) {
    return result.warnings.length > 0 
      ? `Valid with ${result.warnings.length} warning(s)`
      : 'Valid'
  }
  
  return `Invalid: ${result.errors.length} error(s)${result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : ''}`
}