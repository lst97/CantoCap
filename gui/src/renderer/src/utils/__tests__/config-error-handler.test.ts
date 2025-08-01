/**
 * Configuration Error Handler Tests
 * 
 * Comprehensive tests for the ConfigErrorHandler utility covering:
 * - Error categorization accuracy
 * - Retry logic with exponential backoff
 * - Recovery strategy selection
 * - User-friendly error message generation
 * - Hook functionality
 */

import { renderHook, act } from '@testing-library/react'
import { 
  ConfigErrorHandler, 
  ConfigErrorCategory, 
  useConfigErrorHandler,
  type ErrorHandlingResult 
} from '../config-error-handler'

describe('ConfigErrorHandler', () => {
  describe('Error Analysis and Categorization', () => {
    test('should categorize validation errors correctly', () => {
      const validationError = new Error('Configuration validation failed: Invalid language code')
      
      const result = ConfigErrorHandler.analyzeError(validationError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.VALIDATION,
        canRetry: false,
        shouldFallback: true,
        userMessage: expect.stringContaining('Invalid value'),
        technicalMessage: 'Configuration validation failed: Invalid language code',
        recoveryActions: [
          'Verify the input value format',
          'Check allowed values for this configuration',
          'Use default value if available'
        ]
      })
    })

    test('should categorize workspace transition errors correctly', () => {
      const transitionError = new Error('Workspace is transitioning. Use forceUpdate option if necessary.')
      
      const result = ConfigErrorHandler.analyzeError(transitionError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.WORKSPACE_TRANSITION,
        canRetry: true,
        shouldFallback: false,
        retryDelay: 1000,
        userMessage: 'Workspace is currently switching. Please wait and try again.',
        recoveryActions: [
          'Wait for workspace transition to complete',
          'Retry the operation',
          'Force update if critically needed'
        ]
      })
    })

    test('should categorize store operation errors correctly', () => {
      const storeError = new Error('Zustand store operation failed')
      
      const result = ConfigErrorHandler.analyzeError(storeError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.STORE_OPERATION,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 500,
        userMessage: 'Failed to save configuration. Retrying...',
        recoveryActions: [
          'Retry store operation',
          'Clear cache and reload',
          'Fallback to localStorage'
        ]
      })
    })

    test('should categorize network errors correctly', () => {
      const networkError = new Error('Network timeout occurred during fetch')
      
      const result = ConfigErrorHandler.analyzeError(networkError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.NETWORK,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 2000,
        userMessage: 'Network error occurred. Configuration will be retried automatically.',
        recoveryActions: [
          'Check network connection',
          'Retry with exponential backoff',
          'Save to local cache'
        ]
      })
    })

    test('should categorize permission errors correctly', () => {
      const permissionError = new Error('Access denied: insufficient permissions')
      
      const result = ConfigErrorHandler.analyzeError(permissionError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.PERMISSION,
        canRetry: false,
        shouldFallback: true,
        userMessage: 'Permission denied. Some settings may not be saved.',
        recoveryActions: [
          'Check user permissions',
          'Request elevated access',
          'Use read-only mode'
        ]
      })
    })

    test('should categorize unknown errors correctly', () => {
      const unknownError = new Error('Something unexpected happened')
      
      const result = ConfigErrorHandler.analyzeError(unknownError)
      
      expect(result).toMatchObject({
        category: ConfigErrorCategory.UNKNOWN,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 1000,
        userMessage: 'An unexpected error occurred. Please try again.',
        recoveryActions: [
          'Retry the operation',
          'Restart the application',
          'Contact support if issue persists'
        ]
      })
    })

    test('should handle case-insensitive error message matching', () => {
      const upperCaseError = new Error('VALIDATION FAILED: INVALID INPUT')
      
      const result = ConfigErrorHandler.analyzeError(upperCaseError)
      
      expect(result.category).toBe(ConfigErrorCategory.VALIDATION)
    })

    test('should include context in user messages', () => {
      const validationError = new Error('Invalid value provided')
      const context = { configKey: 'language' as const }
      
      const result = ConfigErrorHandler.analyzeError(validationError, context)
      
      expect(result.userMessage).toContain('Invalid value for language')
    })

    test('should handle missing context gracefully', () => {
      const validationError = new Error('Invalid value provided')
      
      const result = ConfigErrorHandler.analyzeError(validationError, {})
      
      expect(result.userMessage).toContain('Invalid value for configuration')
    })
  })

  describe('Error Recovery Execution', () => {
    test('should execute workspace transition recovery with delay', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.WORKSPACE_TRANSITION,
        canRetry: true,
        shouldFallback: false,
        retryDelay: 100, // Short delay for testing
        userMessage: 'Workspace transitioning',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockResolvedValue('success')
      const startTime = Date.now()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(recovery.success).toBe(true)
      expect(recovery.value).toBe('success')
      expect(retryFunction).toHaveBeenCalled()
    })

    test('should handle retry function failures during workspace transition recovery', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.WORKSPACE_TRANSITION,
        canRetry: true,
        shouldFallback: false,
        retryDelay: 10,
        userMessage: 'Workspace transitioning',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockRejectedValue(new Error('Retry failed'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Retry failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    test('should execute store operation recovery with immediate retry', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.STORE_OPERATION,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 500,
        userMessage: 'Store operation failed',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockResolvedValue('recovered')
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(true)
      expect(recovery.value).toBe('recovered')
      expect(retryFunction).toHaveBeenCalled()
    })

    test('should fallback for store operation when retry fails', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.STORE_OPERATION,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 500,
        userMessage: 'Store operation failed',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockRejectedValue(new Error('Retry failed'))
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(true)
      expect(recovery.value).toBe(null)
      expect(consoleSpy).toHaveBeenCalledWith('Falling back to localStorage')
      
      consoleSpy.mockRestore()
    })

    test('should execute network recovery with exponential backoff', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.NETWORK,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 10, // Short delays for testing
        userMessage: 'Network error',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      let attempts = 0
      const retryFunction = jest.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('Network still failing'))
        }
        return Promise.resolve('network recovered')
      })
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(true)
      expect(recovery.value).toBe('network recovered')
      expect(retryFunction).toHaveBeenCalledTimes(3)
    })

    test('should fail network recovery after max retries', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.NETWORK,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 1, // Very short delays for testing
        userMessage: 'Network error',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockRejectedValue(new Error('Network permanently down'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(false)
      expect(retryFunction).toHaveBeenCalledTimes(3) // Max retries
      expect(consoleSpy).toHaveBeenCalledWith('All retries failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    test('should not retry validation errors', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.VALIDATION,
        canRetry: false,
        shouldFallback: true,
        userMessage: 'Validation failed',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(false)
      expect(retryFunction).not.toHaveBeenCalled()
    })

    test('should not retry permission errors', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.PERMISSION,
        canRetry: false,
        shouldFallback: true,
        userMessage: 'Permission denied',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn()
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(false)
      expect(retryFunction).not.toHaveBeenCalled()
    })

    test('should execute generic retry for unknown errors', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.UNKNOWN,
        canRetry: true,
        shouldFallback: true,
        retryDelay: 1000,
        userMessage: 'Unknown error',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const retryFunction = jest.fn().mockResolvedValue('generic recovery')
      
      const recovery = await ConfigErrorHandler.executeRecovery(result, retryFunction)
      
      expect(recovery.success).toBe(true)
      expect(recovery.value).toBe('generic recovery')
      expect(retryFunction).toHaveBeenCalled()
    })

    test('should handle missing retry function gracefully', async () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.WORKSPACE_TRANSITION,
        canRetry: true,
        shouldFallback: false,
        retryDelay: 100,
        userMessage: 'Workspace transitioning',
        technicalMessage: 'Error',
        recoveryActions: []
      }
      
      const recovery = await ConfigErrorHandler.executeRecovery(result)
      
      expect(recovery.success).toBe(false)
    })
  })

  describe('User Error Information', () => {
    test('should provide user-friendly error information', () => {
      const result: ErrorHandlingResult = {
        category: ConfigErrorCategory.VALIDATION,
        canRetry: false,
        shouldFallback: true,
        userMessage: 'Invalid input provided',
        technicalMessage: 'Validation failed',
        recoveryActions: ['Check input', 'Try again']
      }
      
      const userInfo = ConfigErrorHandler.getUserErrorInfo(result)
      
      expect(userInfo).toEqual({
        message: 'Invalid input provided',
        canRetry: false,
        suggestions: ['Check input', 'Try again'],
        severity: 'medium'
      })
    })

    test('should assign correct severity levels', () => {
      const categories = [
        { category: ConfigErrorCategory.VALIDATION, expectedSeverity: 'medium' },
        { category: ConfigErrorCategory.WORKSPACE_TRANSITION, expectedSeverity: 'low' },
        { category: ConfigErrorCategory.STORE_OPERATION, expectedSeverity: 'high' },
        { category: ConfigErrorCategory.NETWORK, expectedSeverity: 'medium' },
        { category: ConfigErrorCategory.PERMISSION, expectedSeverity: 'high' },
        { category: ConfigErrorCategory.UNKNOWN, expectedSeverity: 'medium' }
      ]
      
      categories.forEach(({ category, expectedSeverity }) => {
        const result: ErrorHandlingResult = {
          category,
          canRetry: false,
          shouldFallback: false,
          userMessage: 'Test message',
          technicalMessage: 'Test error',
          recoveryActions: []
        }
        
        const userInfo = ConfigErrorHandler.getUserErrorInfo(result)
        expect(userInfo.severity).toBe(expectedSeverity)
      })
    })
  })
})

