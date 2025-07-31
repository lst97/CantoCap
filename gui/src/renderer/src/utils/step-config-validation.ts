/**
 * Step Configuration Runtime Validation System
 * 
 * Provides comprehensive runtime type validation, schema validation, and error handling
 * for the step-specific configuration system. Ensures type safety at runtime while
 * maintaining excellent TypeScript developer experience.
 * 
 * @author TypeScript Pro - Phase 2 Implementation
 */

import type {
  WorkflowStepId,
  StepConfigMap,
  InputFileStepConfig,
  ConfigStepConfig,
  ProcessingStepConfig,
  ReviewStepConfig,
  ExportStepConfig,
  StepConfigValidationResult,
  BatchValidationResult,
  VideoMetadata,
  FileValidationResult,
  StepConfigError,
  WorkspaceError
} from '../types/workspace'

import {
  WORKSPACE_CONSTANTS,
  STEP_CONFIG_SCHEMA_VERSIONS,
  isValidWorkflowStepId,
  isValidWorkspaceId,
  estimateConfigSize
} from '../types/workspace'

// ============================================================================
// CORE VALIDATION ERROR SYSTEM
// ============================================================================

/**
 * Enhanced error class for step configuration validation
 */
export class StepConfigValidationError extends Error implements StepConfigError {
  public readonly code: StepConfigError['code']
  public readonly workspaceId?: string
  public readonly stepId?: WorkflowStepId
  public readonly configData?: any
  public readonly validationErrors?: string[]
  public readonly recoveryAction?: string

  constructor(
    code: StepConfigError['code'],
    message: string,
    options: {
      workspaceId?: string
      stepId?: WorkflowStepId
      configData?: any
      validationErrors?: string[]
      recoveryAction?: string
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'StepConfigValidationError'
    this.code = code
    this.workspaceId = options.workspaceId
    this.stepId = options.stepId
    this.configData = options.configData
    this.validationErrors = options.validationErrors || []
    this.recoveryAction = options.recoveryAction
    
    if (options.cause) {
      this.cause = options.cause
    }
  }
}

/**
 * Create standardized step configuration error
 */
export function createStepConfigError(
  code: StepConfigError['code'],
  message: string,
  stepId?: WorkflowStepId,
  workspaceId?: string,
  configData?: any,
  validationErrors?: string[],
  recoveryAction?: string
): StepConfigValidationError {
  return new StepConfigValidationError(code, message, {
    workspaceId,
    stepId,
    configData,
    validationErrors,
    recoveryAction
  })
}

// ============================================================================
// TYPE GUARD FUNCTIONS
// ============================================================================

/**
 * Enhanced type guard for valid step configuration data
 */
export function isValidStepConfig<T extends StepConfigMap[K], K extends WorkflowStepId>(
  data: any,
  stepId: K
): data is T {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Step-specific validation
  switch (stepId) {
    case 'input-file':
      return isValidInputFileConfig(data)
    case 'config':
      return isValidConfigStepConfig(data)
    case 'processing':
      return isValidProcessingStepConfig(data)
    case 'review':
      return isValidReviewStepConfig(data)
    case 'export':
      return isValidExportStepConfig(data)
    default:
      return false
  }
}

/**
 * Type guard for InputFileStepConfig
 */
function isValidInputFileConfig(data: any): data is InputFileStepConfig {
  // Optional fields validation
  if (data.selectedFile !== undefined && typeof data.selectedFile !== 'string') {
    return false
  }
  
  if (data.importedJsonFile !== undefined && typeof data.importedJsonFile !== 'string') {
    return false
  }
  
  if (data.videoMetadata !== undefined && !isValidVideoMetadata(data.videoMetadata)) {
    return false
  }
  
  if (data.selectedRange !== undefined && !isValidTimeRange(data.selectedRange)) {
    return false
  }
  
  if (data.fileValidation !== undefined && !isValidFileValidationResult(data.fileValidation)) {
    return false
  }
  
  if (data.lastInputDirectory !== undefined && typeof data.lastInputDirectory !== 'string') {
    return false
  }
  
  if (data.filePreferences !== undefined && !isValidFilePreferences(data.filePreferences)) {
    return false
  }
  
  return true
}

/**
 * Type guard for ConfigStepConfig
 */
function isValidConfigStepConfig(data: any): data is ConfigStepConfig {
  const validLanguages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'it', 'ru']
  const validPriorities = ['speed', 'balanced', 'quality']
  const validCharsets = ['traditional', 'simplified']
  const validVideoQualities = ['360p', '480p', '720p']
  
