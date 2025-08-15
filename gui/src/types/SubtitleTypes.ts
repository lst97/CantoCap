// ============================================================================
// CANTOCAP JSON SUBTITLE FORMAT TYPE DEFINITIONS
// ============================================================================
// 
// TypeScript interfaces for the CantoCap JSON subtitle format as output by
// the Python backend via IPC completion events.
// 
// This format provides rich metadata and structured subtitle data that goes
// beyond the basic SRT format, enabling enhanced editing and analysis features.
// ============================================================================

/**
 * Settings used during subtitle generation
 */
export interface SubtitleGenerationSettings {
  includeCantonese: boolean;
  includeEnglish: boolean;
  includeTimestampMetadata: boolean;
}

/**
 * Statistical information about the generated subtitles
 */
export interface SubtitleStatistics {
  totalSubtitles: number;
  totalDuration: number;
  averageConfidence: number;
}

/**
 * Metadata about the CantoCap JSON subtitle export
 */
export interface SubtitleMetadata {
  format: string; // Should be "CantoCap JSON Subtitle Export"
  version: string; // Format version (e.g., "1.0")
  generatedAt: string; // ISO timestamp
  settings: SubtitleGenerationSettings;
  statistics: SubtitleStatistics;
}

/**
 * Individual subtitle entry in the CantoCap JSON format
 */
export interface SubtitleEntry {
  index: number;
  startTime: number; // Start time in seconds
  endTime: number; // End time in seconds
  duration: number; // Duration in seconds
  caption: string; // Original language subtitle text (Cantonese)
  translation: string; // Translated subtitle text (English)
  confidence?: number; // Optional confidence score
  speaker?: string; // Optional speaker identification
}

/**
 * Complete CantoCap JSON subtitle data structure
 */
export interface CantocapSubtitleData {
  metadata: SubtitleMetadata;
  subtitles: SubtitleEntry[];
}

/**
 * Processing result containing JSON subtitle data and additional info
 */
export interface ProcessingResult {
  status: string;
  message: string;
  subtitleData: CantocapSubtitleData;
  outputFilePath: string; // Backup SRT file path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statistics: any; // Legacy processing statistics
}

/**
 * Complete processing completion event data
 */
export interface ProcessingCompleteData {
  type: 'complete';
  data: ProcessingResult;
}

// ============================================================================
// TYPE GUARDS AND VALIDATION FUNCTIONS
// ============================================================================

/**
 * Type guard to check if an object is valid SubtitleGenerationSettings
 */
export function isSubtitleGenerationSettings(obj: any): obj is SubtitleGenerationSettings { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.includeCantonese === 'boolean' &&
    typeof obj.includeEnglish === 'boolean' &&
    typeof obj.includeTimestampMetadata === 'boolean'
  );
}

/**
 * Type guard to check if an object is valid SubtitleStatistics
 */
export function isSubtitleStatistics(obj: any): obj is SubtitleStatistics { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.totalSubtitles === 'number' &&
    typeof obj.totalDuration === 'number' &&
    typeof obj.averageConfidence === 'number'
  );
}

/**
 * Type guard to check if an object is valid SubtitleMetadata
 */
export function isSubtitleMetadata(obj: any): obj is SubtitleMetadata { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.format === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.generatedAt === 'string' &&
    isSubtitleGenerationSettings(obj.settings) &&
    isSubtitleStatistics(obj.statistics)
  );
}

/**
 * Type guard to check if an object is valid SubtitleEntry
 */
export function isSubtitleEntry(obj: any): obj is SubtitleEntry { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.index === 'number' &&
    typeof obj.startTime === 'number' &&
    typeof obj.endTime === 'number' &&
    typeof obj.duration === 'number' &&
    typeof obj.caption === 'string' &&
    typeof obj.translation === 'string' &&
    (obj.confidence === undefined || typeof obj.confidence === 'number') &&
    (obj.speaker === undefined || typeof obj.speaker === 'string')
  );
}

