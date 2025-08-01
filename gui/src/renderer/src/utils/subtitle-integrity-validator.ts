/**
 * Subtitle Data Integrity Validator
 * 
 * Comprehensive validation utilities for subtitle temporary storage with advanced
 * hash validation, data integrity checks, and corruption detection mechanisms.
 */

import type { SubtitleData } from '../../../types'
import type {
  SubtitleTempContent,
  SubtitleTempMetadata,
  SubtitleTempStorageRecord,
  SubtitleValidationWarning,
  SubtitleValidationError,
  SubtitleTempError
} from '../types/subtitle-temp-storage'
import {
  generateTempStorageId,
  calculateContentHash,
  estimateStorageSize
} from '../types/subtitle-temp-storage'

// ============================================================================
// HASH VALIDATION UTILITIES
// ============================================================================

/**
 * Advanced hash calculation using SHA-256 equivalent
 */
export class HashValidator {
  /**
   * Calculate SHA-256-like hash for content integrity
   */
  static async calculateSecureHash(data: any): Promise<string> {
    const jsonString = JSON.stringify(data, Object.keys(data).sort())
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder()
        const dataBuffer = encoder.encode(jsonString)
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch (error) {
        console.warn('WebCrypto API unavailable, falling back to simple hash')
      }
    }
    
    // Fallback to improved simple hash
    return this.calculateImprovedSimpleHash(jsonString)
  }

  /**
   * Calculate improved simple hash for fallback scenarios
   */
  static calculateImprovedSimpleHash(input: string): string {
    let hash = 0x811c9dc5 // FNV-1a initial value
    
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = (hash * 0x01000193) >>> 0 // FNV-1a prime, ensure 32-bit
    }
    
    return hash.toString(16).padStart(8, '0')
  }

  /**
   * Verify hash integrity
   */
  static async verifyHash(data: any, expectedHash: string): Promise<{
    isValid: boolean
    actualHash: string
    hashMethod: 'secure' | 'simple'
  }> {
    const actualHash = await this.calculateSecureHash(data)
    const isSecure = actualHash.length > 8
    
    return {
      isValid: actualHash === expectedHash,
      actualHash,
      hashMethod: isSecure ? 'secure' : 'simple'
    }
  }

  /**
   * Calculate content fingerprint for duplicate detection
   */
  static calculateContentFingerprint(subtitles: SubtitleData[]): string {
    const fingerprint = subtitles.map(s => ({
      text: s.text?.substring(0, 50) || '',
      startTime: Math.round(s.startTime * 1000) / 1000,
      endTime: Math.round(s.endTime * 1000) / 1000
    }))
    
    return this.calculateImprovedSimpleHash(JSON.stringify(fingerprint))
  }
}

// ============================================================================
// DATA INTEGRITY VALIDATOR
// ============================================================================

