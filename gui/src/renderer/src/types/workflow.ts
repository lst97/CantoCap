export interface WorkflowStep {
  id: string
  title: string
  description: string
  isCompleted: boolean
  isAccessible: boolean
  isSkipped?: boolean
  hasError?: boolean
  errorMessage?: string
  requiredFields?: string[]
  validationRules?: (() => boolean)[]
}

export interface WorkflowState {
  currentStep: string
  steps: WorkflowStep[]
  canProgress: (stepId: string) => boolean
  setCurrentStep: (stepId: string) => void
  completeStep: (stepId: string) => void
  validateStep: (stepId: string) => boolean
  getNextAccessibleStep: (stepId: string) => string | null
  disableStep: (stepId: string) => void
  resetWorkflowFromStep: (fromStepId: string) => void
  skipToStep: (stepId: string) => void
  markStepAsSkipped: (stepId: string) => void
  skipStepsAndNavigate: (skipStepIds: string[], targetStepId: string) => void
  resetStepsFromRange: (fromStepId: string, toStepId?: string) => void
  markStepAsError: (stepId: string, errorMessage?: string) => void
  clearStepError: (stepId: string) => void
}