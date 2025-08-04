/**
 * Modern ID generation utilities
 * Replaces deprecated Math.random().toString(36).substr() patterns with modern alternatives
 */

/**
 * Generate a unique session ID using modern crypto.randomUUID()
 * More secure and with better uniqueness guarantees than Math.random()
 */
export function generateSessionId(length: number = 8): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, length)
  }
  
  // Fallback for environments without crypto.randomUUID
  return Math.random().toString(36).slice(2, 2 + length)
}

/**
 * Generate workspace ID with timestamp prefix for better uniqueness
 */
export function generateWorkspaceId(): string {
  return `workspace-${Date.now()}-${generateSessionId(9)}`
}

/**
 * Generate export ID with timestamp prefix
 */
export function generateExportId(): string {
  return `export_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate debug ID with timestamp prefix
 */
export function generateDebugId(): string {
  return `debug_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate worker ID with timestamp prefix
 */
export function generateWorkerId(): string {
  return `worker_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate coordinator ID with timestamp prefix
 */
export function generateCoordinatorId(): string {
  return `coord_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate operation ID for performance monitoring
 */
export function generateOperationId(operation: string, tableName?: string): string {
  const timestamp = Date.now()
  const sessionId = generateSessionId(5)
  
  if (tableName) {
    return `${operation}-${tableName}-${timestamp}-${sessionId}`
  }
  
  return `${operation}-${timestamp}-${sessionId}`
}

/**
 * Generate alert ID for performance monitoring
 */
export function generateAlertId(): string {
  return `alert_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate group ID for workspace grouping
 */
export function generateGroupId(): string {
  return `group-${Date.now()}-${generateSessionId(9)}`
}

/**
 * Generate error ID for error tracking
 */
export function generateErrorId(): string {
  return `workspace-error-${Date.now()}-${generateSessionId(9)}`
}

/**
 * Generate content ID for temporary content
 */
export function generateContentId(): string {
  return `temp-${Date.now()}-${generateSessionId(9)}`
}

/**
 * Generate legacy ID for backwards compatibility
 */
export function generateLegacyId(): string {
  return `legacy_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate raw process ID
 */
export function generateRawId(): string {
  return `raw_${Date.now()}_${generateSessionId(9)}`
}

/**
 * Generate test workspace ID
 */
export function generateTestWorkspaceId(): string {
  return `test-workspace-${Date.now()}-${generateSessionId(9)}`
}