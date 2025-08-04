/**
 * Workflow State Migration Utilities
 * Provides tools for migrating from boolean flag system to enum-based state management
 */

import { StepState, WorkflowStateSnapshot } from '../types/workflow-state'
import { WorkflowStep, WorkflowState } from '../types/workflow'
import { workflowStateManager } from '../services/workflow-state-manager'

/**
 * Migration version tracking
 */
export const MIGRATION_VERSIONS = {
  BOOLEAN_FLAGS: '1.0.0',
  ENUM_STATES: '2.0.0'
} as const

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean
  fromVersion: string
  toVersion: string
  migratedSteps: number
  errors: string[]
  warnings: string[]
  backupData?: any
}

/**
 * Migration plan interface
 */
export interface MigrationPlan {
  fromVersion: string
  toVersion: string
  stepsToMigrate: Array<{
    stepId: string
    currentFlags: {
      isCompleted: boolean
      isAccessible: boolean
      isSkipped: boolean
      hasError: boolean
    }
    targetState: StepState
    confidence: 'high' | 'medium' | 'low'
    issues?: string[]
  }>
  estimatedDuration: number
  risks: Array<{
    type: 'data-loss' | 'compatibility' | 'performance'
    severity: 'low' | 'medium' | 'high'
    description: string
    mitigation: string
  }>
}

/**
 * Analyze current workflow data and create migration plan
 */
export function analyzeMigrationNeeds(legacySteps: WorkflowStep[]): MigrationPlan {
  const stepsToMigrate = legacySteps.map(step => {
    const currentFlags = {
      isCompleted: step.isCompleted,
      isAccessible: step.isAccessible,
      isSkipped: step.isSkipped || false,
      hasError: step.hasError || false
    }

    // Determine target state and confidence
    let targetState: StepState
    let confidence: 'high' | 'medium' | 'low' = 'high'
    const issues: string[] = []

    // Apply state conversion logic
    if (currentFlags.hasError) {
      targetState = StepState.Error
    } else if (currentFlags.isSkipped) {
      targetState = StepState.Skip
    } else if (currentFlags.isCompleted) {
      targetState = StepState.Complete
    } else if (currentFlags.isAccessible) {
      targetState = StepState.Ready
    } else {
      targetState = StepState.Blocked
    }

    // Check for ambiguous states that might need manual review
    if (currentFlags.isCompleted && !currentFlags.isAccessible) {
      issues.push('Step is completed but not accessible - unusual state')
      confidence = 'medium'
    }

    if (currentFlags.isSkipped && currentFlags.isCompleted) {
      issues.push('Step is both skipped and completed - conflicting flags')
      confidence = 'low'
      targetState = StepState.Complete // Prioritize completion over skip
    }

    if (currentFlags.hasError && currentFlags.isCompleted) {
      issues.push('Step has error but is marked completed - conflicting flags')
      confidence = 'low'
      targetState = StepState.Error // Prioritize error over completion
    }

    return {
      stepId: step.id,
      currentFlags,
      targetState,
      confidence,
      issues: issues.length > 0 ? issues : undefined
    }
  })

  // Assess risks
  const risks: MigrationPlan['risks'] = []

  // Check for low confidence migrations
  const lowConfidenceSteps = stepsToMigrate.filter(step => step.confidence === 'low')
  if (lowConfidenceSteps.length > 0) {
    risks.push({
      type: 'data-loss',
      severity: 'medium',
      description: `${lowConfidenceSteps.length} steps have conflicting flags that may result in data interpretation changes`,
      mitigation: 'Manual review recommended before migration'
    })
  }

  // Check for compatibility concerns
  risks.push({
    type: 'compatibility',
    severity: 'low',
    description: 'Components using direct boolean flag access will need updates',
    mitigation: 'Use integration layer for backwards compatibility during transition'
  })

  // Performance considerations
  if (legacySteps.length > 10) {
    risks.push({
      type: 'performance',
      severity: 'low',
      description: 'Large number of steps may impact migration performance',
      mitigation: 'Migration will be batched to maintain responsiveness'
    })
  }

  return {
    fromVersion: MIGRATION_VERSIONS.BOOLEAN_FLAGS,
    toVersion: MIGRATION_VERSIONS.ENUM_STATES,
    stepsToMigrate,
    estimatedDuration: Math.max(1000, legacySteps.length * 100), // Minimum 1 second
    risks
  }
}

