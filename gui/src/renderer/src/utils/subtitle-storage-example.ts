/**
 * Example usage of the simplified subtitle storage system
 * 
 * This demonstrates the data flow: 
 * Import → IndexedDB original → Edit → IndexedDB modified → Restore from IndexedDB
 */

import type { SubtitleEntry } from '../types/subtitle'
import {
  saveOriginalSubtitles,
  saveModifiedSubtitles,
  loadSessionSubtitles
} from './subtitle-indexeddb'

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Complete subtitle editing workflow
 */
export async function exampleSubtitleWorkflow() {
  const workspaceId = 'workspace-123'
  const sessionId = 'session-456'
  
  // 1. Import: Save original subtitles to IndexedDB
  const originalSubtitles: SubtitleEntry[] = [
    {
      id: '1',
      index: 0,
      startTime: 1000,
      endTime: 3000,
      duration: 2000,
      text: 'Hello world',
      confidence: 0.95
    },
    {
      id: '2',
      index: 1,
      startTime: 4000,
      endTime: 6000,
      duration: 2000,
      text: 'This is a test subtitle',
      confidence: 0.87
    }
  ]
  
  console.log('1. Saving original subtitles to IndexedDB...')
  await saveOriginalSubtitles(workspaceId, sessionId, originalSubtitles)
  console.log('✅ Original subtitles saved')
  
  // 2. Edit: Modify subtitles and save changes
  const modifiedSubtitles: SubtitleEntry[] = [
    {
      id: '1',
      index: 0,
      startTime: 1000,
      endTime: 3000,
      duration: 2000,
      text: 'Hello world (edited)',
      confidence: 0.95,
      translation: 'Hola mundo'
    },
    {
      id: '2',
      index: 1,
      startTime: 4000,
      endTime: 6000,
      duration: 2000,
      text: 'This is an edited test subtitle',
      confidence: 0.87,
      translation: 'Esta es una prueba editada'
    },
    {
      id: '3',
      index: 2,
      startTime: 7000,
      endTime: 9000,
      duration: 2000,
      text: 'New subtitle added',
      confidence: 1.0
    }
  ]
  
  console.log('2. Saving modified subtitles to IndexedDB...')
  await saveModifiedSubtitles(workspaceId, sessionId, modifiedSubtitles)
  console.log('✅ Modified subtitles saved')
  
  // 3. Restore: Load both original and modified subtitles from IndexedDB
  console.log('3. Loading session subtitles from IndexedDB...')
  const sessionData = await loadSessionSubtitles(workspaceId, sessionId)
  
  if (sessionData) {
    console.log('✅ Session data loaded:')
    console.log('- Original subtitles:', sessionData.original?.length || 0, 'items')
    console.log('- Modified subtitles:', sessionData.modified?.length || 0, 'items')
    
    // Compare original vs modified
    if (sessionData.original && sessionData.modified) {
      console.log('\n📊 Comparison:')
      console.log('- Added subtitles:', sessionData.modified.length - sessionData.original.length)
      
      // Find edited subtitles
      const editedCount = sessionData.modified.filter(modified => {
        const original = sessionData.original!.find(orig => orig.id === modified.id)
        return original && original.text !== modified.text
      }).length
      
      console.log('- Edited subtitles:', editedCount)
    }
  } else {
    console.log('❌ No session data found')
  }
  
  return sessionData
}

/**
 * Example: Using the hook in a React component
 */
export const exampleHookUsage = `
import { useSimpleSubtitleStorage } from '../hooks/useSimpleSubtitleStorage'
import { useEffect, useState } from 'react'

function SubtitleEditor() {
  const {
    saveOriginal,
    saveModified,
    loadSession,
    isLoading,
    isSaving,
    error
  } = useSimpleSubtitleStorage()
  
  const [sessionData, setSessionData] = useState(null)
  const sessionId = 'my-session-123'
  
  // Load session on component mount
  useEffect(() => {
    async function loadSessionData() {
      const data = await loadSession(sessionId)
      setSessionData(data)
    }
    loadSessionData()
  }, [loadSession, sessionId])
  
  // Save original subtitles when imported
  const handleImportSubtitles = async (importedSubtitles) => {
    await saveOriginal(sessionId, importedSubtitles)
    // Reload session to update UI
    const updatedData = await loadSession(sessionId)
    setSessionData(updatedData)
  }
  
  // Save modified subtitles when edited
  const handleSaveEdits = async (editedSubtitles) => {
    await saveModified(sessionId, editedSubtitles)
    // Reload session to update UI
    const updatedData = await loadSession(sessionId)
    setSessionData(updatedData)
  }
  
  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <h2>Subtitle Editor</h2>
      {sessionData?.original && (
        <div>
          <h3>Original Subtitles ({sessionData.original.length})</h3>
          {/* Render original subtitles */}
        </div>
      )}
      {sessionData?.modified && (
        <div>
          <h3>Modified Subtitles ({sessionData.modified.length})</h3>
          {/* Render modified subtitles */}
        </div>
      )}
      {isSaving && <div>Saving...</div>}
    </div>
  )
}
`

// ============================================================================
// MIGRATION HELPER
// ============================================================================

/**
 * Helper function to migrate from file-based storage to IndexedDB
 * This can be used to convert existing TempSubtitleSession objects
 */
export function migrateFromFileBasedSession(
  session: any, // Old TempSubtitleSession with originalPath/tempPath
  workspaceId: string,
  sessionId: string
) {
  // Remove file-based properties and return clean session data
  const { originalPath, tempPath, ...cleanSession } = session
  
  return {
    cleanSession,
    async saveToIndexedDB() {
      // Save original subtitles if available
      if (cleanSession.originalSubtitles && cleanSession.originalSubtitles.length > 0) {
        await saveOriginalSubtitles(workspaceId, sessionId, cleanSession.originalSubtitles)
      }
      
      // Save current subtitles as modified if they differ from original
      if (cleanSession.currentSubtitles && cleanSession.currentSubtitles.length > 0) {
        const hasChanges = cleanSession.isDirty || 
          JSON.stringify(cleanSession.originalSubtitles) !== JSON.stringify(cleanSession.currentSubtitles)
        
        if (hasChanges) {
          await saveModifiedSubtitles(workspaceId, sessionId, cleanSession.currentSubtitles)
        }
      }
    }
  }
}