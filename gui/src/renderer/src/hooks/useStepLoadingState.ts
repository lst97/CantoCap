import { useMemo } from 'react'
import { useWorkspaceRequirement } from '../contexts/WorkspaceConfigContext'
import { useWorkspaceStore } from '../stores/workspace-store'
import { 
  useConfigStepConfig, 
  useInputFileConfig,
  useProcessingStepConfig,
  useReviewStepConfig
} from '../contexts/WorkspaceConfigContext'
import { useSmoothLoadingTransition } from './useSmoothLoadingTransition'
import type { WorkflowStepId } from '../types/workspace'

interface StepLoadingState {
  isLoading: boolean
  isReady: boolean
  workspaceName?: string
  loadingMessage: string
  loadingSubtitle: string
  isTransitioning: boolean
}

/**
 * Hook to determine if a step content area should show loading overlay
 * 
 * IMPORTANT: Overlay is ONLY shown during workspace operations (initial load, workspace switching).
 * Step-specific configuration loading does NOT trigger the overlay for better UX.
 * This prevents disruptive loading states during normal configuration changes.
 */
export const useStepLoadingState = (currentStep: WorkflowStepId): StepLoadingState => {
  const workspaceRequirement = useWorkspaceRequirement()
  const workspaceStore = useWorkspaceStore()
  
  const isWorkspaceReady = workspaceRequirement?.isReady || false
  const isWorkspaceLoading = workspaceStore?.isLoading || false
  const currentWorkspace = workspaceStore?.currentWorkspace || null
  
  // ALWAYS call all step config hooks to follow Rules of Hooks
  // This ensures consistent hook execution order on every render
  const inputFileResult = useInputFileConfig()
  const configResult = useConfigStepConfig()
  const processingResult = useProcessingStepConfig()
  const reviewResult = useReviewStepConfig()
  
  // Select the appropriate result based on current step
  let stepState = { isLoading: false, isReady: isWorkspaceReady }
  
  try {
    switch (currentStep) {
      case 'input-file': {
        stepState = (inputFileResult && Array.isArray(inputFileResult) && inputFileResult.length > 2 && inputFileResult[2]) ? { 
          isLoading: Boolean(inputFileResult[2].isLoading), 
          isReady: inputFileResult[2].isReady !== false && isWorkspaceReady 
        } : stepState
        break
      }
      case 'config': {
        stepState = (configResult && Array.isArray(configResult) && configResult.length > 2 && configResult[2]) ? { 
          isLoading: Boolean(configResult[2].isLoading), 
          isReady: configResult[2].isReady !== false && isWorkspaceReady 
        } : stepState
        break
      }
      case 'processing': {
        stepState = (processingResult && Array.isArray(processingResult) && processingResult.length > 2 && processingResult[2]) ? { 
          isLoading: Boolean(processingResult[2].isLoading), 
          isReady: processingResult[2].isReady !== false && isWorkspaceReady 
        } : stepState
        break
      }
      case 'review': {
        // Enhanced validation for review step to handle JSON subtitle loading edge cases
        stepState = (reviewResult && 
                    typeof reviewResult === 'object' && 
                    reviewResult !== null &&
                    typeof reviewResult.isLoading !== 'undefined' &&
                    typeof reviewResult.isReady !== 'undefined') ? { 
          isLoading: Boolean(reviewResult.isLoading), 
          isReady: Boolean(reviewResult.isReady) && isWorkspaceReady 
        } : stepState
        break
      }
      case 'export':
      default:
        // For export step and any other steps, use workspace ready state
        stepState = { isLoading: false, isReady: isWorkspaceReady }
        break
    }
  } catch (error) {
    // Fallback to workspace state if step evaluation fails
    console.warn(`Failed to get step state for ${currentStep}:`, error)
    stepState = { isLoading: false, isReady: isWorkspaceReady }
  }
  
  const stepIsLoading = Boolean(stepState.isLoading)
  const stepIsReady = Boolean(stepState.isReady)
  
  // Calculate raw loading state - ONLY for workspace operations, not step config changes
  // Use simple variable instead of useMemo to avoid dependency array corruption
  const rawIsLoading = !isWorkspaceReady || isWorkspaceLoading
  
  // Apply smooth transition to prevent flashing
  const smoothTransition = useSmoothLoadingTransition(rawIsLoading, {
    minDisplayTime: 600,  // Show for at least 600ms
    hideDelay: 200,       // Wait 200ms before hiding
    showDelay: 0          // Show immediately
  })
  
  // Remove useMemo entirely to prevent dependency array issues during rapid state changes
  // Step is ready when:
  // 1. Workspace is ready AND
  // 2. Not switching workspaces AND  
  // 3. Step-specific config is loaded (but we don't block UI for this)
  // 4. Not in transition state
  // Note: Step loading doesn't affect overlay visibility anymore, only readiness
  const isReady = isWorkspaceReady && !isWorkspaceLoading && stepIsReady && !(smoothTransition?.isTransitioning || false)
  
  // Determine appropriate loading message - only for workspace operations
  let loadingMessage = 'Loading Configuration'
  let loadingSubtitle = 'Initializing workspace settings...'
  let workspaceName: string | undefined
  
  if (isWorkspaceLoading && currentWorkspace) {
    loadingMessage = 'Switching Workspace'
    loadingSubtitle = `Loading "${currentWorkspace.name}"...`
    workspaceName = currentWorkspace.name
  } else if (!isWorkspaceReady) {
    loadingMessage = 'Loading Configuration'
    loadingSubtitle = 'Initializing workspace system...'
  }
  // REMOVED: Step-specific loading message since we no longer show overlay for step config changes
  
  return {
    isLoading: smoothTransition?.isVisible || false,
    isReady,
    workspaceName,
    loadingMessage,
    loadingSubtitle,
    isTransitioning: smoothTransition?.isTransitioning || false
  }
}

export default useStepLoadingState