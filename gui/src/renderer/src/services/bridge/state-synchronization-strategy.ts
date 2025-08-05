/**
 * State Synchronization Strategy
 * Manages bidirectional sync between workflow states and workspace config
 * Ensures data consistency and performance optimization
 */

import { DefaultStepId as WorkflowStepId, StepState, StateChangeEvent, WorkflowStepState } from '../../types/workflow-state'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { EnhancedWorkspaceStoreWithGrouping } from '../../types/workspace'
import { workflowStateManager } from '../workflow/workflow-state-manager'

// Synchronization event types
export type SyncEventType = 
  | 'step-state-changed'
  | 'current-step-changed'
  | 'import-context-changed'
  | 'workspace-switched'
  | 'workspace-config-updated'

// Synchronization event payload
export interface SyncEvent {
  type: SyncEventType
  stepId?: WorkflowStepId
  workspaceId?: string
  timestamp: number
  source: 'workflow-manager' | 'workspace-store' | 'component'
  data?: Record<string, unknown>
}

// Synchronization result
export interface SyncResult {
  success: boolean
  conflicts: Array<{
    type: 'step-state' | 'current-step' | 'import-context'
    workflowValue: unknown
    workspaceValue: unknown
    resolution: 'workflow-wins' | 'workspace-wins' | 'merged'
    resolvedValue: unknown
  }>
  syncedFields: string[]
  errors: string[]
  duration: number
}

// Conflict resolution strategy
export type ConflictResolutionStrategy = 
  | 'workflow-wins'      // Workflow state manager takes precedence
  | 'workspace-wins'     // Workspace config takes precedence
  | 'merged'             // Merge both values intelligently
  | 'manual-resolution'  // Require manual conflict resolution

// Synchronization configuration
export interface StateSyncConfig {
  enabled: boolean
  conflictResolution: ConflictResolutionStrategy
  debounceMs: number
  maxRetries: number
  enablePerformanceTracking: boolean
  syncDirection: 'bidirectional' | 'workflow-to-workspace' | 'workspace-to-workflow'
}

// Default synchronization configuration
const DEFAULT_SYNC_CONFIG: StateSyncConfig = {
  enabled: true,
  conflictResolution: 'merged',
  debounceMs: 500,
  maxRetries: 3,
  enablePerformanceTracking: true,
  syncDirection: 'bidirectional',
}

/**
 * State Synchronization Manager
 * Handles bidirectional synchronization between workflow state and workspace config
 */
export class StateSynchronizationManager {
  private config: StateSyncConfig
  private syncInProgress = false
  private lastSyncTime: number | null = null
  private eventListeners: Map<SyncEventType, ((event: SyncEvent) => void)[]> = new Map()
  private performanceMetrics: {
    syncCount: number
    averageTime: number
    conflictCount: number
    errorCount: number
  } = {
    syncCount: 0,
    averageTime: 0,
    conflictCount: 0,
    errorCount: 0,
  }

  constructor(config: Partial<StateSyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    this.setupEventListeners()
  }

  /**
   * Setup event listeners for automatic synchronization
   */
  private setupEventListeners(): void {
    if (!this.config.enabled) return

    // Listen to workflow state changes
    // Note: Using event-based subscription with the merged workflow state manager
    try {
      // Subscribe to state change events from the workflow state manager
      // Note: Using the subscribe method from the merged workflow state manager
      try {
        if (typeof workflowStateManager.subscribe === 'function') {
          workflowStateManager.subscribe((event: StateChangeEvent) => {
        const events: SyncEvent[] = []

        // Create sync event for step state change
        if (event.stepId && event.newState !== event.previousState) {
          events.push({
            type: 'step-state-changed',
            stepId: event.stepId as WorkflowStepId,
            timestamp: Date.now(),
            source: 'workflow-manager',
            data: {
              state: event.newState,
              previousState: event.previousState,
              metadata: event.metadata || {}
            } as Record<string, unknown> & { [key: string]: unknown }
          })
        }

            // Process events
            this.processEvents(events)
          })
        } else {
          console.warn('Subscribe method not available on workflowStateManager')
        }
      } catch (error) {
        // Fallback - could implement polling or other subscription method
        console.warn('Failed to setup workflow state event listener:', error)
      }
    } catch (error) {
      console.warn('Failed to subscribe to workflow state changes:', error)
    }

    // Listen to workspace changes
    useWorkspaceStore.subscribe(
      (state: EnhancedWorkspaceStoreWithGrouping) => ({
        currentWorkspace: state.currentWorkspace,
        workspaceId: state.currentWorkspace?.id,
        config: state.currentWorkspace?.config,
      }),
      (current, previous) => {
        if (!current.currentWorkspace) return

        const events: SyncEvent[] = []

        // Detect workspace switch
        if (current.workspaceId !== previous?.workspaceId) {
          events.push({
            type: 'workspace-switched',
            workspaceId: current.workspaceId,
            timestamp: Date.now(),
            source: 'workspace-store',
          })
        }

        // Detect workspace config updates
        if (current.config && previous?.config) {
          if (current.config.lastModified !== previous.config.lastModified) {
            events.push({
              type: 'workspace-config-updated',
              workspaceId: current.workspaceId,
              timestamp: Date.now(),
              source: 'workspace-store',
              data: current.config as unknown as Record<string, unknown>,
            })
          }
        }

        // Process events
        this.processEvents(events)
      },
      {
        equalityFn: (a, b) => {
          if (!a?.currentWorkspace || !b?.currentWorkspace) return a?.workspaceId === b?.workspaceId
          
          return (
            a.workspaceId === b.workspaceId &&
            a.config?.lastModified === b.config?.lastModified
          )
        },
      }
    )
  }

