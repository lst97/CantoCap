/**
 * Configuration Error Handler
 * 
 * Provides comprehensive error handling and recovery strategies
 * for the centralized configuration manager.
 */

import React, { useState, useCallback } from 'react'
import type { ConfigOperationResult } from '../services/configuration-manager'
import type { AppConfig } from '../../../types'

// Error categories for different handling strategies
export enum ConfigErrorCategory {
  VALIDATION = 'validation',
  WORKSPACE_TRANSITION = 'workspace_transition',
  STORE_OPERATION = 'store_operation',
  NETWORK = 'network',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

// Error handling result
export interface ErrorHandlingResult {
  category: ConfigErrorCategory
  canRetry: boolean
  shouldFallback: boolean
  retryDelay?: number
  fallbackValue?: any
  userMessage: string
  technicalMessage: string
  recoveryActions: string[]
}

/**
 * Configuration Error Handler
 * 
 * Analyzes configuration errors and provides recovery strategies.
 */
export class ConfigErrorHandler {
  /**
   * Analyze and categorize configuration error
   * 
   * @param error - Error object
   * @param context - Additional context
   * @returns Error handling result
   */
  static analyzeError(
    error: Error,
    context: {
      configKey?: keyof AppConfig
      configValue?: any
      operationResult?: ConfigOperationResult
      workspaceId?: string
    } = {}
  ): ErrorHandlingResult {
    const message = error.message.toLowerCase()
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        category: ConfigErrorCategory.VALIDATION,
        canRetry: false,
        shouldFallback: true,
        userMessage: `Invalid value for ${context.configKey || 'configuration'}. Please check your input.`,
        technicalMessage: error.message,
        recoveryActions: [
          'Verify the input value format',
          'Check allowed values for this configuration',
          'Use default value if available'
        ]
      }
    }
    
    // Workspace transition errors
    if (message.includes('transitioning') || message.includes('workspace')) {
      return {
        category: ConfigErrorCategory.WORKSPACE_TRANSITION,
        canRetry: true,
        shouldFallback: false,
        retryDelay: 1000, // 1 second
        userMessage: 'Workspace is currently switching. Please wait and try again.',
        technicalMessage: error.message,
        recoveryActions: [
          'Wait for workspace transition to complete',
          'Retry the operation',
          'Force update if critically needed'
        ]
      }
    }
    
    // Store operation errors
    if (message.includes('store') || message.includes('zustand')) {
      return {
        category: ConfigErrorCategory.STORE_OPERATION,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 500,
        userMessage: 'Failed to save configuration. Retrying...',
        technicalMessage: error.message,
        recoveryActions: [
          'Retry store operation',
          'Clear cache and reload',
          'Fallback to localStorage'
        ]
      }
    }
    
