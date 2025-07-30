import type { SubtitleEntry } from '../types/subtitle'

export interface ParsedSubtitleStats {
  chinese: number
  translation: number
  total: number
  translationLanguage: string
}

export interface SubtitleContentAnalysis {
  hasChineseText: boolean
  hasTranslation: boolean
  translationLanguage: string
  chineseCount: number
  translationCount: number
  totalCount: number
}

// Language detection mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'zh': 'Chinese',
  'en': 'English', 
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ja': 'Japanese',
  'ko': 'Korean',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'it': 'Italian',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'th': 'Thai',
  'vi': 'Vietnamese'
}

/**
 * Parse SRT format content to extract Chinese and translation text
 * Format: [timestamp] -> [chinese text] -> [translation lines until empty line]
 */
export function parseSRTContent(content: string): SubtitleContentAnalysis {
  const lines = content.split('\n')
  const timestampRegex = /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}$/
  
  let chineseCount = 0
  let translationCount = 0
  let totalCount = 0
  let hasTranslation = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip sequence numbers and empty lines
    if (!line || /^\d+$/.test(line)) continue
    
    // Found timestamp line
    if (timestampRegex.test(line)) {
      totalCount++
      let nextLineIndex = i + 1
      
      // Skip empty lines after timestamp
      while (nextLineIndex < lines.length && !lines[nextLineIndex].trim()) {
        nextLineIndex++
      }
      
      // First non-empty line after timestamp is Chinese text
      if (nextLineIndex < lines.length && lines[nextLineIndex].trim()) {
        chineseCount++
        nextLineIndex++
        
        // Check for translation lines until empty line or next subtitle block
        let foundTranslation = false
        while (nextLineIndex < lines.length) {
          const translationLine = lines[nextLineIndex].trim()
          if (!translationLine) break // Empty line ends translation block
          if (/^\d+$/.test(translationLine)) break // Next sequence number
          if (timestampRegex.test(translationLine)) break // Next timestamp
          
          foundTranslation = true
          nextLineIndex++
        }
        
        if (foundTranslation) {
          translationCount++
          hasTranslation = true
        }
      }
      
      i = nextLineIndex - 1 // Move to processed position
    }
  }
  
  return {
    hasChineseText: chineseCount > 0,
    hasTranslation,
    translationLanguage: 'en', // Default, will be overridden by config
    chineseCount,
    translationCount,
    totalCount
  }
}

/**
 * Parse VTT format content (similar logic to SRT but different timestamp format)
 */
export function parseVTTContent(content: string): SubtitleContentAnalysis {
  const lines = content.split('\n')
  const timestampRegex = /^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}(\s+.*)?$/
  
  let chineseCount = 0
  let translationCount = 0
  let totalCount = 0
  let hasTranslation = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip WEBVTT header and empty lines
    if (!line || line === 'WEBVTT') continue
    
    // Found timestamp line
    if (timestampRegex.test(line)) {
      totalCount++
      
      // Extract cue settings from VTT timestamp line for preservation
      const cueMatch = line.match(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}(\s+.+)?$/)
      const cueSettings = cueMatch && cueMatch[1] ? cueMatch[1].trim() : undefined
      
      let nextLineIndex = i + 1
      
      // Skip empty lines after timestamp
      while (nextLineIndex < lines.length && !lines[nextLineIndex].trim()) {
        nextLineIndex++
      }
      
      // First non-empty line after timestamp is Chinese text
      if (nextLineIndex < lines.length && lines[nextLineIndex].trim()) {
        chineseCount++
        nextLineIndex++
        
        // Check for translation lines until empty line or next subtitle block
        let foundTranslation = false
        while (nextLineIndex < lines.length) {
          const translationLine = lines[nextLineIndex].trim()
          if (!translationLine) break // Empty line ends translation block
          if (timestampRegex.test(translationLine)) break // Next timestamp
          
          foundTranslation = true
          nextLineIndex++
        }
        
        if (foundTranslation) {
          translationCount++
          hasTranslation = true
        }
      }
      
      i = nextLineIndex - 1 // Move to processed position
    }
  }
  
  return {
    hasChineseText: chineseCount > 0,
    hasTranslation,
    translationLanguage: 'en', // Default, will be overridden by config
    chineseCount,
    translationCount,
    totalCount
  }
}

/**
 * Parse ASS format content
 * Format: Look for "Dialogue:" lines, split by comma, last element is Chinese text
 * Following lines until next "Dialogue:" are translation text
 */
