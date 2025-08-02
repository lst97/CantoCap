# Zustand Store Optimization Strategy

## Zustand 5.0.6 Performance Patterns Implementation

### Overview
This document outlines specific Zustand 5.0.6 optimization patterns to resolve the P0 infinite re-render incident and implement state management efficiency improvements.

---

## Critical Issue Analysis

### Root Cause: State Update Cascades

**Current Problem Pattern:**
```typescript
// PROBLEMATIC: subtitle-edit-store.ts lines 154-158
const triggerAutoSaveCallback = async (store: SubtitleEditStore, action: string) => {
  // Auto-save functionality disabled for performance improvements
  console.log(`📝 Action recorded (auto-save disabled): ${action}`);
}

// PROBLEMATIC: ReviewStep.tsx useEffect dependency chain
useEffect(() => {
  const callback = (subtitles: any[], action: string) => {
    // This creates circular updates
    autoSaveIntegration.forceSave().catch((error) => {
      console.error('Auto-save failed:', error);
    });
  };
  setAutoSaveCallback(callback);
}, []); // But dependencies change, causing re-creation
```

**Impact**: Each subtitle modification triggers multiple store updates leading to infinite re-render loops.

---

## Zustand 5.0.6 Specific Optimizations

### 1. Stable Action References Pattern

```typescript
// SOLUTION: Implement stable action references
export const useSubtitleEditStore = create<SubtitleEditStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        // Create stable action references that won't cause re-renders
        const stableActions = {
          updateSubtitle: (subtitleId: string, updates: Partial<SubtitleEntry>) => {
            const state = get()
            if (!state.session) return

            // Batch state updates to prevent cascade
            set((currentState) => {
              const newSubtitles = [...currentState.session!.currentSubtitles]
              const index = newSubtitles.findIndex(s => s.id === subtitleId)
              
              if (index === -1) return currentState

              // Single atomic update
              newSubtitles[index] = { ...newSubtitles[index], ...updates }
              
              return {
                session: {
                  ...currentState.session!,
                  currentSubtitles: newSubtitles,
                  isDirty: true,
                  lastModified: new Date()
                }
              }
            })
            
            // Async operations after state update
            const postUpdateActions = async () => {
              const updatedState = get()
              if (updatedState.autoSaveCallback && updatedState.session) {
                // Call without triggering re-render
                updatedState.autoSaveCallback(
                  updatedState.session.currentSubtitles, 
                  'updateSubtitle'
                )
              }
            }
            
            // Execute async without blocking
            postUpdateActions().catch(console.error)
          }
        }

        return {
          // State
          session: null,
          edits: [],
          isLoading: false,
          error: null,
          
          // Stable actions
          ...stableActions
        }
      },
      {
        name: 'subtitle-edit-store',
        // Optimized partialize to reduce persistence overhead
        partialize: (state) => ({
          session: state.session ? {
            sessionId: state.session.sessionId,
            workspaceId: state.session.workspaceId,
            isDirty: state.session.isDirty,
            subtitleCount: state.session.currentSubtitles?.length || 0
          } : null
        })
      }
    )
  )
)
```

### 2. Selective Subscription Pattern

```typescript
// SOLUTION: Granular subscriptions to prevent unnecessary re-renders
export const useSubtitleSession = () => {
  return useSubtitleEditStore(
    useCallback((state) => ({
      session: state.session,
      isLoading: state.isLoading,
      error: state.error
    }), []),
    shallow
  )
}

export const useSubtitleEditing = () => {
  return useSubtitleEditStore(
    useCallback((state) => ({
      updateSubtitle: state.updateSubtitle,
      addSubtitle: state.addSubtitle,
      deleteSubtitle: state.deleteSubtitle,
      undoStack: state.undoStack,
      redoStack: state.redoStack
    }), []),
    shallow
  )
}

export const useSubtitlePersistence = () => {
  return useSubtitleEditStore(
    useCallback((state) => ({
      manualSaveToIndexedDB: state.manualSaveToIndexedDB,
      isSaving: state.isSaving,
      saveError: state.saveError,
      lastManualSave: state.lastManualSave
    }), []),
    shallow
  )
}
```

### 3. Async State Updates Pattern

```typescript
// SOLUTION: Non-blocking async operations
const asyncInitializeSession = async (
  subtitlePath: string, 
  videoPath: string, 
  workspaceId: string, 
  importedData?: any[]
) => {
  // Immediate state update for UI responsiveness
  set({ isLoading: true, error: null })
  
  try {
    // Parallel async operations
    const [sessionData, cleanupResult] = await Promise.allSettled([
      createSessionData(subtitlePath, videoPath, workspaceId, importedData),
      cleanupWorkspaceSession(workspaceId)
    ])
    
    if (sessionData.status === 'fulfilled') {
      // Update state with session data
      set({ 
        session: sessionData.value, 
        isLoading: false 
      })
      
      // Background IndexedDB operations (non-blocking)
      saveOriginalSubtitles(workspaceId, sessionData.value.sessionId, sessionData.value.originalSubtitles)
        .catch(error => {
          console.warn('Background save failed:', error)
          // Update error state if needed, but don't block UI
          set(state => ({ 
            ...state, 
            error: 'Auto-save unavailable, manual save required' 
          }))
        })
    } else {
      throw sessionData.reason
    }
  } catch (error) {
    set({ 
      isLoading: false, 
      error: error instanceof Error ? error.message : 'Session initialization failed' 
    })
  }
}
```