  // Language validation
  if (data.language !== undefined && !validLanguages.includes(data.language)) {
    return false
  }
  
  // Priority validation
  if (data.priority !== undefined && !validPriorities.includes(data.priority)) {
    return false
  }
  
  // Boolean field validation
  const booleanFields = ['speakers', 'written', 'music', 'noGeminiRefinement']
  for (const field of booleanFields) {
    if (data[field] !== undefined && typeof data[field] !== 'boolean') {
      return false
    }
  }
  
  // Charset validation
  if (data.charset !== undefined && !validCharsets.includes(data.charset)) {
    return false
  }
  
  // String field validation
  const stringFields = ['model', 'geminiKey', 'hfToken', 'terminologyConfig', 'ffmpegPath']
  for (const field of stringFields) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') {
      return false
    }
  }
  
  // Numeric field validation
  if (data.maxChunkDuration !== undefined && (typeof data.maxChunkDuration !== 'number' || data.maxChunkDuration <= 0)) {
    return false
  }
  
  // Video quality validation
  if (data.videoQuality !== undefined && !validVideoQualities.includes(data.videoQuality)) {
    return false
  }
  
  // Advanced options validation
  if (data.advancedOptions !== undefined && !isValidAdvancedOptions(data.advancedOptions)) {
    return false
  }
  
  return true
}

/**
 * Type guard for ProcessingStepConfig
 */
function isValidProcessingStepConfig(data: any): data is ProcessingStepConfig {
  // Boolean validation
  if (data.verbose !== undefined && typeof data.verbose !== 'boolean') {
    return false
  }
  
  // Hardware acceleration validation
  if (data.hardwareAcceleration !== undefined && !isValidHardwareAcceleration(data.hardwareAcceleration)) {
    return false
  }
  
  // Quality settings validation
  if (data.qualitySettings !== undefined && !isValidQualitySettings(data.qualitySettings)) {
    return false
  }
  
  // Monitoring validation
  if (data.monitoring !== undefined && !isValidMonitoring(data.monitoring)) {
    return false
  }
  
  // Constraints validation
  if (data.constraints !== undefined && !isValidConstraints(data.constraints)) {
    return false
  }
  
  // Runtime state validation (should not be persisted)
  if (data.runtimeState !== undefined && !isValidRuntimeState(data.runtimeState)) {
    return false
  }
  
  return true
}

/**
 * Type guard for ReviewStepConfig
 */
function isValidReviewStepConfig(data: any): data is ReviewStepConfig {
  // Subtitle data validation
  if (data.subtitleData !== undefined && !Array.isArray(data.subtitleData)) {
    return false
  }
  
  // Editing preferences validation
  if (data.editingPreferences !== undefined && !isValidEditingPreferences(data.editingPreferences)) {
    return false
  }
  
  // Quality validation settings
  if (data.qualityValidation !== undefined && !isValidQualityValidation(data.qualityValidation)) {
    return false
  }
  
  // Review state validation
  if (data.reviewState !== undefined && !isValidReviewState(data.reviewState)) {
    return false
  }
  
  // Display options validation
  if (data.displayOptions !== undefined && !isValidDisplayOptions(data.displayOptions)) {
    return false
  }
  
  return true
}

/**
 * Type guard for ExportStepConfig
 */