export function parseASSContent(content: string): SubtitleContentAnalysis {
  const lines = content.split('\n')
  
  let chineseCount = 0
  let translationCount = 0
  let totalCount = 0
  let hasTranslation = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('Dialogue:')) {
      totalCount++
      const parts = line.split(',')
      
      // Last element should be Chinese text
      if (parts.length > 0 && parts[parts.length - 1].trim()) {
        chineseCount++
        
        // Check following lines for translation until next Dialogue or empty line
        let nextLineIndex = i + 1
        let foundTranslation = false
        
        while (nextLineIndex < lines.length) {
          const nextLine = lines[nextLineIndex].trim()
          if (!nextLine || nextLine.startsWith('Dialogue:')) break
          
          // Skip ASS format lines (like [Script Info], [V4+ Styles], etc.)
          if (nextLine.startsWith('[') && nextLine.endsWith(']')) {
            nextLineIndex++
            continue
          }
          
          foundTranslation = true
          nextLineIndex++
        }
        
        if (foundTranslation) {
          translationCount++
          hasTranslation = true
        }
        
        i = nextLineIndex - 1 // Move to processed position
      }
    }
  }
  
  return {
    hasChineseText: chineseCount > 0,
    hasTranslation,
    translationLanguage: 'en', // Default, will be overridden by config
    chineseCount,
    translationCount,
    totalCount
  }
}

/**
 * Parse JSON format content
 * Format: Each subtitle has cantonese field, text before \n is Chinese, after \n is translation 
 */
export function parseJSONContent(content: string): SubtitleContentAnalysis {
  try {
    const data = JSON.parse(content)
    let chineseCount = 0
    let translationCount = 0
    let totalCount = 0
    let hasTranslation = false
    
    // Handle different JSON structures
    const subtitles = Array.isArray(data) ? data : (data.subtitles || [])
    
    subtitles.forEach((subtitle: any) => {
      totalCount++
      
      // Handle new CantoCap JSON format (caption/translation) and legacy formats
      const chineseText = subtitle.caption || subtitle.cantonese || subtitle.text || ''
      const translationText = subtitle.translation || ''
      
      // Check for Chinese text
      if (chineseText.trim()) {
        chineseCount++
      }
      
      // Check for translation text
      if (translationText.trim()) {
        translationCount++
        hasTranslation = true
      }
      
      // Legacy support: handle combined text with newlines
      if (!chineseText && !translationText) {
        const legacyTextField = subtitle.text || ''
        if (legacyTextField.includes('\n')) {
          const parts = legacyTextField.split('\n', 2) // Split into max 2 parts
          if (parts[0] && parts[0].trim()) {
            chineseCount++
          }
          if (parts[1] && parts[1].trim()) {
            translationCount++
            hasTranslation = true
          }
        } else if (legacyTextField.trim()) {
          // If no newline, treat as Chinese text only
          chineseCount++
        }
      }
    })
    
    return {
      hasChineseText: chineseCount > 0,
      hasTranslation,
      translationLanguage: 'en', // Default, will be overridden by config
      chineseCount,
      translationCount,
      totalCount
    }
  } catch (error) {
    console.error('Error parsing JSON content:', error)
    return {
      hasChineseText: false,
      hasTranslation: false,
      translationLanguage: 'en',
      chineseCount: 0,
      translationCount: 0,
      totalCount: 0
    }
  }
}

/**
 * Analyze subtitle content based on format
 */
export function analyzeSubtitleContent(
  content: string, 
  format: string,
  configLanguage: string = 'en'
): SubtitleContentAnalysis {
  let analysis: SubtitleContentAnalysis
  
  switch (format.toLowerCase()) {
    case 'srt':
      analysis = parseSRTContent(content)
      break
    case 'vtt':
      analysis = parseVTTContent(content)
      break
    case 'ass':
      analysis = parseASSContent(content)
      break
    case 'json':
      analysis = parseJSONContent(content)
      break
    default:
      analysis = {
        hasChineseText: false,
        hasTranslation: false,
        translationLanguage: configLanguage,
        chineseCount: 0,
        translationCount: 0,
        totalCount: 0
      }
  }
  
  // Override translation language from config
  analysis.translationLanguage = configLanguage
  
  return analysis
}

/**
 * Get display name for language code
 */
export function getLanguageDisplayName(languageCode: string): string {
  return LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase()
}

/**
 * Analyze SubtitleEntry array (legacy support)
 */
export function analyzeSubtitleEntries(
  subtitles: SubtitleEntry[],
  configLanguage: string = 'en'
): SubtitleContentAnalysis {
  const chineseCount = subtitles.filter(s => s.text && s.text.trim()).length
  const translationCount = subtitles.filter(s => s.originalText && s.originalText.trim()).length
  
  return {
    hasChineseText: chineseCount > 0,
    hasTranslation: translationCount > 0,
    translationLanguage: configLanguage,
    chineseCount,
    translationCount,
    totalCount: subtitles.length
  }
}