export class DataIntegrityValidator {
  /**
   * Comprehensive data integrity validation
   */
  static async validateIntegrity(
    record: SubtitleTempStorageRecord,
    content?: SubtitleTempContent
  ): Promise<{
    isValid: boolean
    integrityScore: number
    issues: IntegrityIssue[]
    recommendations: string[]
  }> {
    const issues: IntegrityIssue[] = []
    const recommendations: string[] = []
    let score = 1.0

    try {
      // 1. Validate record structure
      const structureValidation = this.validateRecordStructure(record)
      if (!structureValidation.isValid) {
        issues.push(...structureValidation.issues)
        score -= 0.3
      }

      // 2. Validate hash integrity
      if (content) {
        const hashValidation = await this.validateHashIntegrity(record, content)
        if (!hashValidation.isValid) {
          issues.push(...hashValidation.issues)
          score -= 0.4
        }
      }

      // 3. Validate metadata consistency
      const metadataValidation = this.validateMetadataConsistency(record)
      if (!metadataValidation.isValid) {
        issues.push(...metadataValidation.issues)
        score -= 0.2
      }

      // 4. Validate content if provided
      if (content) {
        const contentValidation = await this.validateContentIntegrity(content)
        if (!contentValidation.isValid) {
          issues.push(...contentValidation.issues)
          score -= 0.1
        }
      }

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(issues))

      return {
        isValid: score > 0.7,
        integrityScore: Math.max(0, score),
        issues,
        recommendations
      }

    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'critical',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        field: 'validation',
        recoverable: false
      })

      return {
        isValid: false,
        integrityScore: 0,
        issues,
        recommendations: ['Re-validate data', 'Check for corruption', 'Restore from backup']
      }
    }
  }

  /**
   * Validate record structure
   */
  private static validateRecordStructure(record: SubtitleTempStorageRecord): {
    isValid: boolean
    issues: IntegrityIssue[]
  } {
    const issues: IntegrityIssue[] = []

    // Required fields validation
    const requiredFields = ['id', 'workspaceId', 'sessionId', 'storageType', 'contentData', 'contentHash']
    for (const field of requiredFields) {
      if (!record[field as keyof SubtitleTempStorageRecord]) {
        issues.push({
          type: 'missing_field',
          severity: 'critical',
          message: `Missing required field: ${field}`,
          field,
          recoverable: false
        })
      }
    }

    // Data type validation
    if (typeof record.createdAt !== 'number' || record.createdAt <= 0) {
      issues.push({
        type: 'invalid_type',
        severity: 'medium',
        message: 'Invalid createdAt timestamp',
        field: 'createdAt',
        recoverable: true
      })
    }

    if (typeof record.dataSize !== 'number' || record.dataSize < 0) {
      issues.push({
        type: 'invalid_type',
        severity: 'medium',
        message: 'Invalid dataSize value',
        field: 'dataSize',
        recoverable: true
      })
    }

    // Storage type validation
    const validStorageTypes = ['original', 'modified', 'session_backup', 'auto_save']
    if (!validStorageTypes.includes(record.storageType)) {
      issues.push({
        type: 'invalid_value',
        severity: 'medium',
        message: `Invalid storage type: ${record.storageType}`,
        field: 'storageType',
        recoverable: true
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      issues
    }
  }

  /**
   * Validate hash integrity
   */
  private static async validateHashIntegrity(
    record: SubtitleTempStorageRecord,
    content: SubtitleTempContent
  ): Promise<{
    isValid: boolean
    issues: IntegrityIssue[]
  }> {
    const issues: IntegrityIssue[] = []

    try {
      // Validate content hash
      const contentHashValidation = await HashValidator.verifyHash(content, record.contentHash)
      if (!contentHashValidation.isValid) {
        issues.push({
          type: 'hash_mismatch',
          severity: 'critical',
          message: `Content hash mismatch. Expected: ${record.contentHash}, Actual: ${contentHashValidation.actualHash}`,
          field: 'contentHash',
          recoverable: false,
          context: {
            expectedHash: record.contentHash,
            actualHash: contentHashValidation.actualHash,
            hashMethod: contentHashValidation.hashMethod
          }
        })
      }

      // Validate metadata hash if present
      if (record.metadataHash) {
        const metadataContent = {
          workspaceId: record.workspaceId,
          sessionId: record.sessionId,
          storageType: record.storageType,
          contentHash: record.contentHash
        }
        
        const metadataHashValidation = await HashValidator.verifyHash(metadataContent, record.metadataHash)
        if (!metadataHashValidation.isValid) {
          issues.push({
            type: 'hash_mismatch',
            severity: 'medium',
            message: `Metadata hash mismatch. Expected: ${record.metadataHash}, Actual: ${metadataHashValidation.actualHash}`,
            field: 'metadataHash',
            recoverable: true,
            context: {
              expectedHash: record.metadataHash,
              actualHash: metadataHashValidation.actualHash
            }
          })
        }
      }

    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'critical',
        message: `Hash validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        field: 'hash_validation',
        recoverable: false
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      issues
    }
  }

  /**
   * Validate metadata consistency
   */
  private static validateMetadataConsistency(record: SubtitleTempStorageRecord): {
    isValid: boolean
    issues: IntegrityIssue[]
  } {
    const issues: IntegrityIssue[] = []

    // Validate timestamps
    if (record.lastModified < record.createdAt) {
      issues.push({
        type: 'timestamp_inconsistency',
        severity: 'medium',
        message: 'lastModified is earlier than createdAt',
        field: 'timestamps',
        recoverable: true,
        context: {
          createdAt: record.createdAt,
          lastModified: record.lastModified
        }
      })
    }

    // Validate data size consistency
    try {
      const actualSize = new Blob([record.contentData]).size
      const sizeDifference = Math.abs(actualSize - record.dataSize) / record.dataSize
      
      if (sizeDifference > 0.1) { // Allow 10% variance
        issues.push({
          type: 'size_mismatch',
          severity: 'low',
          message: `Data size mismatch. Recorded: ${record.dataSize}, Actual: ${actualSize}`,
          field: 'dataSize',
          recoverable: true,
          context: {
            recordedSize: record.dataSize,
            actualSize: actualSize,
            difference: sizeDifference
          }
        })
      }
    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'low',
        message: 'Could not validate data size consistency',
        field: 'dataSize',
        recoverable: true
      })
    }

    // Validate backup chain consistency
    if (record.parentId && record.generationLevel <= 0) {
      issues.push({
        type: 'backup_chain_inconsistency',
        severity: 'low',
        message: 'Record has parent but invalid generation level',
        field: 'generationLevel',
        recoverable: true
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      issues
    }
  }

  /**
   * Validate content integrity
   */
  private static async validateContentIntegrity(content: SubtitleTempContent): Promise<{
    isValid: boolean
    issues: IntegrityIssue[]
  }> {
    const issues: IntegrityIssue[] = []

    try {
      // Validate subtitles array
      if (!Array.isArray(content.subtitles)) {
        issues.push({
          type: 'invalid_structure',
          severity: 'critical',
          message: 'Subtitles is not an array',
          field: 'subtitles',
          recoverable: false
        })
        return { isValid: false, issues }
      }

      // Validate individual subtitles
      const subtitleIssues = await this.validateSubtitlesArray(content.subtitles)
      issues.push(...subtitleIssues)

      // Validate statistics consistency
      const statsIssues = this.validateStatisticsConsistency(content)
      issues.push(...statsIssues)

      // Validate change tracking
      const changeTrackingIssues = this.validateChangeTracking(content)
      issues.push(...changeTrackingIssues)

    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'critical',
        message: `Content validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        field: 'content_validation',
        recoverable: false
      })
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      issues
    }
  }

  /**
   * Validate subtitles array
   */
  private static async validateSubtitlesArray(subtitles: SubtitleData[]): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = []

    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i]

      // Required fields
      if (typeof subtitle.id !== 'number') {
        issues.push({
          type: 'invalid_type',
          severity: 'critical',
          message: `Subtitle ${i} has invalid ID type`,
          field: `subtitles[${i}].id`,
          recoverable: false,
          context: { subtitleIndex: i, id: subtitle.id }
        })
      }

      // Timing validation
      if (typeof subtitle.startTime !== 'number' || typeof subtitle.endTime !== 'number') {
        issues.push({
          type: 'invalid_type',
          severity: 'critical',
          message: `Subtitle ${i} has invalid timing types`,
          field: `subtitles[${i}].timing`,
          recoverable: false,
          context: { subtitleIndex: i, startTime: subtitle.startTime, endTime: subtitle.endTime }
        })
      } else if (subtitle.startTime >= subtitle.endTime) {
        issues.push({
          type: 'invalid_timing',
          severity: 'medium',
          message: `Subtitle ${i} has invalid timing order`,
          field: `subtitles[${i}].timing`,
          recoverable: true,
          context: { subtitleIndex: i, startTime: subtitle.startTime, endTime: subtitle.endTime }
        })
      } else if (subtitle.startTime < 0 || subtitle.endTime < 0) {
        issues.push({
          type: 'invalid_timing',
          severity: 'medium',
          message: `Subtitle ${i} has negative timing`,
          field: `subtitles[${i}].timing`,
          recoverable: true,
          context: { subtitleIndex: i, startTime: subtitle.startTime, endTime: subtitle.endTime }
        })
      }

      // Text validation
      if (typeof subtitle.text !== 'string') {
        issues.push({
          type: 'invalid_type',
          severity: 'medium',
          message: `Subtitle ${i} has invalid text type`,
          field: `subtitles[${i}].text`,
          recoverable: true,
          context: { subtitleIndex: i, text: subtitle.text }
        })
      }

      // Confidence validation
      if (subtitle.confidence !== undefined) {
        if (typeof subtitle.confidence !== 'number' || subtitle.confidence < 0 || subtitle.confidence > 1) {
          issues.push({
            type: 'invalid_value',
            severity: 'low',
            message: `Subtitle ${i} has invalid confidence value`,
            field: `subtitles[${i}].confidence`,
            recoverable: true,
            context: { subtitleIndex: i, confidence: subtitle.confidence }
          })
        }
      }

      // Overlap detection with next subtitle
      if (i < subtitles.length - 1) {
        const nextSubtitle = subtitles[i + 1]
        if (subtitle.endTime > nextSubtitle.startTime) {
          issues.push({
            type: 'timing_overlap',
            severity: 'low',
            message: `Subtitle ${i} overlaps with subtitle ${i + 1}`,
            field: `subtitles[${i}].timing`,
            recoverable: true,
            context: {
              subtitleIndex: i,
              nextSubtitleIndex: i + 1,
              overlap: subtitle.endTime - nextSubtitle.startTime
            }
          })
        }
      }
    }

    return issues
  }

  /**
   * Validate statistics consistency
   */
  private static validateStatisticsConsistency(content: SubtitleTempContent): IntegrityIssue[] {
    const issues: IntegrityIssue[] = []

    try {
      const stats = content.statistics
      const subtitles = content.subtitles

      // Validate total count
      if (stats.totalCount !== subtitles.length) {
        issues.push({
          type: 'statistics_mismatch',
          severity: 'low',
          message: `Statistics totalCount mismatch. Expected: ${subtitles.length}, Actual: ${stats.totalCount}`,
          field: 'statistics.totalCount',
          recoverable: true,
          context: {
            expected: subtitles.length,
            actual: stats.totalCount
          }
        })
      }

      // Validate quality metrics sum
      const qualitySum = stats.qualityMetrics.highConfidenceCount + 
                        stats.qualityMetrics.mediumConfidenceCount + 
                        stats.qualityMetrics.lowConfidenceCount
      
      const subtitlesWithConfidence = subtitles.filter(s => typeof s.confidence === 'number').length
      
      if (Math.abs(qualitySum - subtitlesWithConfidence) > 1) { // Allow small variance
        issues.push({
          type: 'statistics_mismatch',
          severity: 'low',
          message: `Quality metrics sum mismatch. Expected: ${subtitlesWithConfidence}, Actual: ${qualitySum}`,
          field: 'statistics.qualityMetrics',
          recoverable: true,
          context: {
            expected: subtitlesWithConfidence,
            actual: qualitySum
          }
        })
      }

    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'low',
        message: 'Could not validate statistics consistency',
        field: 'statistics',
        recoverable: true
      })
    }

    return issues
  }

  /**
   * Validate change tracking
   */
  private static validateChangeTracking(content: SubtitleTempContent): IntegrityIssue[] {
    const issues: IntegrityIssue[] = []

    try {
      const changeTracking = content.changeTracking

      // Validate change count
      if (changeTracking.changeCount < 0) {
        issues.push({
          type: 'invalid_value',
          severity: 'low',
          message: 'Change count cannot be negative',
          field: 'changeTracking.changeCount',
          recoverable: true,
          context: { changeCount: changeTracking.changeCount }
        })
      }

      // Validate modified IDs exist
      if (changeTracking.modifiedIds && changeTracking.modifiedIds.size > 0) {
        const subtitleIds = new Set(content.subtitles.map(s => s.id))
        const invalidIds = Array.from(changeTracking.modifiedIds).filter(id => !subtitleIds.has(id))
        
        if (invalidIds.length > 0) {
          issues.push({
            type: 'invalid_reference',
            severity: 'low',
            message: `Modified IDs reference non-existent subtitles: ${invalidIds.join(', ')}`,
            field: 'changeTracking.modifiedIds',
            recoverable: true,
            context: { invalidIds }
          })
        }
      }

      // Validate change severity
      const validSeverities = ['minor', 'moderate', 'major']
      if (!validSeverities.includes(changeTracking.changeSeverity)) {
        issues.push({
          type: 'invalid_value',
          severity: 'low',
          message: `Invalid change severity: ${changeTracking.changeSeverity}`,
          field: 'changeTracking.changeSeverity',
          recoverable: true,
          context: { changeSeverity: changeTracking.changeSeverity }
        })
      }

    } catch (error) {
      issues.push({
        type: 'validation_error',
        severity: 'low',
        message: 'Could not validate change tracking',
        field: 'changeTracking',
        recoverable: true
      })
    }

    return issues
  }

  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = []
    const issueTypes = new Set(issues.map(i => i.type))

    if (issueTypes.has('hash_mismatch')) {
      recommendations.push('Verify data integrity and consider restoring from backup')
      recommendations.push('Check for data corruption during storage or transmission')
    }

    if (issueTypes.has('invalid_timing')) {
      recommendations.push('Review and correct subtitle timings')
      recommendations.push('Run timing validation and auto-fix where possible')
    }

    if (issueTypes.has('statistics_mismatch')) {
      recommendations.push('Recalculate statistics from subtitle data')
      recommendations.push('Update statistics after content modifications')
    }

    if (issueTypes.has('missing_field')) {
      recommendations.push('Restore missing required fields from backup or re-create')
      recommendations.push('Verify data completeness before saving')
    }

    if (issueTypes.has('timing_overlap')) {
      recommendations.push('Resolve timing overlaps between subtitles')
      recommendations.push('Consider automatic timing adjustment')
    }

    if (recommendations.length === 0) {
      recommendations.push('Data integrity appears good')
      recommendations.push('Continue regular validation and backups')
    }

    return recommendations
  }
}

