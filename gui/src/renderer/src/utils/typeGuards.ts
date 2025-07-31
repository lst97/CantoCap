/**
 * Runtime Type Guards and Validation System
 * Provides runtime type checking that works beyond compile time
 * Used for validating step configurations and workspace data
 */

import type {
  WorkflowStepId,
  StepConfigMap,
  InputFileStepConfig,
  ConfigStepConfig,
  ProcessingStepConfig,
  ReviewStepConfig,
  ExportStepConfig,
  VideoMetadata,
  FileValidationResult,
  StepConfiguration,
  StepConfigurationRecord,
  CachedStepConfig,
  WorkspaceError,
  StepConfigError
} from '../types/workspace'

// ============================================================================
// CORE TYPE GUARDS
// ============================================================================

/**
 * Type guard for valid workflow step ID
 */
export function isValidWorkflowStepId(stepId: any): stepId is WorkflowStepId {
  return typeof stepId === 'string' && 
    ['input-file', 'config', 'processing', 'review', 'export'].includes(stepId)
}

/**
 * Type guard for workspace ID (UUID v4)
 */
export function isValidWorkspaceId(id: any): id is string {
  if (typeof id !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Type guard for non-null objects
 */
export function isValidObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Type guard for non-empty strings
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Type guard for positive numbers
 */
export function isPositiveNumber(value: any): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value)
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

// ============================================================================
// STEP CONFIGURATION TYPE GUARDS
// ============================================================================

/**
 * Type guard for VideoMetadata
 */
export function isVideoMetadata(value: any): value is VideoMetadata {
  if (!isValidObject(value)) return false
  
  return (
    isPositiveNumber(value.duration) &&
    isBoolean(value.hasAudio) &&
    isPositiveNumber(value.fileSize) &&
    isNonEmptyString(value.format) &&
    (value.width === undefined || isPositiveNumber(value.width)) &&
    (value.height === undefined || isPositiveNumber(value.height)) &&
    (value.frameRate === undefined || isPositiveNumber(value.frameRate)) &&
    (value.codec === undefined || isNonEmptyString(value.codec)) &&
    (value.bitrate === undefined || isPositiveNumber(value.bitrate)) &&
    (value.aspectRatio === undefined || isNonEmptyString(value.aspectRatio)) &&
    (value.audioCodec === undefined || isNonEmptyString(value.audioCodec)) &&
    (value.audioChannels === undefined || isPositiveNumber(value.audioChannels))
  )
}

/**
 * Type guard for FileValidationResult
 */
export function isFileValidationResult(value: any): value is FileValidationResult {
  if (!isValidObject(value)) return false
  
  return (
    isBoolean(value.isValid) &&
    Array.isArray(value.errors) &&
    value.errors.every(isNonEmptyString) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isNonEmptyString) &&
    ['video', 'audio', 'subtitle', 'unknown'].includes(value.fileType) &&
    Array.isArray(value.supportedFormats) &&
    value.supportedFormats.every(isNonEmptyString) &&
    (value.recommendedAction === undefined || isNonEmptyString(value.recommendedAction))
  )
}

/**
 * Type guard for InputFileStepConfig
 */
export function isInputFileStepConfig(value: any): value is InputFileStepConfig {
  if (!isValidObject(value)) return false
  
  return (
    (value.selectedFile === undefined || isNonEmptyString(value.selectedFile)) &&
    (value.importedJsonFile === undefined || isNonEmptyString(value.importedJsonFile)) &&
    (value.videoMetadata === undefined || isVideoMetadata(value.videoMetadata)) &&
    (value.selectedRange === undefined || (
      isValidObject(value.selectedRange) &&
      isPositiveNumber(value.selectedRange.start) &&
      isPositiveNumber(value.selectedRange.end) &&
      isPositiveNumber(value.selectedRange.duration)
    )) &&
    (value.fileValidation === undefined || isFileValidationResult(value.fileValidation)) &&
    (value.lastInputDirectory === undefined || isNonEmptyString(value.lastInputDirectory)) &&
    (value.filePreferences === undefined || (
      isValidObject(value.filePreferences) &&
      isBoolean(value.filePreferences.autoValidate) &&
      isBoolean(value.filePreferences.extractMetadata) &&
      isBoolean(value.filePreferences.suggestOptimalSettings)
    ))
  )
}

/**
 * Type guard for ConfigStepConfig
 */
