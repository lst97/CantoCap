/**
 * Export Language Selection Helpers
 * Centralized logic for handling language selections across different export formats
 */

import type { Subtitle } from '../types/StoreTypes';

export type LanguageSelection = 'original' | 'translation';
export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'json';

export interface LanguageContent {
  includeOriginal: boolean;
  includeTranslation: boolean;
  originalText: string;
  translationText: string;
  hasOriginal: boolean;
  hasTranslation: boolean;
}

/**
 * Analyzes a subtitle entry and determines what content to include based on language selection
 */
export const getLanguageContent = (
  subtitle: Subtitle,
  selectedLanguages: LanguageSelection[],
  _format: ExportFormat
): LanguageContent => {
  const includeOriginal = selectedLanguages.includes('original');
  const includeTranslation = selectedLanguages.includes('translation');
  
  const originalText = subtitle.text || '';
  const translationText = subtitle.translation || '';
  
  const hasOriginal = originalText.trim().length > 0;
  const hasTranslation = translationText.trim().length > 0;

  return {
    includeOriginal,
    includeTranslation,
    originalText,
    translationText,
    hasOriginal,
    hasTranslation,
  };
};

/**
 * Formats text content for SRT format based on language selection
 */
export const formatSRTText = (content: LanguageContent): string => {
  const lines: string[] = [];
  
  if (content.includeOriginal && content.hasOriginal) {
    lines.push(content.originalText);
  }
  
  if (content.includeTranslation && content.hasTranslation) {
    lines.push(content.translationText);
  }
  
  // Fallback: if no content would be shown, show available content
  if (lines.length === 0) {
    if (content.hasOriginal) lines.push(content.originalText);
    else if (content.hasTranslation) lines.push(content.translationText);
    else lines.push('[No content available]');
  }
  
  return lines.join('\n');
};

/**
 * Formats text content for VTT format based on language selection
 */
export const formatVTTText = (content: LanguageContent): string => {
  const lines: string[] = [];
  
  if (content.includeOriginal && content.hasOriginal) {
    lines.push(content.originalText);
  }
  
  if (content.includeTranslation && content.hasTranslation) {
    lines.push(content.translationText);
  }
  
  // Fallback: if no content would be shown, show available content
  if (lines.length === 0) {
    if (content.hasOriginal) lines.push(content.originalText);
    else if (content.hasTranslation) lines.push(content.translationText);
    else lines.push('[No content available]');
  }
  
  return lines.join('\n');
};

/**
 * Formats text content for TXT format based on language selection
 */
export const formatTXTText = (content: LanguageContent): string => {
  const parts: string[] = [];
  
  if (content.includeOriginal && content.hasOriginal) {
    parts.push(content.originalText);
  }
  
  if (content.includeTranslation && content.hasTranslation) {
    // For TXT format, put translation in parentheses if both are included
    const translationText = content.includeOriginal && content.hasOriginal 
      ? `(${content.translationText})`
      : content.translationText;
    parts.push(translationText);
  }
  
  // Fallback: if no content would be shown, show available content
  if (parts.length === 0) {
    if (content.hasOriginal) parts.push(content.originalText);
    else if (content.hasTranslation) parts.push(content.translationText);
    else parts.push('[No content available]');
  }
  
  return parts.join(' ');
};

/**
 * Creates JSON subtitle object with only the selected language fields
 */
