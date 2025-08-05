/**
 * Enhanced Workflow State Management Types
 * Replaces boolean flags with enum-based state management for better type safety and clarity
 * 
 * @fileoverview Advanced TypeScript types with branded types, template literals, and strict validation
 * @version 2.0.0
 * @performance Optimized for compile-time type checking and runtime validation
 */

/**
 * Comprehensive step state enum replacing boolean flags
 * Maps to previous flags: isAccessible, isCompleted, isSkipped, hasError
 */
export enum StepState {
  /** Step is ready and accessible for user interaction */
  Ready = 'ready',
  /** Step has been successfully completed */
  Complete = 'complete', 
  /** Step has a critical error preventing completion */
  Error = 'error',
  /** Step has warnings but can still be completed */
  Warning = 'warning',
  /** Step is blocked by incomplete prerequisites */
  Blocked = 'blocked',
  /** Step has been intentionally skipped */
  Skip = 'skip',
  /** Step is pending initialization or processing */
  Pending = 'pending',
  /** Step is currently being processed */
  Processing = 'processing'
}

/**
 * Branded type for step IDs to prevent mixing with regular strings
 * Provides compile-time safety against incorrect string usage
 */
export type StepId = string & { readonly __brand: 'StepId' }

/**
 * Branded type for timestamps to ensure type safety
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' }

/**
 * Branded type for version strings with semantic validation
 */
export type Version = string & { readonly __brand: 'Version' }

/**
 * Template literal type for state transition descriptions
 * Provides compile-time validation of transition naming
 */
export type StateTransitionKey = `${StepState}-to-${StepState}`

/**
 * Advanced type guards for runtime type safety
 */
export namespace TypeGuards {
  /** Type predicate for StepState enum validation */
  export function isStepState(value: unknown): value is StepState {
    return typeof value === 'string' && Object.values(StepState).includes(value as StepState)
  }

  /** Type predicate for StepId validation */
  export function isStepId(value: unknown): value is StepId {
    return typeof value === 'string' && value.length > 0 && /^[a-z]+(-[a-z]+)*$/.test(value)
  }

  /** Type predicate for Timestamp validation */
  export function isTimestamp(value: unknown): value is Timestamp {
    return typeof value === 'number' && value > 0 && Number.isInteger(value)
  }

  /** Type predicate for Version validation (semantic versioning) */
  export function isVersion(value: unknown): value is Version {
    return typeof value === 'string' && /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(value)
  }
}

/**
 * Utility function to create branded StepId with compile-time safety
 */
export function createStepId(id: string): StepId {
  if (!TypeGuards.isStepId(id)) {
    throw new TypeError(`Invalid step ID format: ${id}. Must be lowercase letters with optional hyphens (e.g., 'config', 'input-file').`)
  }
  return id as StepId
}

/**
 * Utility function to create branded Timestamp
 */
export function createTimestamp(time?: number): Timestamp {
  const timestamp = time ?? Date.now()
  if (!TypeGuards.isTimestamp(timestamp)) {
    throw new TypeError(`Invalid timestamp: ${timestamp}`)
  }
  return timestamp as Timestamp
}

/**
 * Utility function to create branded Version
 */
export function createVersion(version: string): Version {
  if (!TypeGuards.isVersion(version)) {
    throw new TypeError(`Invalid version format: ${version}. Must follow semantic versioning.`)
  }
  return version as Version
}

/**
 * Conditional type for state-specific metadata requirements
 * Ensures error states have messages and provides strict typing
 */
type StateSpecificMetadata<T extends StepState> = T extends StepState.Error
  ? { message: string; severity: 'low' | 'medium' | 'high' | 'critical' }
  : T extends StepState.Warning
  ? { message: string; severity: 'low' | 'medium' }
  : T extends StepState.Complete
  ? { completedAt: Timestamp; validationPassed: boolean }
  : T extends StepState.Skip
  ? { skipReason: string; canUndo: boolean }
  : {}

/**
 * Step state metadata for enhanced context and debugging
 * Uses conditional types for state-specific requirements
 */
export interface StepStateMetadata<T extends StepState = StepState> {
  /** Current state of the step */
  readonly state: T
  /** Timestamp when state was last changed */
  readonly lastModified: Timestamp
  /** Optional error message for Error/Warning states */
  readonly message?: string
  /** Context about why state changed */
  readonly reason?: string
  /** Previous state for rollback capability */
  readonly previousState?: StepState
  /** Additional context data */
  readonly context?: Readonly<Record<string, unknown>>
  /** State-specific metadata enforced by conditional types */
  readonly stateSpecific?: StateSpecificMetadata<T>
}

/**
 * Advanced utility types for state transitions
 */