export function isConfigStepConfig(value: any): value is ConfigStepConfig {
  if (!isValidObject(value)) return false
  
  const validPriorities = ['speed', 'balanced', 'quality']
  const validCharsets = ['traditional', 'simplified']
  const validVideoQualities = ['360p', '480p', '720p']
  
  return (
    (value.language === undefined || isNonEmptyString(value.language)) &&
    (value.model === undefined || value.model === null || isNonEmptyString(value.model)) &&
    (value.priority === undefined || validPriorities.includes(value.priority)) &&
    (value.speakers === undefined || isBoolean(value.speakers)) &&
    (value.written === undefined || isBoolean(value.written)) &&
    (value.music === undefined || isBoolean(value.music)) &&
    (value.charset === undefined || validCharsets.includes(value.charset)) &&
    (value.geminiKey === undefined || isNonEmptyString(value.geminiKey)) &&
    (value.hfToken === undefined || isNonEmptyString(value.hfToken)) &&
    (value.noGeminiRefinement === undefined || isBoolean(value.noGeminiRefinement)) &&
    (value.maxChunkDuration === undefined || isPositiveNumber(value.maxChunkDuration)) &&
    (value.videoQuality === undefined || validVideoQualities.includes(value.videoQuality)) &&
    (value.terminologyConfig === undefined || value.terminologyConfig === null || isNonEmptyString(value.terminologyConfig)) &&
    (value.ffmpegPath === undefined || value.ffmpegPath === null || isNonEmptyString(value.ffmpegPath)) &&
    (value.advancedOptions === undefined || (
      isValidObject(value.advancedOptions) &&
      (value.advancedOptions.customPrompts === undefined || isValidObject(value.advancedOptions.customPrompts)) &&
      (value.advancedOptions.qualityThresholds === undefined || (
        isValidObject(value.advancedOptions.qualityThresholds) &&
        isPositiveNumber(value.advancedOptions.qualityThresholds.confidence) &&
        isPositiveNumber(value.advancedOptions.qualityThresholds.accuracy)
      )) &&
      (value.advancedOptions.batchSize === undefined || isPositiveNumber(value.advancedOptions.batchSize)) &&
      (value.advancedOptions.parallelProcessing === undefined || isBoolean(value.advancedOptions.parallelProcessing))
    ))
  )
}

/**
 * Type guard for ProcessingStepConfig
 */
export function isProcessingStepConfig(value: any): value is ProcessingStepConfig {
  if (!isValidObject(value)) return false
  
  return (
    (value.verbose === undefined || isBoolean(value.verbose)) &&
    (value.hardwareAcceleration === undefined || (
      isValidObject(value.hardwareAcceleration) &&
      isBoolean(value.hardwareAcceleration.useGPU) &&
      (value.hardwareAcceleration.preferredDevice === undefined || isNonEmptyString(value.hardwareAcceleration.preferredDevice)) &&
      (value.hardwareAcceleration.memoryLimit === undefined || isPositiveNumber(value.hardwareAcceleration.memoryLimit))
    )) &&
    (value.qualitySettings === undefined || (
      isValidObject(value.qualitySettings) &&
      isPositiveNumber(value.qualitySettings.targetAccuracy) &&
      isPositiveNumber(value.qualitySettings.minimumConfidence) &&
      isBoolean(value.qualitySettings.enableQualityChecks)
    )) &&
    (value.monitoring === undefined || (
      isValidObject(value.monitoring) &&
      isBoolean(value.monitoring.enableDetailedLogging) &&
      isBoolean(value.monitoring.trackPerformanceMetrics) &&
      isBoolean(value.monitoring.saveDebugInfo)
    )) &&
    (value.constraints === undefined || (
      isValidObject(value.constraints) &&
      (value.constraints.maxProcessingTime === undefined || isPositiveNumber(value.constraints.maxProcessingTime)) &&
      (value.constraints.memoryLimit === undefined || isPositiveNumber(value.constraints.memoryLimit)) &&
      (value.constraints.cpuUsageLimit === undefined || isPositiveNumber(value.constraints.cpuUsageLimit))
    )) &&
    (value.runtimeState === undefined || isValidObject(value.runtimeState))
  )
}

/**
 * Type guard for ReviewStepConfig
 */
