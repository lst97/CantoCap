// Export Step utility functions

/**
 * Formats a timestamp into a human-readable relative time string
 */
export const formatRelativeTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

/**
 * Groups export history items by date
 */
export const groupHistoryByDate = <T extends { timestamp: number }>(items: T[]) => {
  const groups: Record<string, T[]> = {}
  
  items.forEach(item => {
    const date = new Date(item.timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let groupKey: string
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday'
    } else {
      groupKey = date.toLocaleDateString()
    }
    
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(item)
  })
  
  return groups
}

/**
 * Detects the appropriate language for syntax highlighting based on format
 */
export const detectLanguageFromFormat = (format: string): string => {
  const lowerFormat = format.toLowerCase()
  
  if (lowerFormat.includes('srt') || lowerFormat.includes('vtt')) {
    return 'plaintext'
  } else if (lowerFormat.includes('xml') || lowerFormat.includes('ttml')) {
    return 'xml'
  } else if (lowerFormat.includes('json')) {
    return 'javascript'
  }
  
  return 'plaintext'
}

/**
 * Adds line numbers to content for display
 */
export const addLineNumbers = (content: string, show: boolean = true): string => {
  if (!show) return content
  
  const lines = content.split('\n')
  return lines.map((line, index) => {
    const lineNumber = (index + 1).toString().padStart(3, ' ')
    return `<span class="line-number">${lineNumber}</span> ${line}`
  }).join('\n')
}

/**
 * Keyboard shortcut handler for export actions
 */
export const createKeyboardHandler = (
  canExport: boolean,
  handleSingleExport: () => void
) => {
  return (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'e':
          event.preventDefault()
          if (canExport) handleSingleExport()
          break
      }
    }
  }
}