export namespace StateTransitions {
  /** Valid states that can transition to the given state */
  export type ValidSourceStates<T extends StepState> = T extends StepState.Ready
    ? StepState.Blocked | StepState.Error | StepState.Warning | StepState.Complete | StepState.Skip | StepState.Pending
    : T extends StepState.Complete
    ? StepState.Ready | StepState.Warning | StepState.Processing
    : T extends StepState.Error
    ? never // Error states must be manually resolved
    : T extends StepState.Warning
    ? StepState.Ready | StepState.Error | StepState.Processing
    : T extends StepState.Blocked
    ? StepState.Ready | StepState.Complete | StepState.Error | StepState.Pending
    : T extends StepState.Skip
    ? StepState.Ready | StepState.Blocked
    : T extends StepState.Pending
    ? StepState.Ready | StepState.Blocked
    : T extends StepState.Processing
    ? StepState.Ready | StepState.Error
    : never

  /** Valid target states from the given state */
  export type ValidTargetStates<T extends StepState> = T extends StepState.Ready
    ? StepState.Complete | StepState.Error | StepState.Warning | StepState.Blocked | StepState.Skip | StepState.Processing | StepState.Ready
    : T extends StepState.Complete
    ? StepState.Ready | StepState.Error | StepState.Complete | StepState.Blocked
    : T extends StepState.Error
    ? StepState.Ready | StepState.Warning
    : T extends StepState.Warning
    ? StepState.Ready | StepState.Complete | StepState.Error
    : T extends StepState.Blocked
    ? StepState.Ready | StepState.Pending | StepState.Blocked
    : T extends StepState.Skip
    ? StepState.Ready
    : T extends StepState.Pending
    ? StepState.Ready | StepState.Blocked
    : T extends StepState.Processing
    ? StepState.Complete | StepState.Error | StepState.Warning
    : never

  /** Type-safe transition validator */
  export type IsValidTransition<From extends StepState, To extends StepState> = To extends ValidTargetStates<From>
    ? true
    : false
}

/**
 * Complete step definition with enhanced state management
 * Uses generic type parameter for strict state-specific typing
 */
export interface WorkflowStepState<T extends StepState = StepState> {
  readonly id: StepId
  readonly title: string
  readonly description: string
  /** Enhanced state metadata with conditional typing */
  readonly stateMetadata: StepStateMetadata<T>
  /** Required fields for step completion */
  readonly requiredFields?: readonly string[]
  /** Validation rules for step */
  readonly validationRules?: readonly (() => boolean)[]
  /** Import context for JSON imports */
  readonly importContext?: Readonly<{
    sourceType: 'regular' | 'json-import' | 'manual'
    timestamp: Timestamp
    metadata?: Readonly<Record<string, unknown>>
  }>
}

/**
 * Utility type for creating type-safe step states
 */
export type TypedWorkflowStep<T extends StepState> = WorkflowStepState<T>

/**
 * Union type for all possible step states with their specific metadata
 */
export type AnyWorkflowStepState = 
  | WorkflowStepState<StepState.Ready>
  | WorkflowStepState<StepState.Complete>
  | WorkflowStepState<StepState.Error>
  | WorkflowStepState<StepState.Warning>
  | WorkflowStepState<StepState.Blocked>
  | WorkflowStepState<StepState.Skip>
  | WorkflowStepState<StepState.Pending>
  | WorkflowStepState<StepState.Processing>

/**
 * Type for step state factory functions
 */
export type StepStateFactory<T extends StepState> = {
  readonly state: T
  create(
    id: StepId,
    title: string,
    description: string,
    metadata?: Partial<StepStateMetadata<T>>
  ): WorkflowStepState<T>
}

/**
 * Valid state transitions matrix with strict typing
 * Defines which state changes are allowed using conditional types
 */
export interface StateTransitionRule<
  From extends StepState = StepState,
  To extends StepState = StepState