describe('useConfigErrorHandler Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should initialize with null error and not recovering', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    expect(result.current.lastError).toBe(null)
    expect(result.current.isRecovering).toBe(false)
    expect(result.current.getUserErrorInfo).toBe(null)
  })

  test('should handle error and analyze it', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    const testError = new Error('Configuration validation failed')
    const context = { configKey: 'language' as const }
    
    act(() => {
      const analysisResult = result.current.handleError(testError, context)
      
      expect(analysisResult.category).toBe(ConfigErrorCategory.VALIDATION)
      expect(analysisResult.userMessage).toContain('Invalid value for language')
    })
    
    expect(result.current.lastError).not.toBe(null)
    expect(result.current.lastError?.category).toBe(ConfigErrorCategory.VALIDATION)
  })

  test('should provide user error information when error exists', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Network timeout'))
    })
    
    const userInfo = result.current.getUserErrorInfo
    expect(userInfo).not.toBe(null)
    expect(userInfo?.message).toContain('Network error')
    expect(userInfo?.canRetry).toBe(true)
    expect(userInfo?.severity).toBe('medium')
  })

  test('should attempt recovery with retry function', async () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    // Set up an error that can be retried
    act(() => {
      result.current.handleError(new Error('Store operation failed'))
    })
    
    expect(result.current.lastError?.canRetry).toBe(true)
    
    const retryFunction = jest.fn().mockResolvedValue('recovery successful')
    
    let recoveryResult: any
    
    await act(async () => {
      recoveryResult = await result.current.attemptRecovery(retryFunction)
    })
    
    expect(recoveryResult.success).toBe(true)
    expect(recoveryResult.value).toBe('recovery successful')
    expect(result.current.lastError).toBe(null) // Should clear error on successful recovery
    expect(result.current.isRecovering).toBe(false)
  })

  test('should manage recovery loading state', async () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Network timeout'))
    })
    
    let resolveRecovery: (value: string) => void
    const recoveryPromise = new Promise<string>((resolve) => {
      resolveRecovery = resolve
    })
    
    const retryFunction = jest.fn().mockReturnValue(recoveryPromise)
    
    // Start recovery
    let recoveryResultPromise: Promise<any>
    act(() => {
      recoveryResultPromise = result.current.attemptRecovery(retryFunction)
    })
    
    // Should be in recovering state
    expect(result.current.isRecovering).toBe(true)
    
    // Complete recovery
    await act(async () => {
      resolveRecovery!('recovered')
      await recoveryResultPromise
    })
    
    // Should no longer be recovering
    expect(result.current.isRecovering).toBe(false)
  })

  test('should preserve error when recovery fails', async () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    const originalError = new Error('Store operation failed')
    act(() => {
      result.current.handleError(originalError)
    })
    
    const retryFunction = jest.fn().mockRejectedValue(new Error('Recovery failed'))
    
    await act(async () => {
      const recoveryResult = await result.current.attemptRecovery(retryFunction)
      expect(recoveryResult.success).toBe(false)
    })
    
    expect(result.current.lastError).not.toBe(null)
    expect(result.current.isRecovering).toBe(false)
  })

  test('should handle recovery attempt with no error', async () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    // No error set
    expect(result.current.lastError).toBe(null)
    
    await act(async () => {
      const recoveryResult = await result.current.attemptRecovery()
      expect(recoveryResult.success).toBe(false)
    })
    
    expect(result.current.isRecovering).toBe(false)
  })

  test('should clear error manually', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    expect(result.current.lastError).not.toBe(null)
    
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.lastError).toBe(null)
    expect(result.current.getUserErrorInfo).toBe(null)
  })

  test('should handle multiple errors sequentially', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    // First error
    act(() => {
      result.current.handleError(new Error('Validation failed'))
    })
    
    expect(result.current.lastError?.category).toBe(ConfigErrorCategory.VALIDATION)
    
    // Second error should replace first
    act(() => {
      result.current.handleError(new Error('Network timeout'))
    })
    
    expect(result.current.lastError?.category).toBe(ConfigErrorCategory.NETWORK)
  })

  test('should handle errors without context', () => {
    const { result } = renderHook(() => useConfigErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Generic error'))
    })
    
    expect(result.current.lastError).not.toBe(null)
    expect(result.current.lastError?.category).toBe(ConfigErrorCategory.UNKNOWN)
  })

  test('should maintain consistent function references', () => {
    const { result, rerender } = renderHook(() => useConfigErrorHandler())
    
    const initialFunctions = {
      handleError: result.current.handleError,
      attemptRecovery: result.current.attemptRecovery,
      clearError: result.current.clearError
    }
    
    rerender()
    
    expect(result.current.handleError).toBe(initialFunctions.handleError)
    expect(result.current.attemptRecovery).toBe(initialFunctions.attemptRecovery)
    expect(result.current.clearError).toBe(initialFunctions.clearError)
  })
})