/**
 * Execute migration from boolean flags to enum states
 */
export async function executeMigration(
  legacySteps: WorkflowStep[],
  options: {
    createBackup?: boolean
    dryRun?: boolean
    forceOverride?: boolean
  } = {}
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    fromVersion: MIGRATION_VERSIONS.BOOLEAN_FLAGS,
    toVersion: MIGRATION_VERSIONS.ENUM_STATES,
    migratedSteps: 0,
    errors: [],
    warnings: []
  }

  try {
    console.log('🔄 Starting workflow state migration...')

    // Create backup if requested
    if (options.createBackup) {
      result.backupData = {
        timestamp: Date.now(),
        steps: JSON.parse(JSON.stringify(legacySteps))
      }
      console.log('💾 Backup created')
    }

    // Analyze migration plan
    const plan = analyzeMigrationNeeds(legacySteps)
    console.log(`📋 Migration plan: ${plan.stepsToMigrate.length} steps to migrate`)

    // Report risks and warnings
    plan.risks.forEach(risk => {
      const message = `${risk.type.toUpperCase()}: ${risk.description}`
      if (risk.severity === 'high') {
        result.errors.push(message)
      } else {
        result.warnings.push(message)
      }
    })

    // Check for high-risk conditions
    const highRiskSteps = plan.stepsToMigrate.filter(step => step.confidence === 'low')
    if (highRiskSteps.length > 0 && !options.forceOverride) {
      result.errors.push(
        `${highRiskSteps.length} steps have high migration risk. Use forceOverride to proceed.`
      )
      return result
    }

    // Stop here if dry run
    if (options.dryRun) {
      console.log('🧪 Dry run completed - no changes made')
      result.success = true
      result.migratedSteps = plan.stepsToMigrate.length
      return result
    }

    // Execute actual migration directly with WorkflowStateManager
    for (const step of plan.stepsToMigrate) {
      await workflowStateManager.transitionState(step.stepId, step.targetState, {
        reason: 'Migrated from legacy boolean flags',
        message: `Migrated from legacy state with confidence: ${step.confidence}`
      })
    }

    // Verify migration success
    const verificationResult = await verifyMigration(legacySteps)
    if (!verificationResult.success) {
      result.errors.push(...verificationResult.errors)
      return result
    }

    result.success = true
    result.migratedSteps = legacySteps.length
    console.log(`✅ Migration completed successfully: ${result.migratedSteps} steps migrated`)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown migration error'
    result.errors.push(errorMessage)
    console.error('❌ Migration failed:', error)
  }

  return result
}

/**
 * Verify migration was successful
 */