/**
 * Type guard to check if an object is valid CantocapSubtitleData
 */
export function isCantocapSubtitleData(obj: any): obj is CantocapSubtitleData { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    isSubtitleMetadata(obj.metadata) &&
    Array.isArray(obj.subtitles) &&
    obj.subtitles.every(isSubtitleEntry)
  );
}

/**
 * Type guard to check if an object is valid ProcessingResult
 */
export function isProcessingResult(obj: any): obj is ProcessingResult { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.status === 'string' &&
    typeof obj.message === 'string' &&
    isCantocapSubtitleData(obj.subtitleData) &&
    typeof obj.outputFilePath === 'string'
  );
}

/**
 * Type guard to check if an event is a ProcessingCompleteData event
 */
export function isProcessingCompleteEvent(event: any): event is ProcessingCompleteData { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    event &&
    event.type === 'complete' &&
    isProcessingResult(event.data)
  );
}

// ============================================================================
// UTILITY FUNCTIONS FOR DATA CONVERSION
// ============================================================================

/**
 * Convert CantoCap SubtitleEntry to GUI Subtitle format
 */
export function convertSubtitleEntryToGuiSubtitle(entry: SubtitleEntry): import('../renderer/src/stores/types/StoreTypes').Subtitle {
  return {
    id: `subtitle-${entry.index}`,
    index: entry.index,
    startTime: entry.startTime,
    endTime: entry.endTime,
    duration: entry.duration,
    text: entry.caption,
    translation: entry.translation,
    speaker: entry.speaker,
    confidence: entry.confidence
  };
}

/**
 * Convert array of CantoCap SubtitleEntry to GUI Subtitle array
 */
export function convertSubtitleDataToGuiSubtitles(
  subtitleEntries: SubtitleEntry[]
): import('../renderer/src/stores/types/StoreTypes').Subtitle[] {
  return subtitleEntries.map(convertSubtitleEntryToGuiSubtitle);
}

/**
 * Extract subtitle count from CantoCap data
 */
export function getSubtitleCount(data: CantocapSubtitleData): number {
  return data.metadata.statistics.totalSubtitles;
}

/**
 * Extract total duration from CantoCap data
 */
export function getTotalDuration(data: CantocapSubtitleData): number {
  return data.metadata.statistics.totalDuration;
}

/**
 * Extract generation timestamp from CantoCap data
 */
export function getGenerationTimestamp(data: CantocapSubtitleData): string {
  return data.metadata.generatedAt;
}

/**
 * Check if CantoCap data includes English translations
 */
export function hasEnglishTranslations(data: CantocapSubtitleData): boolean {
  return data.metadata.settings.includeEnglish;
}

/**
 * Check if CantoCap data includes Cantonese captions
 */
export function hasCantoneseCaption(data: CantocapSubtitleData): boolean {
  return data.metadata.settings.includeCantonese;
}

/**
 * Get average confidence score from CantoCap data
 */
export function getAverageConfidence(data: CantocapSubtitleData): number {
  return data.metadata.statistics.averageConfidence;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Error types specific to JSON subtitle data processing
 */
export interface SubtitleDataError {
  code: 'INVALID_FORMAT' | 'MISSING_DATA' | 'VALIDATION_FAILED' | 'CONVERSION_ERROR';
  message: string;
  details?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Result type for operations that may fail
 */
export interface SubtitleDataResult<T> {
  success: boolean;
  data?: T;
  error?: SubtitleDataError;
}

/**
 * Safe wrapper for processing subtitle data with error handling
 */
export function safeProcessSubtitleData<T>(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  processor: (data: CantocapSubtitleData) => T
): SubtitleDataResult<T> {
  try {
    if (!isCantocapSubtitleData(data)) {
      return {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Data does not match CantoCap subtitle format',
          details: data
        }
      };
    }

    const result = processor(data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CONVERSION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown conversion error',
        details: error
      }
    };
  }
}