export const formatJSONSubtitle = (
  subtitle: Subtitle,
  content: LanguageContent,
  index: number
): Record<string, unknown> => {
  const jsonObj: Record<string, unknown> = {
    index: index + 1,
    startTime: Math.round(subtitle.startTime * 100) / 100,
    endTime: Math.round(subtitle.endTime * 100) / 100,
    duration: Math.round((subtitle.endTime - subtitle.startTime) * 100) / 100,
  };

  // Add text fields based on selection and availability
  if (content.includeOriginal && content.hasOriginal) {
    jsonObj.caption = content.originalText;
  }
  
  if (content.includeTranslation && content.hasTranslation) {
    jsonObj.translation = content.translationText;
  }
  
  // Fallback: if no content would be included, include available content
  if (!jsonObj.caption && !jsonObj.translation) {
    if (content.hasOriginal) {
      jsonObj.caption = content.originalText;
    } else if (content.hasTranslation) {
      jsonObj.translation = content.translationText;
    } else {
      jsonObj.caption = '[No content available]';
    }
  }

  // Add optional fields if they exist
  if (subtitle.confidence !== undefined) {
    jsonObj.confidence = Math.round(subtitle.confidence * 100) / 100;
  }
  
  if (subtitle.speaker) {
    jsonObj.speaker = subtitle.speaker;
  }

  return jsonObj;
};

/**
 * Validates if the current language selection will produce meaningful export content
 */
export const validateLanguageSelection = (
  subtitles: Subtitle[],
  selectedLanguages: LanguageSelection[]
): { isValid: boolean; warnings: string[]; totalAvailable: number } => {
  const warnings: string[] = [];
  let totalAvailable = 0;

  if (!subtitles || subtitles.length === 0) {
    return { isValid: false, warnings: ['No subtitles available for export'], totalAvailable: 0 };
  }

  const includeOriginal = selectedLanguages.includes('original');
  const includeTranslation = selectedLanguages.includes('translation');

  if (!includeOriginal && !includeTranslation) {
    return { isValid: false, warnings: ['No language options selected'], totalAvailable: 0 };
  }

  // Count how many subtitles will have content with current selection
  for (const subtitle of subtitles) {
    const hasOriginal = subtitle.text && subtitle.text.trim().length > 0;
    const hasTranslation = subtitle.translation && subtitle.translation.trim().length > 0;
    
    const willHaveContent = 
      (includeOriginal && hasOriginal) || 
      (includeTranslation && hasTranslation);
    
    if (willHaveContent) {
      totalAvailable++;
    }
  }

  // Generate warnings for potential issues
  if (includeOriginal) {
    const originalCount = subtitles.filter(sub => sub.text && sub.text.trim().length > 0).length;
    if (originalCount === 0) {
      warnings.push('No original text available in any subtitle');
    } else if (originalCount < subtitles.length) {
      warnings.push(`Only ${originalCount}/${subtitles.length} subtitles have original text`);
    }
  }

  if (includeTranslation) {
    const translationCount = subtitles.filter(sub => sub.translation && sub.translation.trim().length > 0).length;
    if (translationCount === 0) {
      warnings.push('No translations available in any subtitle');
    } else if (translationCount < subtitles.length) {
      warnings.push(`Only ${translationCount}/${subtitles.length} subtitles have translations`);
    }
  }

  const isValid = totalAvailable > 0;
  if (!isValid) {
    warnings.push('Current language selection would result in empty export');
  }

  return { isValid, warnings, totalAvailable };
};

/**
 * Gets format-specific capabilities and limitations for language selection
 */
export const getFormatLanguageCapabilities = (format: ExportFormat) => {
  switch (format) {
    case 'srt':
      return {
        supportsMultipleLanguages: true,
        separateLines: true,
        inlineTranslation: false,
        description: 'Original and translation on separate lines'
      };
    
    case 'vtt':
      return {
        supportsMultipleLanguages: true,
        separateLines: true,
        inlineTranslation: false,
        description: 'Original and translation on separate lines'
      };
    
    case 'txt':
      return {
        supportsMultipleLanguages: true,
        separateLines: false,
        inlineTranslation: true,
        description: 'Translation in parentheses after original'
      };
    
    case 'json':
      return {
        supportsMultipleLanguages: true,
        separateLines: false,
        inlineTranslation: false,
        description: 'Separate fields for each language, dynamic structure'
      };
    
    default:
      return {
        supportsMultipleLanguages: false,
        separateLines: false,
        inlineTranslation: false,
        description: 'Language selection not supported'
      };
  }
};