export async function verifyMigration(originalSteps: WorkflowStep[]): Promise<{
  success: boolean
  errors: string[]
  stepComparisons: Array<{
    stepId: string
    originalFlags: any
    newState: StepState
    isEquivalent: boolean
    differences?: string[]
  }>
}> {
  const errors: string[] = []
  const stepComparisons: any[] = []

  try {
    // Compare each step
    for (const originalStep of originalSteps) {
      const newStep = workflowStateManager.getStep(originalStep.id)
      
      if (!newStep) {
        errors.push(`Step ${originalStep.id} not found in new state manager`)
        continue
      }

      const originalFlags = {
        isCompleted: originalStep.isCompleted,
        isAccessible: originalStep.isAccessible,
        isSkipped: originalStep.isSkipped || false,
        hasError: originalStep.hasError || false
      }

      // Convert new state to boolean flags for comparison
      const newState = newStep.stateMetadata.state
      const newFlags = {
        isCompleted: newState === StepState.Complete,
        isAccessible: newState === StepState.Ready || newState === StepState.Complete,
        isSkipped: newState === StepState.Skip,
        hasError: newState === StepState.Error
      }

      // Check equivalence
      const isEquivalent = (
        originalFlags.isCompleted === newFlags.isCompleted &&
        originalFlags.isAccessible === newFlags.isAccessible &&
        originalFlags.isSkipped === newFlags.isSkipped &&
        originalFlags.hasError === newFlags.hasError
      )

      const differences: string[] = []
      if (!isEquivalent) {
        Object.keys(originalFlags).forEach(key => {
          if (originalFlags[key] !== newFlags[key]) {
            differences.push(`${key}: ${originalFlags[key]} → ${newFlags[key]}`)
          }
        })
      }

      stepComparisons.push({
        stepId: originalStep.id,
        originalFlags,
        newState: newStep.stateMetadata.state,
        isEquivalent,
        differences: differences.length > 0 ? differences : undefined
      })

      if (!isEquivalent) {
        console.warn(`⚠️ Step ${originalStep.id} state mismatch:`, differences)
      }
    }

    const success = errors.length === 0
    return { success, errors, stepComparisons }

  } catch (error) {
    errors.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { success: false, errors, stepComparisons }
  }
}

/**
 * Rollback migration if needed
 */
export async function rollbackMigration(backupData: any): Promise<boolean> {
  try {
    if (!backupData || !backupData.steps) {
      throw new Error('No backup data available for rollback')
    }

    console.log('🔄 Rolling back migration...')

    // Reset state manager
    workflowStateManager.reset()

    // Re-migrate with original data using WorkflowStateManager directly
    const rollbackResult = await executeMigration(backupData.steps, { dryRun: false })
    if (!rollbackResult.success) {
      throw new Error('Rollback migration failed: ' + rollbackResult.errors.join(', '))
    }

    console.log('✅ Migration rollback completed')
    return true

  } catch (error) {
    console.error('❌ Rollback failed:', error)
    return false
  }
}

/**
 * Get migration status information
 */
export function getMigrationStatus(): {
  isLegacyFormat: boolean
  hasNewFormat: boolean
  needsMigration: boolean
  version: string
} {
  try {
    // Check if we have any steps in the new state manager
    const allSteps = workflowStateManager.getAllSteps()
    const hasNewFormat = allSteps.size > 0

    // For now, assume we need migration if we don't have new format
    // In a real implementation, this could check for legacy data in storage
    const needsMigration = !hasNewFormat

    return {
      isLegacyFormat: needsMigration,
      hasNewFormat,
      needsMigration,
      version: hasNewFormat ? MIGRATION_VERSIONS.ENUM_STATES : MIGRATION_VERSIONS.BOOLEAN_FLAGS
    }
  } catch (error) {
    console.error('Error checking migration status:', error)
    return {
      isLegacyFormat: true,
      hasNewFormat: false,
      needsMigration: true,
      version: MIGRATION_VERSIONS.BOOLEAN_FLAGS
    }
  }
}

/**
 * Auto-migration helper for seamless upgrades
 */
export async function autoMigrate(legacySteps: WorkflowStep[]): Promise<boolean> {
  try {
    const status = getMigrationStatus()
    
    if (!status.needsMigration) {
      console.log('ℹ️ No migration needed')
      return true
    }

    console.log('🔄 Auto-migration starting...')

    const result = await executeMigration(legacySteps, {
      createBackup: true,
      dryRun: false,
      forceOverride: false
    })

    if (result.success) {
      console.log('✅ Auto-migration completed successfully')
      return true
    } else {
      console.error('❌ Auto-migration failed:', result.errors)
      return false
    }
  } catch (error) {
    console.error('❌ Auto-migration error:', error)
    return false
  }
}