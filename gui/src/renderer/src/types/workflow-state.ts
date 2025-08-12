// Placeholder workflow state types during migration
// TODO: Update with new Zustand store types

export enum StepState {
  Pending = 'pending',
  InProgress = 'in_progress',
  Complete = 'completed',
  Blocked = 'blocked'
}

export interface WorkflowStepState {
  id: string
  state: StepState
  data?: any
}

export interface AnyWorkflowStepState extends WorkflowStepState {}

export interface StateChangeEvent {
  stepId: string
  oldState: StepState
  newState: StepState
  reason?: string
}