function isValidExportStepConfig(data: any): data is ExportStepConfig {
  // Output file validation
  if (data.outputFile !== undefined && data.outputFile !== null && typeof data.outputFile !== 'string') {
    return false
  }
  
  // Format settings validation
  if (data.formatSettings !== undefined && !isValidFormatSettings(data.formatSettings)) {
    return false
  }
  
  // Post-processing validation
  if (data.postProcessing !== undefined && !isValidPostProcessing(data.postProcessing)) {
    return false
  }
  
  // Quality assurance validation
  if (data.qualityAssurance !== undefined && !isValidQualityAssurance(data.qualityAssurance)) {
    return false
  }
  
  // Export history validation
  if (data.exportHistory !== undefined && !isValidExportHistory(data.exportHistory)) {
    return false
  }
  
  // Last export directory validation
  if (data.lastExportDirectory !== undefined && typeof data.lastExportDirectory !== 'string') {
    return false
  }
  
  return true
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

function isValidVideoMetadata(data: any): data is VideoMetadata {
  return (
    typeof data === 'object' &&
    typeof data.duration === 'number' &&
    typeof data.hasAudio === 'boolean' &&
    typeof data.fileSize === 'number' &&
    typeof data.format === 'string' &&
    data.duration > 0 &&
    data.fileSize > 0
  )
}

function isValidTimeRange(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.start === 'number' &&
    typeof data.end === 'number' &&
    typeof data.duration === 'number' &&
    data.start >= 0 &&
    data.end > data.start &&
    data.duration === data.end - data.start
  )
}

function isValidFileValidationResult(data: any): data is FileValidationResult {
  const validFileTypes = ['video', 'audio', 'subtitle', 'unknown']
  return (
    typeof data === 'object' &&
    typeof data.isValid === 'boolean' &&
    Array.isArray(data.errors) &&
    Array.isArray(data.warnings) &&
    validFileTypes.includes(data.fileType) &&
    Array.isArray(data.supportedFormats)
  )
}

function isValidFilePreferences(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.autoValidate === 'boolean' &&
    typeof data.extractMetadata === 'boolean' &&
    typeof data.suggestOptimalSettings === 'boolean'
  )
}

function isValidAdvancedOptions(data: any): boolean {
  if (typeof data !== 'object') return false
  
  // Custom prompts validation
  if (data.customPrompts !== undefined) {
    if (typeof data.customPrompts !== 'object' || Array.isArray(data.customPrompts)) {
      return false
    }
  }
  
  // Quality thresholds validation
  if (data.qualityThresholds !== undefined) {
    if (
      typeof data.qualityThresholds !== 'object' ||
      typeof data.qualityThresholds.confidence !== 'number' ||
      typeof data.qualityThresholds.accuracy !== 'number' ||
      data.qualityThresholds.confidence < 0 ||
      data.qualityThresholds.confidence > 1 ||
      data.qualityThresholds.accuracy < 0 ||
      data.qualityThresholds.accuracy > 1
    ) {
      return false
    }
  }
  
  // Batch size validation
  if (data.batchSize !== undefined && (typeof data.batchSize !== 'number' || data.batchSize <= 0)) {
    return false
  }
  
  // Parallel processing validation
  if (data.parallelProcessing !== undefined && typeof data.parallelProcessing !== 'boolean') {
    return false
  }
  
  return true
}

function isValidHardwareAcceleration(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.useGPU === 'boolean' &&
    (data.preferredDevice === undefined || typeof data.preferredDevice === 'string') &&
    (data.memoryLimit === undefined || (typeof data.memoryLimit === 'number' && data.memoryLimit > 0))
  )
}

function isValidQualitySettings(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.targetAccuracy === 'number' &&
    typeof data.minimumConfidence === 'number' &&
    typeof data.enableQualityChecks === 'boolean' &&
    data.targetAccuracy >= 0 &&
    data.targetAccuracy <= 1 &&
    data.minimumConfidence >= 0 &&
    data.minimumConfidence <= 1
  )
}

function isValidMonitoring(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.enableDetailedLogging === 'boolean' &&
    typeof data.trackPerformanceMetrics === 'boolean' &&
    typeof data.saveDebugInfo === 'boolean'
  )
}

function isValidConstraints(data: any): boolean {
  if (typeof data !== 'object') return false
  
  const numericFields = ['maxProcessingTime', 'memoryLimit', 'cpuUsageLimit']
  for (const field of numericFields) {
    if (data[field] !== undefined && (typeof data[field] !== 'number' || data[field] <= 0)) {
      return false
    }
  }
  
  return true
}

