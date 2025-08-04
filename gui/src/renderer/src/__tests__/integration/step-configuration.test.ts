/**
 * Step Configuration Integration Tests
 * 
 * Comprehensive testing of step configuration management including:
 * - Step-to-step data flow and validation
 * - Cross-step dependencies and relationships
 * - Step completion criteria and progression logic
 * - Configuration inheritance and transformation
 * - Validation chain integrity across workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor, renderHook } from '@testing-library/react'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Import system components
import { useWorkspaceStore } from '../../stores/workspace-store'
// Legacy workflow store removed - using WorkflowStateManager directly
import { useSubtitleEditStore } from '../../stores/subtitle-edit-store'

// Import step components for integration testing
import { ReviewStep } from '../../components/steps/ReviewStep'

// Import types
import type { 
  StepConfiguration, 
  WorkspaceConfig,
  StepValidationState,
  StepDependency
} from '../../types/workspace'
import type { WorkflowState, WorkflowStep } from '../../types/workflow'

/**
 * Step Configuration Integration Test Suite
 */
describe('Step Configuration Integration', () => {
  let workspaceStore: ReturnType<typeof useWorkspaceStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let subtitleEditStore: ReturnType<typeof useSubtitleEditStore>

  // Mock APIs
  const mockCantocapAPI = {
    syncWorkspaceConfig: vi.fn(),
    saveStepConfiguration: vi.fn(),
    getStepConfiguration: vi.fn(),
    validateStepConfiguration: vi.fn(),
    getStepDependencies: vi.fn(),
    recordStepTransition: vi.fn(),
    initializeWorkspaceSystem: vi.fn()
  }

  // Test workspace setup
  const testWorkspace = {
    id: 'ws_step_config_test',
    name: 'Step Configuration Test',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastAccessedAt: Date.now()
  }

  beforeAll(() => {
    global.window = {
      cantocapAPI: mockCantocapAPI,
      performance: { now: vi.fn(() => Date.now()) }
    } as any
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Setup default successful responses
    mockCantocapAPI.syncWorkspaceConfig.mockResolvedValue({ success: true })
    mockCantocapAPI.saveStepConfiguration.mockResolvedValue({ success: true })
    mockCantocapAPI.validateStepConfiguration.mockResolvedValue({ isValid: true, errors: [] })
    mockCantocapAPI.getStepDependencies.mockResolvedValue([])
    mockCantocapAPI.recordStepTransition.mockResolvedValue({ success: true })
    mockCantocapAPI.initializeWorkspaceSystem.mockResolvedValue({ success: true })

    // Initialize stores
    const { result: workspaceResult } = renderHook(() => useWorkspaceStore())
    const { result: workflowResult } = renderHook(() => useWorkflowStore())
    const { result: subtitleResult } = renderHook(() => useSubtitleEditStore())
    
    workspaceStore = workspaceResult.current
    workflowStore = workflowResult.current
    subtitleEditStore = subtitleResult.current

    // Setup test workspace
    await act(async () => {
      await workspaceStore.initializeWorkspaces()
      workspaceStore.currentWorkspace = testWorkspace
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    delete (global as any).window
  })

  /**
   * 1. STEP-TO-STEP DATA FLOW AND VALIDATION
   */
  describe('Step-to-Step Data Flow', () => {
    it('should flow data correctly from input → processing → review → export', async () => {
      // Step 1: Input Configuration
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: true,
        data: {
          inputFile: { path: '/test/input.mp4', name: 'input.mp4' },
          language: 'zh',
          translationOptions: {
            sourceLanguage: 'auto',
            targetLanguage: 'zh',
            enableTranslation: true
          }
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
      })

      // Verify input step completion
      expect(workspaceStore.getStepConfiguration('input').isCompleted).toBe(true)

      // Step 2: Processing inherits input data
      await act(async () => {
        workflowStore.setCurrentStep('processing')
      })

      const processingConfig = workspaceStore.getStepConfiguration('processing')
      expect(processingConfig.data?.inputFile).toEqual(inputConfig.data?.inputFile)
      expect(processingConfig.data?.language).toBe('zh')
      expect(processingConfig.data?.translationOptions).toEqual(inputConfig.data?.translationOptions)

      // Complete processing step
      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          ...processingConfig,
          isCompleted: true,
          data: {
            ...processingConfig.data,
            processingProgress: 100,
            outputFile: { path: '/test/output.srt', name: 'output.srt' },
            processingTime: 120000, // 2 minutes
            transcriptionResult: {
              segments: [
                { id: 1, start: 0, end: 2, text: '测试字幕', confidence: 0.95 }
              ],
              language: 'zh',
              confidence: 0.95
            }
          }
        })
      })

      // Step 3: Review inherits processing results
      await act(async () => {
        workflowStore.setCurrentStep('review')
      })

      const reviewConfig = workspaceStore.getStepConfiguration('review')
      expect(reviewConfig.data?.outputFile).toEqual(
        expect.objectContaining({ name: 'output.srt' })
      )
      expect(reviewConfig.data?.transcriptionResult).toBeDefined()
      expect(reviewConfig.data?.transcriptionResult?.segments).toHaveLength(1)

      // Step 4: Export inherits finalized data
      await act(async () => {
        await workspaceStore.updateStepConfiguration('review', {
          ...reviewConfig,
          isCompleted: true,
          data: {
            ...reviewConfig.data,
            reviewedSegments: reviewConfig.data?.transcriptionResult?.segments,
            reviewComments: 'Transcription looks good'
          }
        })
        workflowStore.setCurrentStep('export')
      })

      const exportConfig = workspaceStore.getStepConfiguration('export')
      expect(exportConfig.data?.reviewedSegments).toBeDefined()
      expect(exportConfig.data?.outputFile).toBeDefined()
      expect(exportConfig.data?.reviewComments).toBe('Transcription looks good')

      // Verify complete data lineage
      const dataLineage = workspaceStore.getStepDataLineage()
      expect(dataLineage).toHaveLength(4) // input → processing → review → export
      expect(dataLineage[0].stepId).toBe('input')
      expect(dataLineage[3].stepId).toBe('export')
    })

    it('should handle data transformation between steps', async () => {
      // Setup input with specific format requirements
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: true,
        data: {
          inputFile: { path: '/test/video.mkv', name: 'video.mkv' },
          language: 'en',
          formatOptions: {
            videoCodec: 'h264',
            audioCodec: 'aac',
            resolution: '1920x1080'
          }
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
        workflowStore.setCurrentStep('processing')
      })

      // Processing step should transform format options to processing parameters
      const processingConfig = workspaceStore.getStepConfiguration('processing')
      expect(processingConfig.data?.processingParameters).toBeDefined()
      expect(processingConfig.data?.processingParameters?.audioExtraction).toBe(true)
      expect(processingConfig.data?.processingParameters?.targetSampleRate).toBe(16000)

      // Complete processing with transformation results
      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          ...processingConfig,
          isCompleted: true,
          data: {
            ...processingConfig.data,
            processingProgress: 100,
            audioFile: { path: '/temp/extracted_audio.wav', name: 'extracted_audio.wav' },
            transcriptionResult: {
              segments: [
                { id: 1, start: 0, end: 5, text: 'Hello world', confidence: 0.92 }
              ],
              language: 'en',
              confidence: 0.92
            }
          }
        })
        workflowStore.setCurrentStep('review')
      })

      // Review step should transform segments for editing
      const reviewConfig = workspaceStore.getStepConfiguration('review')
      expect(reviewConfig.data?.editableSegments).toBeDefined()
      expect(reviewConfig.data?.editableSegments?.[0]).toMatchObject({
        id: 1,
        startTime: 0,
        endTime: 5,
        text: 'Hello world',
        isEdited: false,
        originalText: 'Hello world'
      })
    })

    it('should validate cross-step data consistency', async () => {
      // Setup inconsistent data scenario
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: true,
        data: {
          inputFile: { path: '/test/file1.mp4', name: 'file1.mp4' },
          language: 'zh'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
      })

      // Processing step with inconsistent data
      const processingConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/file2.mp4', name: 'file2.mp4' }, // Different file!
          language: 'en' // Different language!
        },
        validationState: { isValid: false, errors: [] },
        lastModified: Date.now()
      }

      // Setup validation to catch inconsistency
      mockCantocapAPI.validateStepConfiguration.mockResolvedValue({
        isValid: false,
        errors: [
          'Input file mismatch with previous step',
          'Language setting inconsistent with input step'
        ]
      })

      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', processingConfig)
      })

      // Verify validation caught the inconsistencies
      const validatedConfig = workspaceStore.getStepConfiguration('processing')
      expect(validatedConfig.validationState.isValid).toBe(false)
      expect(validatedConfig.validationState.errors).toContain('Input file mismatch with previous step')
      expect(validatedConfig.validationState.errors).toContain('Language setting inconsistent with input step')

      // Verify step cannot be completed with invalid data
      expect(workflowStore.canProgressToNextStep()).toBe(false)
    })
  })

  /**
   * 2. CROSS-STEP DEPENDENCIES AND RELATIONSHIPS
   */
  describe('Cross-Step Dependencies', () => {
    it('should enforce step dependencies and prerequisites', async () => {
      // Setup dependency chain
      const dependencies: StepDependency[] = [
        {
          stepId: 'processing',
          dependsOn: ['input'],
          requiredData: ['inputFile', 'language'],
          validationRules: ['inputFile.exists', 'language.supported']
        },
        {
          stepId: 'review',
          dependsOn: ['processing'],
          requiredData: ['transcriptionResult', 'outputFile'],
          validationRules: ['transcriptionResult.hasSegments', 'outputFile.readable']
        },
        {
          stepId: 'export',
          dependsOn: ['review'],
          requiredData: ['reviewedSegments'],
          validationRules: ['reviewedSegments.validated']
        }
      ]

      mockCantocapAPI.getStepDependencies.mockResolvedValue(dependencies)

      // Attempt to jump to processing without completing input
      workflowStore.setCurrentStep('input')
      
      const canSkipToProcessing = await act(async () => {
        return await workspaceStore.canProgressToStep('processing')
      })

      expect(canSkipToProcessing).toBe(false)

      // Complete input step
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', {
          stepId: 'input',
          workspaceId: testWorkspace.id,
          isCompleted: true,
          data: {
            inputFile: { path: '/test/valid.mp4', name: 'valid.mp4' },
            language: 'zh'
          },
          validationState: { isValid: true, errors: [] },
          lastModified: Date.now()
        })
      })

      // Now should be able to progress to processing
      const canProgressNow = await act(async () => {
        return await workspaceStore.canProgressToStep('processing')
      })

      expect(canProgressNow).toBe(true)

      // But still cannot skip to review
      const canSkipToReview = await act(async () => {
        return await workspaceStore.canProgressToStep('review')
      })

      expect(canSkipToReview).toBe(false)
    })

    it('should handle circular dependency detection', async () => {
      // Setup circular dependencies (should be prevented)
      const circularDependencies: StepDependency[] = [
        {
          stepId: 'processing',
          dependsOn: ['review'], // Circular: processing depends on review
          requiredData: ['reviewedData'],
          validationRules: []
        },
        {
          stepId: 'review',
          dependsOn: ['processing'], // Circular: review depends on processing
          requiredData: ['transcriptionResult'],
          validationRules: []
        }
      ]

      mockCantocapAPI.getStepDependencies.mockResolvedValue(circularDependencies)

      // Should detect and prevent circular dependencies
      const dependencyValidation = await act(async () => {
        return await workspaceStore.validateStepDependencies()
      })

      expect(dependencyValidation.isValid).toBe(false)
      expect(dependencyValidation.errors).toContain('Circular dependency detected')
      expect(dependencyValidation.circularDependencies).toEqual(['processing', 'review'])
    })

    it('should handle optional dependencies gracefully', async () => {
      // Setup dependencies with optional requirements
      const optionalDependencies: StepDependency[] = [
        {
          stepId: 'export',
          dependsOn: ['review'],
          requiredData: ['transcriptionResult'],
          optionalData: ['reviewComments', 'qualityScore'],
          validationRules: ['transcriptionResult.exists']
        }
      ]

      mockCantocapAPI.getStepDependencies.mockResolvedValue(optionalDependencies)

      // Complete review with only required data
      await act(async () => {
        await workspaceStore.updateStepConfiguration('review', {
          stepId: 'review',
          workspaceId: testWorkspace.id,
          isCompleted: true,
          data: {
            transcriptionResult: {
              segments: [{ id: 1, start: 0, end: 2, text: 'Test', confidence: 0.9 }],
              language: 'zh',
              confidence: 0.9
            }
            // Missing optional: reviewComments, qualityScore
          },
          validationState: { isValid: true, errors: [] },
          lastModified: Date.now()
        })
      })

      // Should be able to progress to export despite missing optional data
      const canProgressToExport = await act(async () => {
        return await workspaceStore.canProgressToStep('export')
      })

      expect(canProgressToExport).toBe(true)

      // But export step should handle missing optional data gracefully
      await act(async () => {
        workflowStore.setCurrentStep('export')
      })

      const exportConfig = workspaceStore.getStepConfiguration('export')
      expect(exportConfig.data?.transcriptionResult).toBeDefined()
      expect(exportConfig.data?.reviewComments).toBeUndefined()
      expect(exportConfig.data?.qualityScore).toBeUndefined()
    })
  })

  /**
   * 3. STEP COMPLETION CRITERIA AND PROGRESSION LOGIC
   */
  describe('Step Completion and Progression', () => {
    it('should enforce step completion criteria before allowing progression', async () => {
      // Setup step with specific completion criteria
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/input.mp4', name: 'input.mp4' }
          // Missing required: language
        },
        validationState: { 
          isValid: false, 
          errors: ['Language is required for transcription'] 
        },
        completionCriteria: {
          required: ['inputFile', 'language'],
          validationRules: ['inputFile.accessible', 'language.supported']
        },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
      })

      // Should not be able to progress with incomplete criteria
      expect(workflowStore.canProgressToNextStep()).toBe(false)

      // Complete the required data
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', {
          ...inputConfig,
          data: {
            ...inputConfig.data,
            language: 'zh' // Add required language
          },
          validationState: { isValid: true, errors: [] },
          isCompleted: true
        })
      })

      // Now should be able to progress
      await waitFor(() => {
        expect(workflowStore.canProgressToNextStep()).toBe(true)
      })
    })

    it('should handle dynamic completion criteria based on user choices', async () => {
      // Setup processing step with dynamic criteria based on processing type
      const processingConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/input.mp4', name: 'input.mp4' },
          language: 'zh',
          processingType: 'transcription_and_translation'
        },
        validationState: { isValid: false, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', processingConfig)
      })

      // Completion criteria should be updated based on processing type
      const criteria = workspaceStore.getStepCompletionCriteria('processing')
      expect(criteria.required).toContain('transcriptionResult')
      expect(criteria.required).toContain('translationResult') // Added for translation type
      expect(criteria.validationRules).toContain('translationResult.quality')

      // Complete with all required data for translation type
      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', {
          ...processingConfig,
          isCompleted: true,
          data: {
            ...processingConfig.data,
            processingProgress: 100,
            transcriptionResult: {
              segments: [{ id: 1, start: 0, end: 2, text: '你好', confidence: 0.95 }],
              language: 'zh',
              confidence: 0.95
            },
            translationResult: {
              segments: [{ id: 1, start: 0, end: 2, text: 'Hello', confidence: 0.9 }],
              targetLanguage: 'en',
              confidence: 0.9
            }
          },
          validationState: { isValid: true, errors: [] }
        })
      })

      expect(workspaceStore.getStepConfiguration('processing').isCompleted).toBe(true)
    })

    it('should track step progression history and allow rollback', async () => {
      // Progress through multiple steps
      const steps = ['input', 'processing', 'review']
      
      for (const stepId of steps) {
        await act(async () => {
          await workspaceStore.updateStepConfiguration(stepId, {
            stepId,
            workspaceId: testWorkspace.id,
            isCompleted: true,
            data: { [`${stepId}Data`]: true },
            validationState: { isValid: true, errors: [] },
            lastModified: Date.now()
          })
          workflowStore.setCurrentStep(stepId as WorkflowStep)
        })
      }

      // Verify progression history
      const progressionHistory = workspaceStore.getStepProgressionHistory()
      expect(progressionHistory).toHaveLength(3)
      expect(progressionHistory.map(h => h.stepId)).toEqual(['input', 'processing', 'review'])

      // Rollback to processing step
      await act(async () => {
        await workspaceStore.rollbackToStep('processing')
      })

      // Verify rollback
      expect(workflowStore.currentStep).toBe('processing')
      expect(workspaceStore.getStepConfiguration('review').isCompleted).toBe(false)

      // Verify progression history updated
      const updatedHistory = workspaceStore.getStepProgressionHistory()
      expect(updatedHistory).toHaveLength(2) // Only input and processing
    })
  })

  /**
   * 4. CONFIGURATION INHERITANCE AND TRANSFORMATION
   */
  describe('Configuration Inheritance and Transformation', () => {
    it('should inherit base configuration with step-specific overrides', async () => {
      // Setup base workspace configuration
      const baseConfig: WorkspaceConfig = {
        workspaceId: testWorkspace.id,
        language: 'zh',
        inputFile: { path: '/test/base.mp4', name: 'base.mp4' },
        outputFile: null,
        translationOptions: {
          sourceLanguage: 'auto',
          targetLanguage: 'zh',
          enableTranslation: true
        },
        processingOptions: {
          audioQuality: 'high',
          processingSpeed: 'balanced'
        }
      }

      await act(async () => {
        await workspaceStore.updateWorkspaceConfig(baseConfig)
      })

      // Create step configuration that inherits and overrides
      const processingStepConfig: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          // Inherited from base
          inputFile: baseConfig.inputFile,
          language: baseConfig.language,
          translationOptions: baseConfig.translationOptions,
          
          // Step-specific overrides
          processingOptions: {
            ...baseConfig.processingOptions,
            processingSpeed: 'fast' // Override for this step
          },
          
          // Step-specific additions
          processingProgress: 0,
          estimatedTimeRemaining: 300
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('processing', processingStepConfig)
      })

      // Verify inheritance and override
      const stepConfig = workspaceStore.getStepConfiguration('processing')
      expect(stepConfig.data?.language).toBe('zh') // Inherited
      expect(stepConfig.data?.processingOptions?.audioQuality).toBe('high') // Inherited
      expect(stepConfig.data?.processingOptions?.processingSpeed).toBe('fast') // Overridden
      expect(stepConfig.data?.processingProgress).toBe(0) // Step-specific
    })

    it('should transform configuration formats between steps', async () => {
      // Input step uses user-friendly format
      const inputConfig: StepConfiguration = {
        stepId: 'input',
        workspaceId: testWorkspace.id,
        isCompleted: true,
        data: {
          inputFile: { path: '/test/video.mp4', name: 'video.mp4' },
          language: 'Chinese (Simplified)',
          outputFormat: 'SubRip (.srt)',
          quality: 'High Quality'
        },
        validationState: { isValid: true, errors: [] },
        lastModified: Date.now()
      }

      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', inputConfig)
        workflowStore.setCurrentStep('processing')
      })

      // Processing step should transform to API-friendly format
      const processingConfig = workspaceStore.getStepConfiguration('processing')
      expect(processingConfig.data?.language).toBe('zh') // Transformed from display name
      expect(processingConfig.data?.outputFormat).toBe('srt') // Transformed from display format
      expect(processingConfig.data?.qualitySettings).toEqual({
        audioSampleRate: 16000,
        audioChannels: 1,
        processingAccuracy: 'high'
      }) // Transformed from user-friendly setting
    })

    it('should handle configuration migration between versions', async () => {
      // Simulate old configuration format
      const oldFormatConfig = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        version: 1, // Old version
        data: {
          file: '/test/old.mp4', // Old field name
          lang: 'zh', // Old field name
          settings: { speed: 'normal' } // Old structure
        }
      }

      // Should migrate to new format
      await act(async () => {
        await workspaceStore.migrateStepConfiguration(oldFormatConfig as any)
      })

      const migratedConfig = workspaceStore.getStepConfiguration('processing')
      expect(migratedConfig.version).toBe(2) // Updated version
      expect(migratedConfig.data?.inputFile?.path).toBe('/test/old.mp4') // Migrated field
      expect(migratedConfig.data?.language).toBe('zh') // Migrated field
      expect(migratedConfig.data?.processingOptions?.processingSpeed).toBe('normal') // Migrated structure
    })
  })

  /**
   * 5. VALIDATION CHAIN INTEGRITY
   */
  describe('Validation Chain Integrity', () => {
    it('should maintain validation integrity across step transitions', async () => {
      // Setup validation chain
      const validationChain = [
        {
          stepId: 'input',
          validators: ['file.exists', 'file.readable', 'language.supported']
        },
        {
          stepId: 'processing',
          validators: ['input.validated', 'processing.configured', 'resources.available']
        },
        {
          stepId: 'review',
          validators: ['processing.completed', 'output.generated', 'segments.exist']
        }
      ]

      // Complete input with validation
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', {
          stepId: 'input',
          workspaceId: testWorkspace.id,
          isCompleted: true,
          data: {
            inputFile: { path: '/test/valid.mp4', name: 'valid.mp4' },
            language: 'zh'
          },
          validationState: { 
            isValid: true, 
            errors: [],
            validatedRules: ['file.exists', 'file.readable', 'language.supported']
          },
          lastModified: Date.now()
        })
      })

      // Progress to processing - should inherit validation context
      await act(async () => {
        workflowStore.setCurrentStep('processing')
      })

      const processingConfig = workspaceStore.getStepConfiguration('processing')
      expect(processingConfig.validationState.inheritedValidation).toBeDefined()
      expect(processingConfig.validationState.inheritedValidation?.['input']).toEqual([
        'file.exists', 'file.readable', 'language.supported'
      ])

      // Break validation chain by modifying input
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', {
          stepId: 'input',
          workspaceId: testWorkspace.id,
          isCompleted: true,
          data: {
            inputFile: { path: '/test/invalid.mp4', name: 'invalid.mp4' }, // Changed file!
            language: 'zh'
          },
          validationState: { 
            isValid: false, 
            errors: ['File not accessible'],
            invalidatedRules: ['file.exists']
          },
          lastModified: Date.now()
        })
      })

      // Processing should detect broken validation chain
      await waitFor(() => {
        const updatedProcessingConfig = workspaceStore.getStepConfiguration('processing')
        expect(updatedProcessingConfig.validationState.chainBroken).toBe(true)
        expect(updatedProcessingConfig.validationState.brokenReason).toContain('Input validation failed')
      })

      // Should not be able to progress with broken chain
      expect(workflowStore.canProgressToNextStep()).toBe(false)
    })

    it('should re-validate dependent steps when prerequisite changes', async () => {
      // Setup completed workflow
      const steps = ['input', 'processing', 'review']
      
      for (let i = 0; i < steps.length; i++) {
        await act(async () => {
          await workspaceStore.updateStepConfiguration(steps[i], {
            stepId: steps[i],
            workspaceId: testWorkspace.id,
            isCompleted: true,
            data: { [`${steps[i]}Data`]: `completed-${i}` },
            validationState: { isValid: true, errors: [] },
            lastModified: Date.now()
          })
        })
      }

      // Modify input step (prerequisite)
      await act(async () => {
        await workspaceStore.updateStepConfiguration('input', {
          stepId: 'input',
          workspaceId: testWorkspace.id,
          isCompleted: true,
          data: { 
            inputData: 'modified',
            language: 'en' // Changed language
          },
          validationState: { isValid: true, errors: [] },
          lastModified: Date.now()
        })
      })

      // Should trigger re-validation of dependent steps
      await waitFor(() => {
        const processingConfig = workspaceStore.getStepConfiguration('processing')
        const reviewConfig = workspaceStore.getStepConfiguration('review')
        
        expect(processingConfig.validationState.revalidationRequired).toBe(true)
        expect(reviewConfig.validationState.revalidationRequired).toBe(true)
      })

      // Re-validation should be called for affected steps
      expect(mockCantocapAPI.validateStepConfiguration).toHaveBeenCalledWith('processing', expect.any(Object))
      expect(mockCantocapAPI.validateStepConfiguration).toHaveBeenCalledWith('review', expect.any(Object))
    })

    it('should handle validation timeouts and recovery', async () => {
      // Setup validation timeout scenario
      mockCantocapAPI.validateStepConfiguration.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), 5000)
        )
      )

      const config: StepConfiguration = {
        stepId: 'processing',
        workspaceId: testWorkspace.id,
        isCompleted: false,
        data: {
          inputFile: { path: '/test/large.mp4', name: 'large.mp4' },
          language: 'zh'
        },
        validationState: { isValid: false, errors: [] },
        lastModified: Date.now()
      }

      // Should handle timeout gracefully
      const result = await act(async () => {
        try {
          return await workspaceStore.updateStepConfiguration('processing', config)
        } catch (error) {
          return { success: false, error }
        }
      })

      expect(result.success).toBe(false)
      
      const stepConfig = workspaceStore.getStepConfiguration('processing')
      expect(stepConfig.validationState.validationTimeout).toBe(true)
      expect(stepConfig.validationState.canRetryValidation).toBe(true)

      // Setup successful retry
      mockCantocapAPI.validateStepConfiguration.mockResolvedValue({
        isValid: true,
        errors: []
      })

      // Retry validation
      await act(async () => {
        await workspaceStore.retryStepValidation('processing')
      })

      const retryConfig = workspaceStore.getStepConfiguration('processing')
      expect(retryConfig.validationState.isValid).toBe(true)
      expect(retryConfig.validationState.validationTimeout).toBe(false)
    })
  })
})