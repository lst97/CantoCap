/**
 * Diagnostic Test for WorkflowStateManager Subscription System
 * Tests if the atomic operations properly trigger React re-renders
 */

import { workflowStateManager } from '../services/workflow/workflow-state-manager'
import { atomicVideoRemoval } from './step-state-controller'
import { StepState } from '../types/workflow-state'

/**
 * Test function to verify subscription system is working
 * This helps debug the disconnect between atomic operations and UI updates
 */
export async function testSubscriptionSystem(): Promise<void> {
  console.log('🧪 [SUBSCRIPTION TEST] Starting diagnostic test')
  
  // Track subscription events
  let subscriptionEventCount = 0
  let lastEvent: any = null
  
  // Subscribe to all state changes
  const unsubscribe = workflowStateManager.subscribe((event) => {
    subscriptionEventCount++
    lastEvent = event
    console.log('🧪 [SUBSCRIPTION TEST] Event received:', {
      eventNumber: subscriptionEventCount,
      stepId: event.stepId,
      previousState: event.previousState,
      newState: event.newState,
      timestamp: event.timestamp,
      reason: event.metadata?.reason
    })
  })
  
  console.log('🧪 [SUBSCRIPTION TEST] Subscription established')
  
  // Test 1: Direct state transition
  console.log('🧪 [SUBSCRIPTION TEST] Test 1: Direct state transition')
  const beforeDirectTest = subscriptionEventCount
  
  try {
    await workflowStateManager.transitionState('config', StepState.Ready, {
      reason: 'SUBSCRIPTION TEST: Direct transition test'
    })
    
    setTimeout(() => {
      const eventsFromDirectTest = subscriptionEventCount - beforeDirectTest
      console.log('🧪 [SUBSCRIPTION TEST] Test 1 Result:', {
        eventsTriggered: eventsFromDirectTest,
        expectedEvents: 1,
        success: eventsFromDirectTest >= 1
      })
    }, 100)
  } catch (error) {
    console.error('🧪 [SUBSCRIPTION TEST] Test 1 failed:', error)
  }
  
  // Test 2: Atomic operation
  console.log('🧪 [SUBSCRIPTION TEST] Test 2: Atomic operation')
  const beforeAtomicTest = subscriptionEventCount
  
  try {
    await atomicVideoRemoval()
    
    setTimeout(() => {
      const eventsFromAtomicTest = subscriptionEventCount - beforeAtomicTest
      console.log('🧪 [SUBSCRIPTION TEST] Test 2 Result:', {
        eventsTriggered: eventsFromAtomicTest,
        expectedEvents: 5, // Should reset all 5 steps
        success: eventsFromAtomicTest >= 5
      })
      
      // Complete test
      console.log('🧪 [SUBSCRIPTION TEST] Test completed:', {
        totalEvents: subscriptionEventCount,
        lastEvent,
        testsPassed: (subscriptionEventCount - beforeDirectTest) >= 1 && (subscriptionEventCount - beforeAtomicTest) >= 5
      })
      
      // Cleanup
      unsubscribe()
    }, 200)
  } catch (error) {
    console.error('🧪 [SUBSCRIPTION TEST] Test 2 failed:', error)
    unsubscribe()
  }
}

/**
 * Test if useWorkflowState hook is properly subscribed
 * Call this from a React component to verify hook subscription
 */
export function testReactHookSubscription(): void {
  console.log('🧪 [HOOK TEST] Testing React hook subscription')
  
  // This should be called from within a component that uses useWorkflowState
  // It will help identify if the issue is with the WorkflowStateManager or with React hooks
  setTimeout(async () => {
    console.log('🧪 [HOOK TEST] Triggering state change')
    await workflowStateManager.transitionState('input-file', StepState.Ready, {
      reason: 'HOOK TEST: Testing React hook subscription'
    })
  }, 1000)
}