export function isReviewStepConfig(value: any): value is ReviewStepConfig {
  if (!isValidObject(value)) return false
  
  const validEditModes = ['simple', 'advanced']
  const validSeverities = ['low', 'medium', 'high']
  
  return (
    (value.subtitleData === undefined || Array.isArray(value.subtitleData)) &&
    (value.editingPreferences === undefined || (
      isValidObject(value.editingPreferences) &&
      isBoolean(value.editingPreferences.autoSave) &&
      isBoolean(value.editingPreferences.showConfidenceScores) &&
      isBoolean(value.editingPreferences.highlightLowConfidence) &&
      isBoolean(value.editingPreferences.enableSpellCheck) &&
      validEditModes.includes(value.editingPreferences.defaultEditMode)
    )) &&
    (value.qualityValidation === undefined || (
      isValidObject(value.qualityValidation) &&
      isBoolean(value.qualityValidation.checkTimingOverlaps) &&
      isBoolean(value.qualityValidation.validateTextLength) &&
      isBoolean(value.qualityValidation.enforceMinimumDuration) &&
      isBoolean(value.qualityValidation.flagSuspiciousContent)
    )) &&
    (value.reviewState === undefined || (
      isValidObject(value.reviewState) &&
      Array.isArray(value.reviewState.completedSegments) &&
      value.reviewState.completedSegments.every((id: any) => typeof id === 'number') &&
      Array.isArray(value.reviewState.flaggedIssues) &&
      value.reviewState.flaggedIssues.every((issue: any) => (
        isValidObject(issue) &&
        typeof issue.subtitleId === 'number' &&
        isNonEmptyString(issue.issue) &&
        validSeverities.includes(issue.severity) &&
        isBoolean(issue.resolved)
      )) &&
      typeof value.reviewState.reviewProgress === 'number' &&
      (value.reviewState.lastReviewedAt === undefined || typeof value.reviewState.lastReviewedAt === 'number')
    )) &&
    (value.displayOptions === undefined || (
      isValidObject(value.displayOptions) &&
      isPositiveNumber(value.displayOptions.fontSize) &&
      isBoolean(value.displayOptions.showOriginalText) &&
      isBoolean(value.displayOptions.showTranslation) &&
      isBoolean(value.displayOptions.showTimestamps) &&
      isBoolean(value.displayOptions.waveformDisplay)
    ))
  )
}

/**
 * Type guard for ExportStepConfig
 */
export function isExportStepConfig(value: any): value is ExportStepConfig {
  if (!isValidObject(value)) return false
  
  const validFormats = ['srt', 'vtt', 'json', 'txt', 'ass']
  const validEncodings = ['utf8', 'utf16', 'gbk']
  
  return (
    (value.outputFile === undefined || value.outputFile === null || isNonEmptyString(value.outputFile)) &&
    (value.formatSettings === undefined || (
      isValidObject(value.formatSettings) &&
      validFormats.includes(value.formatSettings.format) &&
      validEncodings.includes(value.formatSettings.encoding) &&
      isBoolean(value.formatSettings.includeMetadata) &&
      isBoolean(value.formatSettings.includeConfidenceScores)
    )) &&
    (value.postProcessing === undefined || (
      isValidObject(value.postProcessing) &&
      isBoolean(value.postProcessing.removeEmptyLines) &&
      isBoolean(value.postProcessing.normalizeWhitespace) &&
      isBoolean(value.postProcessing.applyTextFormatting) &&
      isBoolean(value.postProcessing.generateSummary)
    )) &&
    (value.qualityAssurance === undefined || (
      isValidObject(value.qualityAssurance) &&
      isBoolean(value.qualityAssurance.finalValidation) &&
      Array.isArray(value.qualityAssurance.exportChecklist) &&
      value.qualityAssurance.exportChecklist.every(isNonEmptyString) &&
      isBoolean(value.qualityAssurance.backupOriginal)
    )) &&
    (value.exportHistory === undefined || (
      Array.isArray(value.exportHistory) &&
      value.exportHistory.every((entry: any) => (
        isValidObject(entry) &&
        isNonEmptyString(entry.filePath) &&
        isNonEmptyString(entry.format) &&
        typeof entry.timestamp === 'number' &&
        typeof entry.fileSize === 'number' &&
        isBoolean(entry.success)
      ))
    )) &&
    (value.lastExportDirectory === undefined || isNonEmptyString(value.lastExportDirectory))
  )
}

/**
 * Generic type guard for step configurations using step-specific validators
 */
export function isValidStepConfig<K extends WorkflowStepId>(
  stepId: K,
  value: any
): value is StepConfigMap[K] {
  switch (stepId) {
    case 'input-file':
      return isInputFileStepConfig(value)
    case 'config':
      return isConfigStepConfig(value)
    case 'processing':
      return isProcessingStepConfig(value)
    case 'review':
      return isReviewStepConfig(value)
    case 'export':
      return isExportStepConfig(value)
    default:
      return false
  }
}

// ============================================================================
// COMPLEX TYPE GUARDS
// ============================================================================

/**
 * Type guard for StepConfiguration wrapper
 */
export function isStepConfiguration<T = any>(value: any): value is StepConfiguration<T> {
  if (!isValidObject(value)) return false
  
  return (
    isValidWorkflowStepId(value.stepId) &&
    isValidWorkspaceId(value.workspaceId) &&
    isValidObject(value.data) &&
    typeof value.lastModified === 'number' &&
    typeof value.version === 'number' &&
    (value.checksum === undefined || isNonEmptyString(value.checksum)) &&
    (value.schemaVersion === undefined || typeof value.schemaVersion === 'number')
  )
}

/**
 * Type guard for StepConfigurationRecord (database format)
 */