// ============================================================================
// CORRUPTION DETECTION AND REPAIR
// ============================================================================

export class CorruptionDetector {
  /**
   * Detect potential data corruption
   */
  static async detectCorruption(
    record: SubtitleTempStorageRecord,
    content?: SubtitleTempContent
  ): Promise<{
    isCorrupted: boolean
    corruptionLevel: 'none' | 'minor' | 'moderate' | 'severe'
    corruptionSigns: CorruptionSign[]
    repairPossible: boolean
  }> {
    const corruptionSigns: CorruptionSign[] = []
    let corruptionLevel: 'none' | 'minor' | 'moderate' | 'severe' = 'none'

    try {
      // Check for JSON parsing errors
      if (content) {
        try {
          JSON.parse(JSON.stringify(content))
        } catch (error) {
          corruptionSigns.push({
            type: 'json_corruption',
            severity: 'severe',
            description: 'Content cannot be serialized to JSON',
            location: 'content_structure'
          })
        }
      }

      // Check for content data parsing
      try {
        const parsedContent = JSON.parse(record.contentData)
        if (!parsedContent || typeof parsedContent !== 'object') {
          corruptionSigns.push({
            type: 'content_corruption',
            severity: 'severe',
            description: 'Content data is not a valid object',
            location: 'contentData'
          })
        }
      } catch (error) {
        corruptionSigns.push({
          type: 'json_corruption',
          severity: 'severe',
          description: 'Content data cannot be parsed as JSON',
          location: 'contentData'
        })
      }

      // Check for null bytes or invalid characters
      const nullBytePattern = /\0/g
      if (nullBytePattern.test(record.contentData)) {
        corruptionSigns.push({
          type: 'character_corruption',
          severity: 'moderate',
          description: 'Content contains null bytes',
          location: 'contentData'
        })
      }

      // Check for truncation signs
      if (record.contentData.length < 10) {
        corruptionSigns.push({
          type: 'truncation',
          severity: 'severe',
          description: 'Content data appears truncated',
          location: 'contentData'
        })
      }

      // Check for size inconsistencies
      const actualSize = new Blob([record.contentData]).size
      const sizeDifference = Math.abs(actualSize - record.dataSize) / Math.max(record.dataSize, 1)
      
      if (sizeDifference > 0.5) {
        corruptionSigns.push({
          type: 'size_corruption',
          severity: 'moderate',
          description: `Significant size mismatch: ${sizeDifference * 100}%`,
          location: 'dataSize'
        })
      }

      // Check for timestamp corruption
      if (record.createdAt > Date.now() + 86400000) { // Future date beyond 1 day
        corruptionSigns.push({
          type: 'timestamp_corruption',
          severity: 'minor',
          description: 'Created timestamp is in the future',
          location: 'createdAt'
        })
      }

      if (record.createdAt < 946684800000) { // Before year 2000
        corruptionSigns.push({
          type: 'timestamp_corruption',
          severity: 'minor',
          description: 'Created timestamp is unreasonably old',
          location: 'createdAt'
        })
      }

      // Determine corruption level
      const severeCases = corruptionSigns.filter(s => s.severity === 'severe').length
      const moderateCases = corruptionSigns.filter(s => s.severity === 'moderate').length
      const minorCases = corruptionSigns.filter(s => s.severity === 'minor').length

      if (severeCases > 0) {
        corruptionLevel = 'severe'
      } else if (moderateCases > 1) {
        corruptionLevel = 'severe'
      } else if (moderateCases > 0) {
        corruptionLevel = 'moderate'
      } else if (minorCases > 2) {
        corruptionLevel = 'moderate'
      } else if (minorCases > 0) {
        corruptionLevel = 'minor'
      }

      // Determine if repair is possible
      const repairPossible = corruptionLevel !== 'severe' && 
                           !corruptionSigns.some(s => s.type === 'json_corruption' || s.type === 'truncation')

      return {
        isCorrupted: corruptionLevel !== 'none',
        corruptionLevel,
        corruptionSigns,
        repairPossible
      }

    } catch (error) {
      return {
        isCorrupted: true,
        corruptionLevel: 'severe',
        corruptionSigns: [{
          type: 'validation_error',
          severity: 'severe',
          description: `Corruption detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: 'detection_process'
        }],
        repairPossible: false
      }
    }
  }

  /**
   * Attempt to repair corrupted data
   */
  static async attemptRepair(
    record: SubtitleTempStorageRecord,
    corruptionSigns: CorruptionSign[]
  ): Promise<{
    repairSuccessful: boolean
    repairedRecord?: SubtitleTempStorageRecord
    repairActions: string[]
    remainingIssues: CorruptionSign[]
  }> {
    const repairActions: string[] = []
    const remainingIssues: CorruptionSign[] = []
    let repairedRecord = { ...record }

    try {
      // Repair timestamp issues
      const timestampIssues = corruptionSigns.filter(s => s.type === 'timestamp_corruption')
      for (const issue of timestampIssues) {
        if (issue.location === 'createdAt' && repairedRecord.createdAt > Date.now()) {
          repairedRecord.createdAt = Date.now() - 86400000 // Set to 1 day ago
          repairActions.push('Fixed future creation timestamp')
        } else if (issue.location === 'createdAt' && repairedRecord.createdAt < 946684800000) {
          repairedRecord.createdAt = 946684800000 // Set to year 2000
          repairActions.push('Fixed unreasonably old timestamp')
        }
      }

      // Repair size issues
      const sizeIssues = corruptionSigns.filter(s => s.type === 'size_corruption')
      if (sizeIssues.length > 0) {
        const actualSize = new Blob([repairedRecord.contentData]).size
        repairedRecord.dataSize = actualSize
        repairActions.push('Corrected data size to match actual content size')
      }

      // Repair character corruption (remove null bytes)
      const characterIssues = corruptionSigns.filter(s => s.type === 'character_corruption')
      if (characterIssues.length > 0) {
        repairedRecord.contentData = repairedRecord.contentData.replace(/\0/g, '')
        repairActions.push('Removed null bytes from content data')
      }

      // Check which issues remain
      for (const sign of corruptionSigns) {
        if (!['timestamp_corruption', 'size_corruption', 'character_corruption'].includes(sign.type)) {
          remainingIssues.push(sign)
        }
      }

      // Recalculate hashes after repairs
      if (repairActions.length > 0) {
        try {
          const contentObject = JSON.parse(repairedRecord.contentData)
          repairedRecord.contentHash = await HashValidator.calculateSecureHash(contentObject)
          
          const metadataContent = {
            workspaceId: repairedRecord.workspaceId,
            sessionId: repairedRecord.sessionId,
            storageType: repairedRecord.storageType,
            contentHash: repairedRecord.contentHash
          }
          repairedRecord.metadataHash = await HashValidator.calculateSecureHash(metadataContent)
          
          repairActions.push('Recalculated content and metadata hashes')
        } catch (error) {
          remainingIssues.push({
            type: 'hash_calculation_error',
            severity: 'moderate',
            description: 'Could not recalculate hashes after repair',
            location: 'hash_calculation'
          })
        }
      }

      return {
        repairSuccessful: remainingIssues.filter(i => i.severity === 'severe').length === 0,
        repairedRecord: repairActions.length > 0 ? repairedRecord : undefined,
        repairActions,
        remainingIssues
      }

    } catch (error) {
      return {
        repairSuccessful: false,
        repairActions,
        remainingIssues: [
          ...remainingIssues,
          {
            type: 'repair_error',
            severity: 'severe',
            description: `Repair process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: 'repair_process'
          }
        ]
      }
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IntegrityIssue {
  type: 'missing_field' | 'invalid_type' | 'invalid_value' | 'hash_mismatch' | 'timestamp_inconsistency' | 
        'size_mismatch' | 'backup_chain_inconsistency' | 'invalid_structure' | 'invalid_timing' | 
        'statistics_mismatch' | 'invalid_reference' | 'timing_overlap' | 'validation_error'
  severity: 'low' | 'medium' | 'critical'
  message: string
  field: string
  recoverable: boolean
  context?: any
}

export interface CorruptionSign {
  type: 'json_corruption' | 'content_corruption' | 'character_corruption' | 'truncation' | 
        'size_corruption' | 'timestamp_corruption' | 'validation_error' | 'hash_calculation_error' | 'repair_error'
  severity: 'minor' | 'moderate' | 'severe'
  description: string
  location: string
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create integrity validation error
 */
export function createIntegrityError(
  code: SubtitleTempError['code'],
  message: string,
  issues: IntegrityIssue[],
  workspaceId?: string,
  sessionId?: string,
  storageId?: string
): SubtitleTempError {
  return {
    code,
    message,
    workspaceId,
    sessionId,
    storageId,
    context: { issues },
    timestamp: Date.now(),
    severity: issues.some(i => i.severity === 'critical') ? 'critical' : 'medium',
    recoverySuggestions: [
      'Run data integrity validation',
      'Check for data corruption',
      'Restore from backup if available',
      'Re-import original data'
    ]
  }
}

/**
 * Check if validation is required based on configuration
 */
export function shouldValidateIntegrity(
  lastValidated: number,
  validationInterval: number = 3600000 // 1 hour default
): boolean {
  return Date.now() - lastValidated > validationInterval
}

/**
 * Generate integrity report
 */
export function generateIntegrityReport(
  validationResults: {
    isValid: boolean
    integrityScore: number
    issues: IntegrityIssue[]
    recommendations: string[]
  }[]
): {
  overallIntegrity: number
  criticalIssues: number
  mediumIssues: number
  lowIssues: number
  commonIssues: string[]
  overallRecommendations: string[]
} {
  const allIssues = validationResults.flatMap(r => r.issues)
  const criticalIssues = allIssues.filter(i => i.severity === 'critical').length
  const mediumIssues = allIssues.filter(i => i.severity === 'medium').length
  const lowIssues = allIssues.filter(i => i.severity === 'low').length
  
  const overallIntegrity = validationResults.length > 0 ? 
    validationResults.reduce((sum, r) => sum + r.integrityScore, 0) / validationResults.length : 0
  
  // Find common issue types
  const issueTypeCounts = new Map<string, number>()
  allIssues.forEach(issue => {
    issueTypeCounts.set(issue.type, (issueTypeCounts.get(issue.type) || 0) + 1)
  })
  
  const commonIssues = Array.from(issueTypeCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type]) => type)
  
  // Aggregate recommendations
  const allRecommendations = validationResults.flatMap(r => r.recommendations)
  const uniqueRecommendations = Array.from(new Set(allRecommendations))
  
  return {
    overallIntegrity,
    criticalIssues,
    mediumIssues,
    lowIssues,
    commonIssues,
    overallRecommendations: uniqueRecommendations
  }
}