function isValidRuntimeState(data: any): boolean {
  if (typeof data !== 'object') return false
  
  // Current stage validation
  if (data.currentStage !== undefined && typeof data.currentStage !== 'string') {
    return false
  }
  
  // Progress validation
  if (data.progress !== undefined && (typeof data.progress !== 'number' || data.progress < 0 || data.progress > 1)) {
    return false
  }
  
  // Estimated time validation
  if (data.estimatedTimeRemaining !== undefined && (typeof data.estimatedTimeRemaining !== 'number' || data.estimatedTimeRemaining < 0)) {
    return false
  }
  
  return true
}

function isValidEditingPreferences(data: any): boolean {
  const validEditModes = ['simple', 'advanced']
  return (
    typeof data === 'object' &&
    typeof data.autoSave === 'boolean' &&
    typeof data.showConfidenceScores === 'boolean' &&
    typeof data.highlightLowConfidence === 'boolean' &&
    typeof data.enableSpellCheck === 'boolean' &&
    validEditModes.includes(data.defaultEditMode)
  )
}

function isValidQualityValidation(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.checkTimingOverlaps === 'boolean' &&
    typeof data.validateTextLength === 'boolean' &&
    typeof data.enforceMinimumDuration === 'boolean' &&
    typeof data.flagSuspiciousContent === 'boolean'
  )
}

function isValidReviewState(data: any): boolean {
  if (typeof data !== 'object') return false
  
  // Completed segments validation
  if (data.completedSegments !== undefined && !Array.isArray(data.completedSegments)) {
    return false
  }
  
  // Flagged issues validation
  if (data.flaggedIssues !== undefined) {
    if (!Array.isArray(data.flaggedIssues)) return false
    
    const validSeverities = ['low', 'medium', 'high']
    for (const issue of data.flaggedIssues) {
      if (
        typeof issue !== 'object' ||
        typeof issue.subtitleId !== 'number' ||
        typeof issue.issue !== 'string' ||
        !validSeverities.includes(issue.severity) ||
        typeof issue.resolved !== 'boolean'
      ) {
        return false
      }
    }
  }
  
  // Progress validation
  if (data.reviewProgress !== undefined && (typeof data.reviewProgress !== 'number' || data.reviewProgress < 0 || data.reviewProgress > 1)) {
    return false
  }
  
  // Last reviewed timestamp validation
  if (data.lastReviewedAt !== undefined && (typeof data.lastReviewedAt !== 'number' || data.lastReviewedAt < 0)) {
    return false
  }
  
  return true
}

function isValidDisplayOptions(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.fontSize === 'number' &&
    typeof data.showOriginalText === 'boolean' &&
    typeof data.showTranslation === 'boolean' &&
    typeof data.showTimestamps === 'boolean' &&
    typeof data.waveformDisplay === 'boolean' &&
    data.fontSize > 0
  )
}

function isValidFormatSettings(data: any): boolean {
  const validFormats = ['srt', 'vtt', 'json', 'txt', 'ass']
  const validEncodings = ['utf8', 'utf16', 'gbk']
  
  return (
    typeof data === 'object' &&
    validFormats.includes(data.format) &&
    validEncodings.includes(data.encoding) &&
    typeof data.includeMetadata === 'boolean' &&
    typeof data.includeConfidenceScores === 'boolean'
  )
}

function isValidPostProcessing(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.removeEmptyLines === 'boolean' &&
    typeof data.normalizeWhitespace === 'boolean' &&
    typeof data.applyTextFormatting === 'boolean' &&
    typeof data.generateSummary === 'boolean'
  )
}

function isValidQualityAssurance(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.finalValidation === 'boolean' &&
    Array.isArray(data.exportChecklist) &&
    typeof data.backupOriginal === 'boolean'
  )
}

