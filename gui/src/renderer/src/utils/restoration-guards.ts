/**
 * Restoration Guards Utility
 * Provides utilities to prevent race conditions and unwanted triggers during app reload
 */

import { useRef, useEffect } from 'react'

// Global restoration state management
let isGlobalRestorationMode = false
let restorationStartTime = 0
const RESTORATION_TIMEOUT = 3000 // 3 seconds max restoration window

// Set global restoration mode (called during app initialization)
export const setGlobalRestorationMode = (isRestoring: boolean): void => {
  isGlobalRestorationMode = isRestoring
  if (isRestoring) {
    restorationStartTime = Date.now()
    // Auto-clear restoration mode after timeout
    setTimeout(() => {
      isGlobalRestorationMode = false
      console.log('🔄 Global restoration mode auto-cleared after timeout')
    }, RESTORATION_TIMEOUT)
  }
}

// Check if we're currently in global restoration mode
export const isInGlobalRestorationMode = (): boolean => {
  // Auto-clear if restoration has been active too long
  if (isGlobalRestorationMode && Date.now() - restorationStartTime > RESTORATION_TIMEOUT) {
    isGlobalRestorationMode = false
    console.log('🔄 Global restoration mode auto-cleared due to timeout')
  }
  return isGlobalRestorationMode
}

// Set restoration markers in window object for component communication
export const setRestorationMarkers = (): void => {
  (window as any).__WORKFLOW_RESTORATION_IN_PROGRESS = true
  (window as any).__JSON_IMPORT_RESTORATION_MODE = true
}

export const clearRestorationMarkers = (): void => {
  (window as any).__WORKFLOW_RESTORATION_IN_PROGRESS = false
  (window as any).__JSON_IMPORT_RESTORATION_MODE = false
}

/**
 * Hook to create a mounting guard that prevents initial useEffect triggers during restoration
 * @param preventDuringRestore - Whether to prevent effect during restoration mode
 * @returns Object with mounting state and guard function
 */
export const useMountingGuard = (preventDuringRestore = true) => {
  const hasMountedRef = useRef(false)
  const isInitialMountRef = useRef(true)
  
  useEffect(() => {
    // Mark as mounted on first effect run
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      // Don't trigger initial effects if in restoration mode
      if (preventDuringRestore && isInGlobalRestorationMode()) {
        console.log('🛡️ Mounting guard: Skipping initial effect due to restoration mode')
        return
      }
      isInitialMountRef.current = false
    }
  }, [preventDuringRestore])
  
  const shouldSkipEffect = (): boolean => {
    if (isInitialMountRef.current) {
      if (preventDuringRestore && isInGlobalRestorationMode()) {
        console.log('🛡️ Effect guard: Skipping effect due to restoration mode')
        return true
      }
      isInitialMountRef.current = false
    }
    return false
  }
  
  return {
    hasMounted: hasMountedRef.current,
    isInitialMount: isInitialMountRef.current,
    shouldSkipEffect
  }
}

/**
 * Hook for effects that should not run during restoration
 * @param effect - The effect function to run
 * @param deps - Dependencies array
 * @param options - Configuration options
 */
export const useRestorationSafeEffect = (
  effect: React.EffectCallback,
  deps: React.DependencyList,
  options: {
    skipInitialMount?: boolean
    skipDuringRestore?: boolean
    description?: string
  } = {}
) => {
  const { skipInitialMount = true, skipDuringRestore = true, description } = options
  const { shouldSkipEffect } = useMountingGuard(skipDuringRestore)
  const hasRunInitialEffect = useRef(false)
  
  useEffect(() => {
    // Skip initial mount if requested
    if (skipInitialMount && !hasRunInitialEffect.current) {
      hasRunInitialEffect.current = true
      if (description) {
        console.log(`🛡️ Restoration-safe effect (${description}): Skipping initial mount`)
      }
      return
    }
    
    // Check if we should skip due to restoration mode
    if (shouldSkipEffect()) {
      if (description) {
        console.log(`🛡️ Restoration-safe effect (${description}): Skipping due to restoration mode`)
      }
      return
    }
    
    // Run the actual effect
    if (description) {
      console.log(`🟢 Restoration-safe effect (${description}): Running`)
    }
    return effect()
  }, deps)
}

/**
 * Debounced async operation that respects restoration mode
 * @param operation - Async operation to perform
 * @param delay - Debounce delay in milliseconds
 * @param respectRestorationMode - Whether to skip during restoration
 * @returns Promise that resolves when operation completes or is skipped
 */
export const debouncedAsyncOperation = async <T>(
  operation: () => Promise<T>,
  delay = 300,
  respectRestorationMode = true
): Promise<T | null> => {
  // Wait for debounce delay
  await new Promise(resolve => setTimeout(resolve, delay))
  
  // Check if we should skip due to restoration mode
  if (respectRestorationMode && isInGlobalRestorationMode()) {
    console.log('🛡️ Debounced operation: Skipped due to restoration mode')
    return null
  }
  
  try {
    return await operation()
  } catch (error) {
    console.error('❌ Debounced operation failed:', error)
    throw error
  }
}

/**
 * Safe setTimeout that won't execute during restoration mode
 * @param callback - Function to execute
 * @param delay - Delay in milliseconds
 * @param respectRestorationMode - Whether to skip during restoration
 * @returns Timeout ID or null if skipped
 */
export const safeSetTimeout = (
  callback: () => void,
  delay: number,
  respectRestorationMode = true
): NodeJS.Timeout | null => {
  return setTimeout(() => {
    if (respectRestorationMode && isInGlobalRestorationMode()) {
      console.log('🛡️ Safe timeout: Skipped callback due to restoration mode')
      return
    }
    callback()
  }, delay)
}

/**
 * Creates a restoration context for useStepConfig and similar hooks
 */
export const createRestorationContext = (
  isRestoring = false,
  options: {
    preventNavigationTriggers?: boolean
    restorationTimeoutMs?: number
    onRestorationComplete?: () => void
  } = {}
) => ({
  isRestoring: isRestoring || isInGlobalRestorationMode(),
  preventNavigationTriggers: options.preventNavigationTriggers ?? true,
  restorationTimeoutMs: options.restorationTimeoutMs ?? 2000,
  onRestorationComplete: options.onRestorationComplete
})

/**
 * Effect cleanup utility that respects component unmounting and restoration mode
 */
export const createSafeCleanup = () => {
  const timeouts: NodeJS.Timeout[] = []
  const promises: Promise<any>[] = []
  const abortControllers: AbortController[] = []
  
  const addTimeout = (timeoutId: NodeJS.Timeout) => {
    timeouts.push(timeoutId)
  }
  
  const addPromise = (promise: Promise<any>) => {
    promises.push(promise)
  }
  
  const addAbortController = (controller: AbortController) => {
    abortControllers.push(controller)
  }
  
  const cleanup = () => {
    // Clear all timeouts
    timeouts.forEach(clearTimeout)
    timeouts.length = 0
    
    // Abort all ongoing requests
    abortControllers.forEach(controller => {
      try {
        controller.abort()
      } catch (error) {
        // Ignore abort errors
      }
    })
    abortControllers.length = 0
    
    // Note: Promises cannot be cancelled, but we've removed references
    promises.length = 0
    
    console.log('🧹 Safe cleanup completed')
  }
  
  return {
    addTimeout,
    addPromise,
    addAbortController,
    cleanup
  }
}