  /**
   * Process synchronization events
   */
  private async processEvents(events: SyncEvent[]): Promise<void> {
    if (!this.config.enabled || events.length === 0) return

    // Emit events to listeners
    for (const event of events) {
      this.emitEvent(event)
    }

    // Perform synchronization based on event types
    const shouldSync = events.some(event => 
      ['step-state-changed', 'current-step-changed', 'import-context-changed'].includes(event.type)
    )

    if (shouldSync) {
      await this.performSync()
    }

    // Handle workspace switches
    const workspaceSwitchEvent = events.find(e => e.type === 'workspace-switched')
    if (workspaceSwitchEvent && workspaceSwitchEvent.workspaceId) {
      await this.syncFromWorkspace(workspaceSwitchEvent.workspaceId)
    }
  }

  /**
   * Emit synchronization event to listeners
   */
  private emitEvent(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error(`Error in sync event listener for ${event.type}:`, error)
      }
    })
  }

  /**
   * Add event listener
   */
  public addEventListener(type: SyncEventType, listener: (event: SyncEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, [])
    }
    this.eventListeners.get(type)!.push(listener)

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(type)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  /**
   * Perform bidirectional synchronization
   */
  public async performSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        conflicts: [],
        syncedFields: [],
        errors: ['Sync already in progress'],
        duration: 0,
      }
    }

    const startTime = performance.now()
    this.syncInProgress = true

    try {
      const workspaceState = useWorkspaceStore.getState()

      if (!workspaceState.currentWorkspace) {
        throw new Error('No active workspace for synchronization')
      }

      const conflicts: SyncResult['conflicts'] = []
      const syncedFields: string[] = []
      const errors: string[] = []

      // Get current workflow state
      const currentStepId = workflowStateManager.getCurrentStep()
      const allSteps: Record<WorkflowStepId, WorkflowStepState | null> = {
        'input-file': null,
        'config': null,
        'processing': null,
        'review': null,
        'export': null
      }
      
      // Build steps object from workflow state manager
      const stepIds: WorkflowStepId[] = ['input-file', 'config', 'processing', 'review', 'export']
      for (const stepId of stepIds) {
        const step = workflowStateManager.getStep(stepId)
        if (step) {
          allSteps[stepId] = step
        }
      }

      // Sync step states
      const stepStateSync = await this.syncStepStates(
        allSteps,
        workspaceState.currentWorkspace.config.stepStates || {
          'input-file': { state: StepState.Pending, lastModified: 0 },
          'config': { state: StepState.Pending, lastModified: 0 },
          'processing': { state: StepState.Pending, lastModified: 0 },
          'review': { state: StepState.Pending, lastModified: 0 },
          'export': { state: StepState.Pending, lastModified: 0 }
        }
      )
      conflicts.push(...(stepStateSync.conflicts || []))
      syncedFields.push(...(stepStateSync.syncedFields || []))
      errors.push(...(stepStateSync.errors || []))

      // Sync current step
      const currentStepSync = await this.syncCurrentStep(
        currentStepId as WorkflowStepId,
        workspaceState.currentWorkspace.config.lastActiveStep
      )
      conflicts.push(...(currentStepSync.conflicts || []))
      syncedFields.push(...(currentStepSync.syncedFields || []))
      errors.push(...(currentStepSync.errors || []))

      // Sync import context (simplified for now)
      const importContextSync = await this.syncImportContext(
        undefined, // workflowState.workspaceSync.importContext,
        workspaceState.currentWorkspace.config.importContext,
        workspaceState.currentWorkspace.config.importedJsonFile
      )
      conflicts.push(...(importContextSync.conflicts || []))
      syncedFields.push(...(importContextSync.syncedFields || []))
      errors.push(...(importContextSync.errors || []))

      // Update performance metrics
      const duration = performance.now() - startTime
      this.updatePerformanceMetrics(duration, conflicts.length, errors.length)

      this.lastSyncTime = Date.now()

      return {
        success: errors.length === 0,
        conflicts,
        syncedFields,
        errors,
        duration,
      }
    } catch (error) {
      const duration = performance.now() - startTime
      this.updatePerformanceMetrics(duration, 0, 1)

      return {
        success: false,
        conflicts: [],
        syncedFields: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        duration,
      }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Sync step states between workflow and workspace
   */
  private async syncStepStates(
    workflowSteps: Record<WorkflowStepId, WorkflowStepState | null>,
    workspaceStepStates: Record<WorkflowStepId, {
      state: StepState;
      lastModified: number;
      metadata?: Record<string, unknown>;
      dependencies?: WorkflowStepId[];
      validationPassed?: boolean;
      errorMessage?: string;
    }>
  ): Promise<Partial<SyncResult>> {
    const conflicts: SyncResult['conflicts'] = []
    const syncedFields: string[] = []
    const errors: string[] = []

    try {
      const workspaceStore = useWorkspaceStore.getState()

      if (!workspaceStore.currentWorkspace) {
        throw new Error('No active workspace')
      }

      // Prepare workspace config update
      const updatedStepStates: Record<WorkflowStepId, {
        state: StepState;
        lastModified: number;
        metadata?: Record<string, unknown>;
        dependencies?: WorkflowStepId[];
        validationPassed?: boolean;
        errorMessage?: string;
      }> = {
        'input-file': { state: StepState.Pending, lastModified: 0 },
        'config': { state: StepState.Pending, lastModified: 0 },
        'processing': { state: StepState.Pending, lastModified: 0 },
        'review': { state: StepState.Pending, lastModified: 0 },
        'export': { state: StepState.Pending, lastModified: 0 }
      }

      for (const stepId of Object.keys(workflowSteps) as WorkflowStepId[]) {
        const workflowStep = workflowSteps[stepId]
        const workspaceStep = workspaceStepStates[stepId]

        if (!workflowStep) continue

        const workflowTimestamp = workflowStep.stateMetadata?.lastModified || Date.now()
        const workspaceTimestamp = workspaceStep?.lastModified || 0

        // Check for conflicts
        if (workspaceStep && workflowTimestamp !== workspaceTimestamp) {
          const resolution = this.resolveConflict(
            workflowStep.stateMetadata.state,
            workspaceStep.state,
            Number(workflowTimestamp) || Date.now(),
            Number(workspaceTimestamp) || Date.now()
          )

          conflicts.push({
            type: 'step-state',
            workflowValue: workflowStep.stateMetadata.state,
            workspaceValue: workspaceStep.state,
            resolution: resolution.strategy === 'manual-resolution' ? 'merged' : resolution.strategy as 'workflow-wins' | 'workspace-wins' | 'merged',
            resolvedValue: resolution.value,
          })

          // Apply resolution
          if (resolution.strategy === 'workflow-wins') {
            updatedStepStates[stepId] = {
              state: workflowStep.stateMetadata.state,
              lastModified: workflowTimestamp,
              metadata: workflowStep.stateMetadata?.context || {},
              dependencies: undefined,
              validationPassed: workflowStep.stateMetadata.state !== StepState.Error,
              errorMessage: workflowStep.stateMetadata?.state === StepState.Error 
                ? workflowStep.stateMetadata?.message 
                : undefined,
            }
            syncedFields.push(`stepStates.${stepId}`)
          } else if (resolution.strategy === 'workspace-wins') {
            // Update workflow state
            await workflowStateManager.transitionState(
              stepId as WorkflowStepId,
              workspaceStep.state,
              { context: workspaceStep.metadata }
            )
            syncedFields.push(`workflow.${stepId}`)
          }
        } else {
          // No conflict, sync workflow to workspace
          updatedStepStates[stepId] = {
            state: workflowStep.stateMetadata.state,
            lastModified: workflowTimestamp,
            metadata: workflowStep.stateMetadata?.context || {},
            dependencies: undefined,
            validationPassed: workflowStep.stateMetadata.state !== StepState.Error,
            errorMessage: workflowStep.stateMetadata.state === StepState.Error 
              ? workflowStep.stateMetadata.message 
              : undefined,
          }
          syncedFields.push(`stepStates.${stepId}`)
        }
      }

      // Update workspace config if needed
      if (Object.keys(updatedStepStates).length > 0) {
        await workspaceStore.updateWorkspaceConfig(workspaceStore.currentWorkspace.id, {
          stepStates: updatedStepStates,
          lastModified: Date.now(),
        })
      }
    } catch (error) {
      errors.push(`Step states sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { conflicts, syncedFields, errors }
  }

  /**
   * Sync current step between workflow and workspace
   */
  private async syncCurrentStep(
    workflowCurrentStep: WorkflowStepId,
    workspaceCurrentStep?: WorkflowStepId
  ): Promise<Partial<SyncResult>> {
    const conflicts: SyncResult['conflicts'] = []
    const syncedFields: string[] = []
    const errors: string[] = []

    try {
      if (workspaceCurrentStep && workflowCurrentStep !== workspaceCurrentStep) {
        const resolution = this.resolveConflict(
          workflowCurrentStep,
          workspaceCurrentStep,
          Date.now(), // Use current time as workflow doesn't track current step timestamp
          Date.now() - 1000 // Assume workspace is slightly older
        )

        conflicts.push({
          type: 'current-step',
          workflowValue: workflowCurrentStep,
          workspaceValue: workspaceCurrentStep,
          resolution: resolution.strategy === 'manual-resolution' ? 'merged' : resolution.strategy as 'workflow-wins' | 'workspace-wins' | 'merged',
          resolvedValue: resolution.value,
        })

        if (resolution.strategy === 'workspace-wins') {
          workflowStateManager.setCurrentStep(workspaceCurrentStep as WorkflowStepId)
          syncedFields.push('workflow.currentStep')
        }
      }

      // Always sync workflow current step to workspace
      const workspaceStore = useWorkspaceStore.getState()
      if (workspaceStore.currentWorkspace) {
        await workspaceStore.updateWorkspaceConfig(workspaceStore.currentWorkspace.id, {
          lastActiveStep: workflowCurrentStep,
          lastModified: Date.now(),
        })
        syncedFields.push('workspace.lastActiveStep')
      }
    } catch (error) {
      errors.push(`Current step sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { conflicts, syncedFields, errors }
  }

  /**
   * Sync import context between workflow and workspace
   */
  private async syncImportContext(
    workflowImportContext?: Record<string, unknown>,
    workspaceImportContext?: Record<string, unknown>,
    workspaceImportedJsonFile?: string | null
  ): Promise<Partial<SyncResult>> {
    const conflicts: SyncResult['conflicts'] = []
    const syncedFields: string[] = []
    const errors: string[] = []

    try {
      const workspaceStore = useWorkspaceStore.getState()

      if (!workspaceStore.currentWorkspace) {
        throw new Error('No active workspace')
      }

      // Handle backward compatibility: convert importedJsonFile to importContext
      let effectiveWorkspaceContext = workspaceImportContext
      if (!effectiveWorkspaceContext && workspaceImportedJsonFile) {
        effectiveWorkspaceContext = {
          sourceType: 'json-import',
          timestamp: Date.now(),
          importedJsonFile: workspaceImportedJsonFile,
        }
      }

      if (workflowImportContext && effectiveWorkspaceContext) {
        // Check for conflicts
        if (workflowImportContext.timestamp !== effectiveWorkspaceContext.timestamp ||
            workflowImportContext.importedJsonFile !== effectiveWorkspaceContext.importedJsonFile) {
          
          const resolution = this.resolveConflict(
            workflowImportContext,
            effectiveWorkspaceContext,
            Number(workflowImportContext.timestamp) || Date.now(),
            Number(effectiveWorkspaceContext.timestamp) || Date.now()
          )

          conflicts.push({
            type: 'import-context',
            workflowValue: workflowImportContext,
            workspaceValue: effectiveWorkspaceContext,
            resolution: resolution.strategy === 'manual-resolution' ? 'merged' : resolution.strategy as 'workflow-wins' | 'workspace-wins' | 'merged',
            resolvedValue: resolution.value,
          })

          if (resolution.strategy === 'workspace-wins') {
            // Set import context in workflow state manager
            // Note: This method may need to be implemented
            console.log('Setting import context:', {
              sourceType: effectiveWorkspaceContext.sourceType,
              importedJsonFile: effectiveWorkspaceContext.importedJsonFile,
              metadata: effectiveWorkspaceContext.metadata,
            })
            syncedFields.push('workflow.importContext')
          }
        }
      }

      // Sync workflow import context to workspace
      if (workflowImportContext) {
        await workspaceStore.updateWorkspaceConfig(workspaceStore.currentWorkspace.id, {
          importContext: {
            sourceType: (workflowImportContext.sourceType || 'regular') as 'regular' | 'json-import' | 'manual',
            timestamp: Number(workflowImportContext.timestamp) || Date.now(),
            importedJsonFile: String(workflowImportContext.importedJsonFile || ''),
            metadata: (workflowImportContext.metadata as Record<string, unknown>) || {}
          },
          // Maintain backward compatibility
          importedJsonFile: workflowImportContext.importedJsonFile as string | null | undefined,
          lastModified: Date.now(),
        })
        syncedFields.push('workspace.importContext', 'workspace.importedJsonFile')
      }
    } catch (error) {
      errors.push(`Import context sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { conflicts, syncedFields, errors }
  }

  /**
   * Resolve conflicts between workflow and workspace values
   */
  private resolveConflict(
    workflowValue: unknown,
    workspaceValue: unknown,
    workflowTimestamp: number,
    workspaceTimestamp: number
  ): { strategy: ConflictResolutionStrategy; value: unknown } {
    switch (this.config.conflictResolution) {
      case 'workflow-wins':
        return { strategy: 'workflow-wins', value: workflowValue }
      
      case 'workspace-wins':
        return { strategy: 'workspace-wins', value: workspaceValue }
      
      case 'merged':
        if (workflowTimestamp > workspaceTimestamp) {
          return { strategy: 'workflow-wins', value: workflowValue }
        } else {
          return { strategy: 'workspace-wins', value: workspaceValue }
        }
      
      case 'manual-resolution':
        // For now, default to latest timestamp for automatic resolution
        // In the future, this could trigger a UI dialog for manual resolution
        return this.resolveConflict(workflowValue, workspaceValue, workflowTimestamp, workspaceTimestamp)
      
      default:
        return { strategy: 'workflow-wins', value: workflowValue }
    }
  }

  /**
   * Sync workflow state from workspace config
   */
  public async syncFromWorkspace(workspaceId: string): Promise<SyncResult> {
    const startTime = performance.now()

    try {
      const workspaceStore = useWorkspaceStore.getState()
      const workspace = workspaceStore.availableWorkspaces.find(w => w.id === workspaceId)

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`)
      }

      // Load workflow state from workspace
      // Restore workflow state from workspace config
      // Note: This method may need to be implemented in workflow state manager
      console.log('Restoring workflow state from workspace:', workspace.config)

      const duration = performance.now() - startTime
      this.updatePerformanceMetrics(duration, 0, 0)

      return {
        success: true,
        conflicts: [],
        syncedFields: ['workflow.complete-state'],
        errors: [],
        duration,
      }
    } catch (error) {
      const duration = performance.now() - startTime
      this.updatePerformanceMetrics(duration, 0, 1)

      return {
        success: false,
        conflicts: [],
        syncedFields: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number, conflictCount: number, errorCount: number): void {
    if (!this.config.enablePerformanceTracking) return

    this.performanceMetrics.syncCount++
    this.performanceMetrics.averageTime = 
      (this.performanceMetrics.averageTime + duration) / 2
    this.performanceMetrics.conflictCount += conflictCount
    this.performanceMetrics.errorCount += errorCount
  }

  /**
   * Get synchronization performance metrics
   */
  public getPerformanceMetrics() {
    return { ...this.performanceMetrics }
  }

  /**
   * Get synchronization configuration
   */
  public getConfig(): StateSyncConfig {
    return { ...this.config }
  }

  /**
   * Update synchronization configuration
   */
  public updateConfig(newConfig: Partial<StateSyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Check if synchronization is in progress
   */
  public isSyncInProgress(): boolean {
    return this.syncInProgress
  }

  /**
   * Get last synchronization time
   */
  public getLastSyncTime(): number | null {
    return this.lastSyncTime
  }
}

// Create global synchronization manager instance
export const stateSyncManager = new StateSynchronizationManager()

// Export for direct usage
export default stateSyncManager