> {
  readonly from: From
  readonly to: To extends StateTransitions.ValidTargetStates<From> ? To : never
  readonly condition?: (step: WorkflowStepState<From>) => boolean
  readonly requiresValidation?: boolean
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * State transition validation result with generic error handling
 */
export interface StateTransitionResult<T = unknown> {
  readonly success: boolean
  readonly error?: string
  readonly errorCode?: string
  readonly rollback?: () => void | Promise<void>
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly result?: T
}

/**
 * Type-safe transition rule factory
 */
export function createTransitionRule<
  From extends StepState,
  To extends StateTransitions.ValidTargetStates<From>
>(rule: StateTransitionRule<From, To>): StateTransitionRule<From, To> {
  return rule
}

/**
 * Workflow state snapshot for persistence and restoration
 * Uses branded types and readonly properties for immutability
 */
export interface WorkflowStateSnapshot {
  /** Current active step ID */
  readonly currentStepId: StepId
  /** Complete step state data with readonly map */
  readonly steps: Readonly<Record<string, AnyWorkflowStepState>>
  /** Snapshot timestamp */
  readonly timestamp: Timestamp
  /** Version for migration compatibility */
  readonly version: Version
  /** Restoration metadata */
  readonly restorationContext?: Readonly<{
    isRestoring: boolean
    restorationSource: 'app-reload' | 'workspace-switch' | 'manual'
    preserveCurrentStep: boolean
    backupData?: Readonly<Record<string, unknown>>
  }>
}

/**
 * Type-safe snapshot factory
 */
export function createWorkflowStateSnapshot(
  currentStepId: StepId,
  steps: Record<string, AnyWorkflowStepState>,
  options?: {
    version?: Version
    restorationContext?: WorkflowStateSnapshot['restorationContext']
  }
): WorkflowStateSnapshot {
  return {
    currentStepId,
    steps: Object.freeze({ ...steps }),
    timestamp: createTimestamp(),
    version: options?.version ?? createVersion('2.0.0'),
    restorationContext: options?.restorationContext
  } as const
}

/**
 * State persistence interface for different storage backends
 */
export interface WorkflowStatePersistence {
  /** Save complete workflow state */
  saveState(snapshot: WorkflowStateSnapshot): Promise<void>
  /** Load workflow state from storage */
  loadState(): Promise<WorkflowStateSnapshot | null>
  /** Clear stored state */
  clearState(): Promise<void>
  /** Check if state exists in storage */
  hasStoredState(): Promise<boolean>
  /** Get storage metadata */
  getStorageInfo(): Promise<{ size: number; lastModified: number }>
}

/**
 * State change event for observers with generic state support
 */
export interface StateChangeEvent<T extends StepState = StepState> {
  readonly stepId: StepId
  readonly previousState: StepState | null
  readonly newState: T
  readonly metadata: StepStateMetadata<T>
  readonly timestamp?: Timestamp
  readonly transitionKey?: StateTransitionKey
  readonly isValid?: boolean
}

/**
 * Workflow state manager configuration
 */
export interface WorkflowStateManagerConfig {
  /** Enable strict state transition validation */
  strictValidation: boolean
  /** Enable state change logging */
  enableLogging: boolean
  /** Maximum number of state history entries to keep */
  maxHistoryEntries: number
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number
  /** Persistence backend */
  persistence?: WorkflowStatePersistence
}

/**
 * State validation error details
 */
export interface StateValidationError {
  stepId: string
  currentState: StepState
  attemptedState: StepState
  reason: string
  code: string
  context?: Record<string, any>
}

/**
 * Batch state operation for atomic updates with strict typing
 */
export interface BatchStateOperation<T extends StepState = StepState> {
  readonly stepId: StepId
  readonly newState: T
  readonly metadata?: Partial<StepStateMetadata<T>>
  readonly validation?: boolean
  readonly priority?: 'low' | 'normal' | 'high' | 'critical'
}

/**
 * Batch operation result with detailed error handling
 */
export interface BatchOperationResult<T = unknown> {
  readonly success: boolean
  readonly results: ReadonlyArray<Readonly<{
    stepId: StepId
    success: boolean
    error?: string
    errorCode?: string
    result?: T
  }>>
  readonly rollback?: () => void | Promise<void>
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Performance-optimized constants using const assertions
 */
export const WORKFLOW_CONSTANTS = {
  /** Default step order with strict typing */
  DEFAULT_STEP_ORDER: ['input-file', 'config', 'processing', 'review', 'export'] as const,
  
  /** State validation patterns */
  VALIDATION_PATTERNS: {
    STEP_ID: /^[a-z]+(-[a-z]+)*$/,
    VERSION: /^\d+\.\d+\.\d+(-[\w.-]+)?$/,
    TIMESTAMP_MIN: 0
  } as const,
  
  /** Performance thresholds */
  PERFORMANCE: {
    MAX_HISTORY_ENTRIES: 100,
    BATCH_SIZE_LIMIT: 50,
    VALIDATION_TIMEOUT: 5000,
    AUTO_SAVE_INTERVAL: 120000  // 2 minutes instead of 30 seconds to reduce re-renders
  } as const,
  
  /** Error codes for type-safe error handling */
  ERROR_CODES: {
    INVALID_TRANSITION: 'INVALID_TRANSITION',
    STEP_NOT_FOUND: 'STEP_NOT_FOUND',
    CONDITION_NOT_MET: 'CONDITION_NOT_MET',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    PERSISTENCE_ERROR: 'PERSISTENCE_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR'
  } as const
} as const

/** Extract types from constants for type safety */
export type DefaultStepId = typeof WORKFLOW_CONSTANTS.DEFAULT_STEP_ORDER[number]
export type ErrorCode = typeof WORKFLOW_CONSTANTS.ERROR_CODES[keyof typeof WORKFLOW_CONSTANTS.ERROR_CODES]
export type Priority = BatchStateOperation['priority']

/**
 * Advanced utility types for improved type inference
 */
export namespace WorkflowTypes {
  /** Extract state from WorkflowStepState */
  export type ExtractState<T> = T extends WorkflowStepState<infer S> ? S : never
  
  /** Create mapped type for all steps with specific state */
  export type StepsWithState<T extends StepState> = Record<DefaultStepId, WorkflowStepState<T>>
  
  /** Type for step state change handlers */
  export type StateChangeHandler<T extends StepState = StepState> = (
    event: StateChangeEvent<T>
  ) => void | Promise<void>
  
  /** Type for validation functions with strict return types */
  export type ValidationFunction<T extends StepState = StepState> = (
    step: WorkflowStepState<T>
  ) => boolean | Promise<boolean>
}