### 4. Debounced State Updates Pattern

```typescript
// SOLUTION: Debounced updates to prevent rapid-fire state changes
import { debounce } from '../utils/performance-utils'

const createDebouncedActions = (set, get) => {
  const debouncedSave = debounce(async (sessionData) => {
    try {
      await saveModifiedSubtitles(
        sessionData.workspaceId,
        sessionData.sessionId,
        sessionData.currentSubtitles
      )
      
      set(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          isDirty: false,
          lastModified: new Date()
        } : null,
        lastAutoSave: new Date()
      }))
    } catch (error) {
      console.error('Debounced save failed:', error)
    }
  }, 2000) // 2 second debounce

  return {
    debouncedAutoSave: (session) => {
      if (session?.isDirty) {
        debouncedSave(session)
      }
    }
  }
}
```

### 5. Performance Monitoring Integration

```typescript
// SOLUTION: Built-in performance monitoring for Zustand operations
const performanceMiddleware = (config) => (set, get, api) => {
  const performanceTracker = PerformanceMonitor.getInstance()
  
  return config(
    (...args) => {
      const operationStart = performance.now()
      const result = set(...args)
      const duration = performance.now() - operationStart
      
      // Track slow operations
      if (duration > 10) {
        performanceTracker.recordSlowOperation('zustand-update', duration)
        console.warn(`🐌 Slow Zustand update: ${duration.toFixed(2)}ms`)
      }
      
      return result
    },
    get,
    api
  )
}

// Apply middleware
export const useSubtitleEditStore = create<SubtitleEditStore>()(
  performanceMiddleware(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Store implementation
        }),
        persistConfig
      )
    )
  )
)
```

---

## Store Architecture Improvements

### 1. Store Slicing for Better Performance

```typescript
// Split large subtitle-edit-store into focused slices
export const useSubtitleSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  initializeSession: async (params) => {
    // Session-specific logic only
  },
  clearSession: () => {
    set({ session: null })
  }
}))

export const useSubtitleEditingStore = create<EditingState>()((set, get) => ({
  edits: [],
  undoStack: [],
  redoStack: [],
  updateSubtitle: (id, updates) => {
    // Editing-specific logic only
  }
}))

export const useSubtitlePersistenceStore = create<PersistenceState>()(
  persist(
    (set, get) => ({
      isSaving: false,
      saveError: null,
      manualSave: async () => {
        // Persistence-specific logic only
      }
    }),
    {
      name: 'subtitle-persistence',
      partialize: (state) => ({
        // Only persist what's necessary
        lastSaveTime: state.lastSaveTime
      })
    }
  )
)
```

### 2. Cross-Store Communication Pattern

```typescript
// SOLUTION: Event-driven cross-store communication
export const storeEventBus = {
  emit: (event: string, data: any) => {
    document.dispatchEvent(new CustomEvent(`store:${event}`, { detail: data }))
  },
  
  listen: (event: string, callback: (data: any) => void) => {
    const handler = (e: CustomEvent) => callback(e.detail)
    document.addEventListener(`store:${event}`, handler)
    return () => document.removeEventListener(`store:${event}`, handler)
  }
}

// In subtitle session store
const sessionStore = create<SessionState>()((set, get) => ({
  session: null,
  updateSession: (updates) => {
    set(state => {
      const newSession = { ...state.session, ...updates }
      
      // Emit event for other stores
      storeEventBus.emit('session:updated', newSession)
      
      return { session: newSession }
    })
  }
}))

// In persistence store
const persistenceStore = create<PersistenceState>()((set, get) => {
  // Listen for session updates
  storeEventBus.listen('session:updated', (session) => {
    if (session.isDirty) {
      get().debouncedAutoSave(session)
    }
  })

  return {
    // Store state and actions
  }
})
```

---

## Component Integration Patterns

### 1. Optimized ReviewStep Component

