export interface WorkflowStep {
  id: string
  title: string
  description: string
  isCompleted: boolean
  isAccessible: boolean
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
}