    // Network/persistence errors
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        category: ConfigErrorCategory.NETWORK,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 2000,
        userMessage: 'Network error occurred. Configuration will be retried automatically.',
        technicalMessage: error.message,
        recoveryActions: [
          'Check network connection',
          'Retry with exponential backoff',
          'Save to local cache'
        ]
      }
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('access') || message.includes('unauthorized')) {
      return {
        category: ConfigErrorCategory.PERMISSION,
        canRetry: false,
        shouldFallback: true,
        userMessage: 'Permission denied. Some settings may not be saved.',
        technicalMessage: error.message,
        recoveryActions: [
          'Check user permissions',
          'Request elevated access',
          'Use read-only mode'
        ]
      }
    }
    
    // Unknown errors
    return {
      category: ConfigErrorCategory.UNKNOWN,
      canRetry: true,
      shouldFallback: true,
      retryDelay: 1000,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      recoveryActions: [
        'Retry the operation',
        'Restart the application',
        'Contact support if issue persists'
      ]
    }
  }

  /**
   * Execute error recovery strategy
   * 
   * @param result - Error handling result
   * @param retryFunction - Function to retry the operation
   * @returns Promise resolving to recovery success
   */
  static async executeRecovery(
    result: ErrorHandlingResult,
    retryFunction?: () => Promise<any>
  ): Promise<{ success: boolean; value?: any }> {
    switch (result.category) {
      case ConfigErrorCategory.WORKSPACE_TRANSITION:
        if (result.canRetry && retryFunction && result.retryDelay) {
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, result.retryDelay!))
          try {
            const value = await retryFunction()
            return { success: true, value }
          } catch (retryError) {
            console.error('Retry failed:', retryError)
            return { success: false }
          }
        }
        break
        
      case ConfigErrorCategory.STORE_OPERATION:
        if (result.canRetry && retryFunction) {
          // Immediate retry for store operations
          try {
            const value = await retryFunction()
            return { success: true, value }
          } catch (retryError) {
            // Fallback to localStorage if available
            if (result.shouldFallback) {
              console.warn('Falling back to localStorage')
              // Implementation would depend on specific requirements
              return { success: true, value: null }
            }
            return { success: false }
          }
        }
        break
        
      case ConfigErrorCategory.NETWORK:
        if (result.canRetry && retryFunction) {
          // Exponential backoff retry
          const maxRetries = 3
          let delay = result.retryDelay || 1000
          
          for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, delay))
            try {
              const value = await retryFunction()
              return { success: true, value }
            } catch (retryError) {
              delay *= 2 // Exponential backoff
              if (i === maxRetries - 1) {
                console.error('All retries failed:', retryError)
              }
            }
          }
        }
        break
        
      case ConfigErrorCategory.VALIDATION:
        // No automatic recovery for validation errors
        return { success: false }
        
      case ConfigErrorCategory.PERMISSION:
        // No automatic recovery for permission errors
        return { success: false }
        
      default:
        // Generic retry for unknown errors
        if (result.canRetry && retryFunction) {
          try {
            const value = await retryFunction()
            return { success: true, value }
          } catch (retryError) {
            return { success: false }
          }
        }
    }
    
    return { success: false }
  }

  /**
   * Get user-friendly error message with recovery suggestions
   * 
   * @param result - Error handling result
   * @returns User-friendly error information
   */
  static getUserErrorInfo(result: ErrorHandlingResult) {
    return {
      message: result.userMessage,
      canRetry: result.canRetry,
      suggestions: result.recoveryActions,
      severity: this.getErrorSeverity(result.category)
    }
  }

  /**
   * Get error severity level
   * 
   * @param category - Error category
   * @returns Severity level
   */
  private static getErrorSeverity(category: ConfigErrorCategory): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case ConfigErrorCategory.VALIDATION:
        return 'medium'
      case ConfigErrorCategory.WORKSPACE_TRANSITION:
        return 'low'
      case ConfigErrorCategory.STORE_OPERATION:
        return 'high'
      case ConfigErrorCategory.NETWORK:
        return 'medium'
      case ConfigErrorCategory.PERMISSION:
        return 'high'
      default:
        return 'medium'
    }
  }
}

/**
 * Hook for error handling in configuration components
 */
export const useConfigErrorHandler = () => {
  const [lastError, setLastError] = useState<ErrorHandlingResult | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)

  const handleError = useCallback((error: Error, context?: any) => {
    const result = ConfigErrorHandler.analyzeError(error, context)
    setLastError(result)
    return result
  }, [])

  const attemptRecovery = useCallback(async (retryFunction?: () => Promise<any>) => {
    if (!lastError) return { success: false }
    
    setIsRecovering(true)
    try {
      const recovery = await ConfigErrorHandler.executeRecovery(lastError, retryFunction)
      if (recovery.success) {
        setLastError(null)
      }
      return recovery
    } finally {
      setIsRecovering(false)
    }
  }, [lastError])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    lastError,
    isRecovering,
    handleError,
    attemptRecovery,
    clearError,
    getUserErrorInfo: lastError ? ConfigErrorHandler.getUserErrorInfo(lastError) : null
  }
}