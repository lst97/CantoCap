/**
 * Test cases for restoration-aware functionality in useStepConfig hook
 */

import { renderHook, act } from '@testing-library/react'
import { useStepConfig, createRestorationContext } from '../useStepConfig'

// Mock the workspace store
jest.mock('../../stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    getStepConfig: jest.fn().mockResolvedValue({ language: 'zh', priority: 'balanced' }),
    validateStepConfig: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    getCacheMetrics: jest.fn().mockReturnValue({ hitRate: 0.8 })
  })
}))

// Mock validation utilities
jest.mock('../../utils/stepConfigValidation', () => ({
  validateStepConfig: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] })
}))

jest.mock('../../utils/typeGuards', () => ({
  sanitizeStepConfig: jest.fn((stepId, config) => config),
  isValidStepConfig: jest.fn(() => true)
}))

describe('useStepConfig restoration functionality', () => {
  const mockWorkspaceId = 'test-workspace-id'
  const stepId = 'config'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with restoration state when restoration context is provided', () => {
    const restorationContext = createRestorationContext(true)
    
    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, { restorationContext })
    )

    expect(result.current.isRestoring).toBe(true)
    expect(result.current.isInitialLoad).toBe(true)
  })

  it('should prevent navigation triggers during restoration mode', () => {
    const onValidationSuccess = jest.fn()
    const onValidationError = jest.fn()
    const restorationContext = createRestorationContext(true, {
      preventNavigationTriggers: true
    })

    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, {
        restorationContext,
        onValidationSuccess,
        onValidationError
      })
    )

    // Even though validation would normally trigger callbacks, they should be suppressed
    act(() => {
      jest.advanceTimersByTime(100) // Allow initial load to complete
    })

    expect(onValidationSuccess).not.toHaveBeenCalled()
    expect(onValidationError).not.toHaveBeenCalled()
  })

  it('should complete restoration after timeout', () => {
    const onRestorationComplete = jest.fn()
    const restorationContext = createRestorationContext(true, {
      restorationTimeoutMs: 1000,
      onRestorationComplete
    })

    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, { restorationContext })
    )

    expect(result.current.isRestoring).toBe(true)

    // Fast-forward past the restoration timeout
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current.isRestoring).toBe(false)
    expect(result.current.isInitialLoad).toBe(false)
    expect(onRestorationComplete).toHaveBeenCalled()
  })

  it('should prevent config updates during restoration mode', async () => {
    const restorationContext = createRestorationContext(true, {
      preventNavigationTriggers: true
    })

    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, { restorationContext })
    )

    // Wait for initial load
    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    // Try to update config during restoration - should be prevented
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    await act(async () => {
      await result.current.updateConfig({ language: 'en' })
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Preventing config update during restoration')
    )

    consoleWarnSpy.mockRestore()
  })

  it('should allow normal operations after restoration completes', async () => {
    const restorationContext = createRestorationContext(true, {
      restorationTimeoutMs: 500
    })

    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, { restorationContext })
    )

    // Complete restoration
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.isRestoring).toBe(false)

    // Now updates should work normally
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    await act(async () => {
      await result.current.updateConfig({ language: 'en' })
    })

    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Preventing config update during restoration')
    )

    consoleWarnSpy.mockRestore()
  })

  it('should work normally when no restoration context is provided', () => {
    const { result } = renderHook(() =>
      useStepConfig(stepId, mockWorkspaceId, {})
    )

    expect(result.current.isRestoring).toBe(false)
    expect(result.current.isInitialLoad).toBe(false)
  })

  it('should use default restoration context values', () => {
    const restorationContext = createRestorationContext(true)
    
    expect(restorationContext.preventNavigationTriggers).toBe(true)
    expect(restorationContext.restorationTimeoutMs).toBe(2000)
  })
})