function isValidExportHistory(data: any): boolean {
  if (!Array.isArray(data)) return false
  
  for (const entry of data) {
    if (
      typeof entry !== 'object' ||
      typeof entry.filePath !== 'string' ||
      typeof entry.format !== 'string' ||
      typeof entry.timestamp !== 'number' ||
      typeof entry.fileSize !== 'number' ||
      typeof entry.success !== 'boolean' ||
      entry.timestamp < 0 ||
      entry.fileSize < 0
    ) {
      return false
    }
  }
  
  return true
}

// ============================================================================
// COMPREHENSIVE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate step configuration with detailed error reporting
 */
export function validateStepConfiguration<K extends WorkflowStepId>(
  stepId: K,
  config: any,
  workspaceId?: string
): StepConfigValidationResult<K> {
  const errors: StepConfigValidationResult<K>['errors'] = []
  const warnings: StepConfigValidationResult<K>['warnings'] = []
  const suggestions: StepConfigValidationResult<K>['suggestions'] = []

  // Basic structure validation
  if (!config) {
    errors.push({
      field: 'root' as keyof StepConfigMap[K],
      message: 'Configuration is required',
      value: config,
      severity: 'error'
    })
    
    return {
      stepId,
      isValid: false,
      errors,
      warnings,
      suggestions: [{
        field: 'root' as keyof StepConfigMap[K],
        suggestion: 'Provide a valid configuration object',
        autoApply: true
      }]
    }
  }

  if (typeof config !== 'object') {
    errors.push({
      field: 'root' as keyof StepConfigMap[K],
      message: 'Configuration must be an object',
      value: config,
      severity: 'error'
    })
    
    return {
      stepId,
      isValid: false,
      errors,
      warnings
    }
  }

  // Step ID validation
  if (!isValidWorkflowStepId(stepId)) {
    errors.push({
      field: 'stepId' as keyof StepConfigMap[K],
      message: `Invalid step ID: ${stepId}`,
      value: stepId,
      severity: 'error'
    })
  }

  // Workspace ID validation (if provided)
  if (workspaceId && !isValidWorkspaceId(workspaceId)) {
    errors.push({
      field: 'workspaceId' as keyof StepConfigMap[K],
      message: `Invalid workspace ID: ${workspaceId}`,
      value: workspaceId,
      severity: 'error'
    })
  }

  // Size validation
  const configSize = estimateConfigSize(config)
  if (configSize > WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE) {
    errors.push({
      field: 'size' as keyof StepConfigMap[K],
      message: `Configuration too large: ${configSize} bytes (max ${WORKSPACE_CONSTANTS.MAX_STEP_CONFIG_SIZE})`,
      value: configSize,
      severity: 'error'
    })
  } else if (configSize > WORKSPACE_CONSTANTS.CONFIG_SIZE_WARNING_THRESHOLD) {
    warnings.push({
      field: 'size' as keyof StepConfigMap[K],
      message: `Configuration is large: ${configSize} bytes`,
      value: configSize
    })
    
    suggestions.push({
      field: 'size' as keyof StepConfigMap[K],
      suggestion: 'Consider optimizing configuration size for better performance',
      autoApply: false
    })
  }

  // Type-specific validation
  if (!isValidStepConfig(config, stepId)) {
    errors.push({
      field: 'type' as keyof StepConfigMap[K],
      message: `Invalid configuration structure for step ${stepId}`,
      value: config,
      severity: 'error'
    })
  }

  // Schema version validation
  const expectedSchemaVersion = STEP_CONFIG_SCHEMA_VERSIONS[stepId]
  if (config.schemaVersion && config.schemaVersion !== expectedSchemaVersion) {
    warnings.push({
      field: 'schemaVersion' as keyof StepConfigMap[K],
      message: `Schema version mismatch: expected ${expectedSchemaVersion}, got ${config.schemaVersion}`,
      value: config.schemaVersion
    })
    
    suggestions.push({
      field: 'schemaVersion' as keyof StepConfigMap[K],
      suggestion: 'Update configuration to latest schema version',
      autoApply: true
    })
  }

  return {
    stepId,
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

/**
 * Batch validate multiple step configurations
 */
export function batchValidateStepConfigurations(
  workspaceId: string,
  stepConfigs: Partial<StepConfigMap>
): BatchValidationResult {
  const stepResults: Partial<Record<WorkflowStepId, StepConfigValidationResult<WorkflowStepId>>> = {}
  let totalErrors = 0
  let totalWarnings = 0
  const criticalErrors: WorkflowStepId[] = []

  // Validate each step configuration
  for (const [stepId, config] of Object.entries(stepConfigs) as Array<[WorkflowStepId, any]>) {
    const result = validateStepConfiguration(stepId, config, workspaceId)
    stepResults[stepId] = result
    
    totalErrors += result.errors.length
    totalWarnings += result.warnings.length
    
    // Check for critical errors
    const hasCriticalError = result.errors.some(error => error.severity === 'error')
    if (hasCriticalError) {
      criticalErrors.push(stepId)
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

// ============================================================================
// MIGRATION VALIDATION
// ============================================================================

/**
 * Validate configuration during migration
 */
export function validateMigrationData(
  legacyConfig: any,
  stepConfigs: Partial<StepConfigMap>,
  workspaceId: string
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
  migrationIssues: Array<{
    stepId: WorkflowStepId
    issue: string
    severity: 'low' | 'medium' | 'high'
    autoFixable: boolean
  }>
} {
  const errors: string[] = []
  const warnings: string[] = []
  const migrationIssues: Array<{
    stepId: WorkflowStepId
    issue: string
    severity: 'low' | 'medium' | 'high'
    autoFixable: boolean
  }> = []

  // Validate workspace ID
  if (!isValidWorkspaceId(workspaceId)) {
    errors.push(`Invalid workspace ID: ${workspaceId}`)
  }

  // Validate legacy configuration structure
  if (!legacyConfig || typeof legacyConfig !== 'object') {
    errors.push('Legacy configuration is invalid or missing')
    return { isValid: false, errors, warnings, migrationIssues }
  }

  // Validate step configurations
  const batchResult = batchValidateStepConfigurations(workspaceId, stepConfigs)
  errors.push(...batchResult.stepResults['input-file']?.errors.map(e => e.message) || [])
  warnings.push(...batchResult.stepResults['input-file']?.warnings.map(w => w.message) || [])

  // Check for migration-specific issues
  for (const [stepId, config] of Object.entries(stepConfigs) as Array<[WorkflowStepId, any]>) {
    // Check for missing required fields
    if (!config) {
      migrationIssues.push({
        stepId,
        issue: `Missing configuration for step ${stepId}`,
        severity: 'high',
        autoFixable: true
      })
    }

    // Check for data loss during migration
    const configSize = estimateConfigSize(config)
    const legacySize = estimateConfigSize(legacyConfig)
    
    if (configSize < legacySize * 0.5) {
      migrationIssues.push({
        stepId,
        issue: `Potential data loss detected (${configSize} < ${legacySize * 0.5} bytes)`,
        severity: 'medium',
        autoFixable: false
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    migrationIssues
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if configuration has potential security issues
 */
export function validateConfigurationSecurity(config: any): {
  isSecure: boolean
  securityIssues: Array<{
    field: string
    issue: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
  }>
} {
  const securityIssues: Array<{
    field: string
    issue: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
  }> = []

  // Check for sensitive data in configuration
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'apiKey']
  const configStr = JSON.stringify(config).toLowerCase()
  
  for (const field of sensitiveFields) {
    if (configStr.includes(field)) {
      securityIssues.push({
        field,
        issue: `Potential sensitive data detected: ${field}`,
        severity: 'high',
        recommendation: 'Store sensitive data in secure environment variables'
      })
    }
  }

  // Check for file paths that could be security risks
  if (config.ffmpegPath && typeof config.ffmpegPath === 'string') {
    const path = config.ffmpegPath.toLowerCase()
    if (path.includes('..') || path.includes('system32') || path.includes('/usr/bin')) {
      securityIssues.push({
        field: 'ffmpegPath',
        issue: 'Potentially unsafe file path detected',
        severity: 'medium',
        recommendation: 'Use relative paths or validate file paths'
      })
    }
  }

  // Check for XSS risks in string fields
  const stringFields = Object.entries(config).filter(([_, value]) => typeof value === 'string')
  for (const [field, value] of stringFields) {
    if (typeof value === 'string' && (value.includes('<script') || value.includes('javascript:'))) {
      securityIssues.push({
        field,
        issue: 'Potential XSS risk in string field',
        severity: 'critical',
        recommendation: 'Sanitize user input and validate string content'
      })
    }
  }

  return {
    isSecure: securityIssues.length === 0,
    securityIssues
  }
}

/**
 * Validate configuration performance impact
 */
export function validateConfigurationPerformance(config: any): {
  performanceScore: number // 0-100
  performanceIssues: Array<{
    issue: string
    impact: 'low' | 'medium' | 'high'
    recommendation: string
  }>
} {
  const performanceIssues: Array<{
    issue: string
    impact: 'low' | 'medium' | 'high'
    recommendation: string
  }> = []
  
  let performanceScore = 100

  // Check configuration size
  const configSize = estimateConfigSize(config)
  if (configSize > WORKSPACE_CONSTANTS.CONFIG_SIZE_WARNING_THRESHOLD) {
    performanceScore -= 20
    performanceIssues.push({
      issue: `Large configuration size: ${configSize} bytes`,
      impact: 'medium',
      recommendation: 'Consider breaking down large configurations'
    })
  }

  // Check for complex nested objects
  const maxDepth = getObjectDepth(config)
  if (maxDepth > 5) {
    performanceScore -= 15
    performanceIssues.push({
      issue: `Deep object nesting: ${maxDepth} levels`,
      impact: 'medium',
      recommendation: 'Flatten configuration structure'
    })
  }

  // Check for large arrays
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value) && value.length > 1000) {
      performanceScore -= 25
      performanceIssues.push({
        issue: `Large array in ${key}: ${value.length} items`,
        impact: 'high',
        recommendation: 'Consider pagination or lazy loading for large datasets'
      })
    }
  }

  return {
    performanceScore: Math.max(0, performanceScore),
    performanceIssues
  }
}

/**
 * Get maximum depth of nested object
 */
function getObjectDepth(obj: any): number {
  if (typeof obj !== 'object' || obj === null) {
    return 0
  }
  
  let maxDepth = 0
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      maxDepth = Math.max(maxDepth, getObjectDepth(value))
    }
  }
  
  return 1 + maxDepth
}

/**
 * Create detailed validation report
 */
export function createValidationReport(
  stepId: WorkflowStepId,
  config: any,
  workspaceId?: string
): {
  validation: StepConfigValidationResult<typeof stepId>
  security: ReturnType<typeof validateConfigurationSecurity>
  performance: ReturnType<typeof validateConfigurationPerformance>
  summary: {
    overallStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    criticalIssues: number
    recommendations: string[]
  }
} {
  const validation = validateStepConfiguration(stepId, config, workspaceId)
  const security = validateConfigurationSecurity(config)
  const performance = validateConfigurationPerformance(config)
  
  // Calculate overall status
  const criticalIssues = validation.errors.filter(e => e.severity === 'error').length +
                        security.securityIssues.filter(i => i.severity === 'critical').length
  
  let overallStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  if (criticalIssues > 0) {
    overallStatus = 'critical'
  } else if (validation.errors.length > 0 || security.securityIssues.length > 0) {
    overallStatus = 'poor'
  } else if (validation.warnings.length > 2 || performance.performanceScore < 60) {
    overallStatus = 'fair'
  } else if (validation.warnings.length > 0 || performance.performanceScore < 80) {
    overallStatus = 'good'
  } else {
    overallStatus = 'excellent'
  }
  
  // Generate recommendations
  const recommendations: string[] = []
  recommendations.push(...validation.suggestions?.map(s => s.suggestion) || [])
  recommendations.push(...security.securityIssues.map(i => i.recommendation))
  recommendations.push(...performance.performanceIssues.map(i => i.recommendation))
  
  return {
    validation,
    security,
    performance,
    summary: {
      overallStatus,
      criticalIssues,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    }
  }
}