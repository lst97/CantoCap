import { useState, useEffect, useRef } from 'react'

interface SmoothLoadingTransitionOptions {
  /** Minimum time to show overlay before allowing hide (ms) */
  minDisplayTime?: number
  /** Delay before hiding overlay when loading becomes false (ms) */
  hideDelay?: number
  /** Delay before showing overlay when loading becomes true (ms) */
  showDelay?: number
}

interface SmoothLoadingState {
  /** Whether the overlay should be visible */
  isVisible: boolean
  /** Whether we're in a transition state */
  isTransitioning: boolean
}

/**
 * Hook to create smooth loading transitions without flashing
 * 
 * Prevents rapid show/hide cycles by:
 * 1. Enforcing minimum display time
 * 2. Debouncing hide transitions
 * 3. Immediate show on new loading states
 * 
 * Used by useStepLoadingState to provide smooth workspace-only loading overlays.
 * No longer triggered by step configuration changes for better UX.
 */
export const useSmoothLoadingTransition = (
  isLoading: boolean,
  options: SmoothLoadingTransitionOptions = {}
): SmoothLoadingState => {
  const {
    minDisplayTime = 800,  // Minimum 800ms display
    hideDelay = 300,       // 300ms delay before hiding
    showDelay = 0          // Show immediately
  } = options

  const [isVisible, setIsVisible] = useState(isLoading)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const showTimeRef = useRef<number | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any pending timeouts
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }

    if (isLoading) {
      // Loading started - show immediately or after short delay
      const showOverlay = () => {
        setIsVisible(true)
        setIsTransitioning(false)
        showTimeRef.current = Date.now()
      }

      if (showDelay > 0) {
        setIsTransitioning(true)
        showTimeoutRef.current = setTimeout(showOverlay, showDelay)
      } else {
        showOverlay()
      }
    } else {
      // Loading stopped - hide with delay and minimum display time
      const hideOverlay = () => {
        const now = Date.now()
        const showTime = showTimeRef.current
        
        if (showTime) {
          const displayTime = now - showTime
          const remainingMinTime = Math.max(0, minDisplayTime - displayTime)
          
          if (remainingMinTime > 0) {
            // Wait for minimum display time to elapse
            hideTimeoutRef.current = setTimeout(() => {
              setIsVisible(false)
              setIsTransitioning(false)
              showTimeRef.current = null
            }, remainingMinTime)
          } else {
            // Minimum time already elapsed, hide after delay
            hideTimeoutRef.current = setTimeout(() => {
              setIsVisible(false)
              setIsTransitioning(false)
              showTimeRef.current = null
            }, hideDelay)
          }
        } else {
          // No show time recorded, hide immediately
          setIsVisible(false)
          setIsTransitioning(false)
        }
      }

      setIsTransitioning(true)
      hideOverlay()
    }

    // Cleanup on unmount
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current)
      }
    }
  }, [isLoading, minDisplayTime, hideDelay, showDelay])

  return {
    isVisible,
    isTransitioning
  }
}

export default useSmoothLoadingTransition