export function isStepConfigurationRecord(value: any): value is StepConfigurationRecord {
  if (!isValidObject(value)) return false
  
  return (
    isValidWorkspaceId(value.workspace_id) &&
    isValidWorkflowStepId(value.step_id) &&
    isNonEmptyString(value.config_data) &&
    typeof value.last_modified === 'number' &&
    typeof value.version === 'number' &&
    typeof value.schema_version === 'number' &&
    (value.checksum === undefined || isNonEmptyString(value.checksum)) &&
    (value.is_compressed === undefined || isBoolean(value.is_compressed))
  )
}

/**
 * Type guard for CachedStepConfig
 */
export function isCachedStepConfig<T = any>(value: any): value is CachedStepConfig<T> {
  if (!isValidObject(value)) return false
  
  return (
    isValidObject(value.data) &&
    typeof value.expiryTime === 'number' &&
    typeof value.accessCount === 'number' &&
    isBoolean(value.isDirty) &&
    typeof value.lastAccessed === 'number' &&
    (value.size === undefined || typeof value.size === 'number')
  )
}

// ============================================================================
// ERROR TYPE GUARDS
// ============================================================================

/**
 * Type guard for WorkspaceError
 */
export function isWorkspaceError(error: any): error is WorkspaceError {
  if (!error || typeof error !== 'object') return false
  
  const validCodes = [
    'WORKSPACE_NOT_FOUND',
    'MIGRATION_FAILED',
    'STORAGE_UNAVAILABLE',
    'VALIDATION_ERROR',
    'BACKUP_FAILED',
    'STEP_CONFIG_ERROR',
    'CACHE_ERROR',
    'BATCH_OPERATION_FAILED'
  ]
  
  return (
    error instanceof Error &&
    isNonEmptyString(error.code) &&
    validCodes.includes(error.code) &&
    (error.workspaceId === undefined || isValidWorkspaceId(error.workspaceId)) &&
    (error.phase === undefined || isNonEmptyString(error.phase)) &&
    (error.stepConfigError === undefined || isStepConfigError(error.stepConfigError)) &&
    (error.affectedSteps === undefined || (
      Array.isArray(error.affectedSteps) &&
      error.affectedSteps.every(isValidWorkflowStepId)
    )) &&
    (error.recoverable === undefined || isBoolean(error.recoverable))
  )
}

/**
 * Type guard for StepConfigError
 */
export function isStepConfigError(error: any): error is StepConfigError {
  if (!error || typeof error !== 'object') return false
  
  const validCodes = [
    'STEP_CONFIG_NOT_FOUND',
    'STEP_CONFIG_INVALID',
    'STEP_CONFIG_MIGRATION_FAILED',
    'STEP_CONFIG_CACHE_ERROR',
    'STEP_CONFIG_SERIALIZATION_ERROR',
    'STEP_CONFIG_VALIDATION_ERROR',
    'STEP_CONFIG_CORRUPTED'
  ]
  
  return (
    error instanceof Error &&
    isNonEmptyString(error.code) &&
    validCodes.includes(error.code) &&
    (error.workspaceId === undefined || isValidWorkspaceId(error.workspaceId)) &&
    (error.stepId === undefined || isValidWorkflowStepId(error.stepId)) &&
    (error.validationErrors === undefined || (
      Array.isArray(error.validationErrors) &&
      error.validationErrors.every(isNonEmptyString)
    )) &&
    (error.recoveryAction === undefined || isNonEmptyString(error.recoveryAction))
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if cache entry is expired
 */
export function isCacheEntryExpired(cached: CachedStepConfig): boolean {
  return Date.now() > cached.expiryTime
}

/**
 * Validate step configuration size
 */
export function isValidStepConfigSize(configData: string, maxSize: number = 1024 * 1024): boolean {
  return configData.length <= maxSize
}

/**
 * Validate JSON string can be parsed
 */
export function isValidJsonString(value: any): value is string {
  if (typeof value !== 'string') return false
  
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Deep validation of nested objects
 * Recursively checks all properties match expected types
 */
export function deepValidateObject(
  value: any,
  schema: Record<string, (val: any) => boolean>
): boolean {
  if (!isValidObject(value)) return false
  
  for (const [key, validator] of Object.entries(schema)) {
    if (key in value && !validator(value[key])) {
      return false
    }
  }
  
  return true
}

/**
 * Sanitize step configuration by removing invalid fields
 */
export function sanitizeStepConfig<K extends WorkflowStepId>(
  stepId: K,
  config: any
): Partial<StepConfigMap[K]> | null {
  if (!isValidObject(config)) return null
  
  // Create a clean copy and validate each field
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(config)) {
    // Basic sanitization - remove undefined, null, or invalid values
    if (value !== undefined && value !== null) {
      sanitized[key] = value
    }
  }
  
  // Validate the complete config
  return isValidStepConfig(stepId, sanitized) ? sanitized : null
}