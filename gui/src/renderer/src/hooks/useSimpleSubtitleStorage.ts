/**
 * useSimpleSubtitleStorage Hook
 * 
 * Simplified hook for subtitle storage using pure IndexedDB operations.
 * Provides basic save/load operations for original and modified subtitle data
 * without complex file system dependencies.
 */

import { useState, useCallback } from 'react'
import { useWorkspaceConfig } from '../contexts/WorkspaceConfigContext'
import type { SubtitleEntry } from '../types/subtitle'
import {
  saveOriginalSubtitles,
  saveModifiedSubtitles,
  loadSessionSubtitles,
  deleteSessionData,
  hasSessionData,
  listWorkspaceSessions,
  cleanupOldSessions,
  type SessionSubtitles
} from '../utils/subtitle-indexeddb'

// ============================================================================
// TYPES
// ============================================================================

export interface UseSimpleSubtitleStorageResult {
  // State
  isLoading: boolean
  isSaving: boolean
  error: string | null
  
  // Core Operations
  saveOriginal: (sessionId: string, subtitles: SubtitleEntry[]) => Promise<void>
  saveModified: (sessionId: string, subtitles: SubtitleEntry[]) => Promise<void>
  loadSession: (sessionId: string) => Promise<SessionSubtitles | null>
  
  // Session Management
  deleteSession: (sessionId: string) => Promise<void>
  checkSessionExists: (sessionId: string) => Promise<{ hasOriginal: boolean; hasModified: boolean }>
  listSessions: () => Promise<string[]>
  
  // Utility
  cleanup: (olderThanDays?: number) => Promise<number>
  clearError: () => void
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSimpleSubtitleStorage(): UseSimpleSubtitleStorageResult {
  const { currentWorkspaceId } = useWorkspaceConfig()
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  
  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const fullErrorMessage = `${operation} failed: ${errorMessage}`
    setError(fullErrorMessage)
    console.error(fullErrorMessage, error)
  }, [])
  
  const clearError = useCallback(() => {
    setError(null)
  }, [])
  
  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  const validateWorkspace = useCallback((): boolean => {
    if (!currentWorkspaceId) {
      setError('No active workspace. Please select a workspace first.')
      return false
    }
    return true
  }, [currentWorkspaceId])
  
  const validateSessionId = useCallback((sessionId: string): boolean => {
    if (!sessionId || sessionId.trim() === '') {
      setError('Session ID is required')
      return false
    }
    return true
  }, [])
  
  const validateSubtitles = useCallback((subtitles: SubtitleEntry[]): boolean => {
    if (!Array.isArray(subtitles)) {
      setError('Subtitles must be an array')
      return false
    }
    
    // Basic validation of subtitle structure
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i]
      if (!subtitle || typeof subtitle.id === 'undefined') {
        setError(`Invalid subtitle at index ${i}: missing id`)
        return false
      }
      if (typeof subtitle.startTime !== 'number' || typeof subtitle.endTime !== 'number') {
        setError(`Invalid subtitle at index ${i}: invalid timing`)
        return false
      }
      if (subtitle.startTime >= subtitle.endTime) {
        setError(`Invalid subtitle at index ${i}: start time must be less than end time`)
        return false
      }
      if (typeof subtitle.text !== 'string') {
        setError(`Invalid subtitle at index ${i}: text must be a string`)
        return false
      }
    }
    
    return true
  }, [])
  
  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================
  
  const saveOriginal = useCallback(async (sessionId: string, subtitles: SubtitleEntry[]): Promise<void> => {
    if (!validateWorkspace() || !validateSessionId(sessionId) || !validateSubtitles(subtitles)) {
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      await saveOriginalSubtitles(currentWorkspaceId!, sessionId, subtitles)
    } catch (error) {
      handleError(error, 'Save original subtitles')
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [currentWorkspaceId, validateWorkspace, validateSessionId, validateSubtitles, handleError])
  
  const saveModified = useCallback(async (sessionId: string, subtitles: SubtitleEntry[]): Promise<void> => {
    if (!validateWorkspace() || !validateSessionId(sessionId) || !validateSubtitles(subtitles)) {
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      await saveModifiedSubtitles(currentWorkspaceId!, sessionId, subtitles)
    } catch (error) {
      handleError(error, 'Save modified subtitles')
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [currentWorkspaceId, validateWorkspace, validateSessionId, validateSubtitles, handleError])
  
  const loadSession = useCallback(async (sessionId: string): Promise<SessionSubtitles | null> => {
    if (!validateWorkspace() || !validateSessionId(sessionId)) {
      return null
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const sessionData = await loadSessionSubtitles(currentWorkspaceId!, sessionId)
      return sessionData
    } catch (error) {
      handleError(error, 'Load session subtitles')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspaceId, validateWorkspace, validateSessionId, handleError])
  
  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================
  
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!validateWorkspace() || !validateSessionId(sessionId)) {
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      await deleteSessionData(currentWorkspaceId!, sessionId)
    } catch (error) {
      handleError(error, 'Delete session')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspaceId, validateWorkspace, validateSessionId, handleError])
  
  const checkSessionExists = useCallback(async (sessionId: string): Promise<{ hasOriginal: boolean; hasModified: boolean }> => {
    if (!validateWorkspace() || !validateSessionId(sessionId)) {
      return { hasOriginal: false, hasModified: false }
    }
    
    setError(null)
    
    try {
      return await hasSessionData(currentWorkspaceId!, sessionId)
    } catch (error) {
      handleError(error, 'Check session existence')
      return { hasOriginal: false, hasModified: false }
    }
  }, [currentWorkspaceId, validateWorkspace, validateSessionId, handleError])
  
  const listSessions = useCallback(async (): Promise<string[]> => {
    if (!validateWorkspace()) {
      return []
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      return await listWorkspaceSessions(currentWorkspaceId!)
    } catch (error) {
      handleError(error, 'List sessions')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspaceId, validateWorkspace, handleError])
  
  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================
  
  const cleanup = useCallback(async (olderThanDays: number = 7): Promise<number> => {
    setIsLoading(true)
    setError(null)
    
    try {
      return await cleanupOldSessions(olderThanDays)
    } catch (error) {
      handleError(error, 'Cleanup old sessions')
      return 0
    } finally {
      setIsLoading(false)
    }
  }, [handleError])
  
  // ============================================================================
  // RETURN HOOK RESULT
  // ============================================================================
  
  return {
    // State
    isLoading,
    isSaving,
    error,
    
    // Core Operations
    saveOriginal,
    saveModified,
    loadSession,
    
    // Session Management
    deleteSession,
    checkSessionExists,
    listSessions,
    
    // Utility
    cleanup,
    clearError
  }
}