```typescript
// SOLUTION: Prevent infinite re-renders in ReviewStep
const ReviewStepComponent: React.FC = () => {
  // Use selective subscriptions
  const { session, isLoading, error } = useSubtitleSession()
  const { updateSubtitle, addSubtitle } = useSubtitleEditing()
  const { manualSave, isSaving } = useSubtitlePersistence()
  
  // Stable callback reference
  const stableCallbackRef = useRef<((subtitles: any[], action: string) => void) | null>(null)
  
  // Create callback only once
  useEffect(() => {
    if (stableCallbackRef.current) return
    
    stableCallbackRef.current = (subtitles: any[], action: string) => {
      // This won't trigger re-renders because it's stable
      console.log(`Action: ${action}, Count: ${subtitles.length}`)
    }
    
    // Set callback in store
    useSubtitleEditStore.getState().setAutoSaveCallback(stableCallbackRef.current)
    
    return () => {
      useSubtitleEditStore.getState().setAutoSaveCallback(null)
      stableCallbackRef.current = null
    }
  }, []) // Empty dependency array - truly stable
  
  // Memoized subtitle data to prevent unnecessary recalculations
  const preparedSubtitleData = useMemo(() => {
    if (!session?.currentSubtitles) return null
    
    return session.currentSubtitles.map(subtitle => ({
      ...subtitle,
      // Any transformations needed
    }))
  }, [session?.currentSubtitles])
  
  // Rest of component logic
}
```

### 2. Optimized Auto-Save Integration

```typescript
// SOLUTION: Stable auto-save integration
export function useOptimizedAutoSave() {
  const sessionState = useSubtitleSession()
  const persistenceActions = useSubtitlePersistence()
  
  // Stable debounced save function
  const debouncedSave = useMemo(
    () => debounce(async (session) => {
      if (session?.isDirty) {
        await persistenceActions.manualSave()
      }
    }, 2000),
    [persistenceActions.manualSave]
  )
  
  // Watch for session changes
  useEffect(() => {
    if (sessionState.session?.isDirty) {
      debouncedSave(sessionState.session)
    }
  }, [sessionState.session?.isDirty, sessionState.session?.lastModified, debouncedSave])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel?.()
    }
  }, [debouncedSave])
}
```

---

## Migration Strategy

### Phase 1: Immediate Fixes (Week 1)
1. **Implement stable callback references** in ReviewStep component
2. **Add performance monitoring middleware** to existing stores
3. **Replace broad subscriptions** with selective subscriptions
4. **Implement debounced auto-save** pattern

### Phase 2: Architecture Improvements (Week 2-3)
1. **Split subtitle-edit-store** into focused slices
2. **Implement async state update patterns**
3. **Add cross-store communication system**
4. **Optimize persist middleware configuration**

### Phase 3: Advanced Optimizations (Week 4)
1. **Add Web Worker integration** for IndexedDB operations
2. **Implement state normalization** for large datasets
3. **Add performance budgets** and automated monitoring
4. **Complete testing and validation**

---

## Testing Strategy

### Performance Tests
```typescript
describe('Zustand Store Performance', () => {
  it('should handle 1000 subtitle updates under 100ms', async () => {
    const store = useSubtitleEditStore.getState()
    const start = performance.now()
    
    for (let i = 0; i < 1000; i++) {
      store.updateSubtitle(`subtitle-${i}`, { text: `Updated ${i}` })
    }
    
    expect(performance.now() - start).toBeLessThan(100)
  })
  
  it('should prevent infinite re-render loops', () => {
    const renderCount = jest.fn()
    const TestComponent = () => {
      renderCount()
      const { session } = useSubtitleSession()
      return <div>{session?.sessionId}</div>
    }
    
    render(<TestComponent />)
    
    // Trigger state update
    act(() => {
      useSubtitleEditStore.getState().updateSubtitle('test', { text: 'update' })
    })
    
    // Should only render twice: initial + after update
    expect(renderCount).toHaveBeenCalledTimes(2)
  })
})
```

### Memory Leak Tests
```typescript
it('should not leak memory with frequent updates', async () => {
  const initialMemory = performance.memory?.usedJSHeapSize || 0
  
  // Perform 1000 operations
  for (let i = 0; i < 1000; i++) {
    useSubtitleEditStore.getState().updateSubtitle(`test-${i}`, { text: `test ${i}` })
  }
  
  // Force garbage collection
  if (global.gc) global.gc()
  
  const finalMemory = performance.memory?.usedJSHeapSize || 0
  const memoryIncrease = finalMemory - initialMemory
  
  // Memory increase should be reasonable (< 10MB)
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
})
```

---

## Monitoring and Validation

### Real-time Performance Monitoring
```typescript
// Add to store initialization
const performanceReporter = {
  reportSlowUpdate: (duration: number, operation: string) => {
    if (duration > 50) {
      console.warn(`🚨 Slow store operation: ${operation} took ${duration}ms`)
      
      // Report to analytics in production
      if (process.env.NODE_ENV === 'production') {
        analytics.track('performance_issue', {
          operation,
          duration,
          store: 'subtitle-edit'
        })
      }
    }
  }
}
```

### Success Metrics
- **Zero infinite re-render loops** (automated detection)
- **<50ms state update times** (95th percentile)
- **<100MB memory usage** with 1000+ subtitles
- **>80% performance improvement** over baseline

This optimization strategy specifically targets Zustand 5.0.6 patterns and resolves the critical P0 infinite re-render issues while providing a scalable foundation for future state management needs.