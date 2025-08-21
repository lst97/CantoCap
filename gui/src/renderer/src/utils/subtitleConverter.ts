import { Subtitle } from '../stores/types/StoreTypes';
import { CantocapSubtitleData, SubtitleEntry } from '../../../types/SubtitleTypes';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('SubtitleConverter');

/**
 * Centralized subtitle data converter
 * Converts various subtitle formats to the standard Subtitle[] format used throughout the app
 */

// Interface for imported JSON subtitle (from Step 1)
interface ImportedJsonSubtitle {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  caption?: string; // Primary field from JSON import
  text?: string; // Alternative field name
  translation?: string;
  confidence?: number;
}

// Interface for validated subtitle data with metadata
export interface ValidatedSubtitleData {
  subtitles: Subtitle[];
  metadata?: {
    format?: string;
    version?: string;
    generatedAt?: string;
    settings?: Record<string, unknown>;
    statistics?: {
      totalSubtitles?: number;
      totalDuration?: number;
    };
  };
}

/**
 * Validates and parses JSON subtitle structure from Step 1 imports
 * Supports the CantoCap JSON format with metadata and subtitles array
 */
export function validateJsonSubtitleStructure(data: unknown): ValidatedSubtitleData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON: Expected object');
  }

  const jsonData = data as Record<string, unknown>;

  // Check for CantoCap format with metadata and subtitles
  if ('subtitles' in jsonData && Array.isArray(jsonData.subtitles)) {
    const subtitlesArray = jsonData.subtitles as unknown[];

    if (subtitlesArray.length === 0) {
      throw new Error('Invalid JSON: Subtitles array is empty');
    }

    // Validate each subtitle entry
    const validatedSubtitles: Subtitle[] = [];

    for (const [index, subtitle] of subtitlesArray.entries()) {
      if (!subtitle || typeof subtitle !== 'object') {
        throw new Error(`Invalid subtitle at index ${index}: Expected object`);
      }

      const sub = subtitle as Record<string, unknown>;

      // Validate required fields
      if (typeof sub.index !== 'number') {
        throw new Error(`Invalid subtitle at index ${index}: Missing or invalid 'index' field`);
      }
      if (typeof sub.startTime !== 'number') {
        throw new Error(`Invalid subtitle at index ${index}: Missing or invalid 'startTime' field`);
      }
      if (typeof sub.endTime !== 'number') {
        throw new Error(`Invalid subtitle at index ${index}: Missing or invalid 'endTime' field`);
      }
      if (typeof sub.duration !== 'number') {
        throw new Error(`Invalid subtitle at index ${index}: Missing or invalid 'duration' field`);
      }

      // Text content - check both 'caption' and 'text' fields
      const text = (sub.caption as string) || (sub.text as string) || '';
      if (!text || typeof text !== 'string') {
        throw new Error(
          `Invalid subtitle at index ${index}: Missing or invalid text content (caption/text field)`
        );
      }

      // Optional fields with type checking
      const translation = typeof sub.translation === 'string' ? sub.translation : undefined;
      const confidence = typeof sub.confidence === 'number' ? sub.confidence : undefined;

      // Convert to standard Subtitle format
      const standardSubtitle: Subtitle = {
        id: `subtitle-${sub.index}-${Date.now()}`, // Generate unique ID
        index: sub.index,
        startTime: sub.startTime,
        endTime: sub.endTime,
        duration: sub.duration,
        text,
        translation,
        confidence,
      };

      validatedSubtitles.push(standardSubtitle);
    }

    // Extract metadata if available
    const metadata = jsonData.metadata as Record<string, unknown> | undefined;

    return {
      subtitles: validatedSubtitles,
      metadata: metadata
        ? {
            format: typeof metadata.format === 'string' ? metadata.format : undefined,
            version: typeof metadata.version === 'string' ? metadata.version : undefined,
            generatedAt:
              typeof metadata.generatedAt === 'string' ? metadata.generatedAt : undefined,
            settings:
              typeof metadata.settings === 'object'
                ? (metadata.settings as Record<string, unknown>)
                : undefined,
            statistics:
              typeof metadata.statistics === 'object'
                ? (metadata.statistics as Record<string, unknown>)
                : undefined,
          }
        : undefined,
    };
  }

  // Check for direct array format (legacy support)
  else if (Array.isArray(jsonData)) {
    if (jsonData.length === 0) {
      throw new Error('Invalid JSON: Subtitles array is empty');
    }

    // Validate and convert array format
    const validatedSubtitles: Subtitle[] = [];

    for (const [index, subtitle] of jsonData.entries()) {
      if (!subtitle || typeof subtitle !== 'object') {
        throw new Error(`Invalid subtitle at index ${index}: Expected object`);
      }

      const sub = subtitle as ImportedJsonSubtitle;

      // Validate required fields
      if (typeof sub.startTime !== 'number' || typeof sub.endTime !== 'number') {
        throw new Error(`Invalid subtitle at index ${index}: Missing or invalid timing fields`);
      }

      const text = sub.caption || sub.text || '';
      if (!text) {
        throw new Error(`Invalid subtitle at index ${index}: Missing text content`);
      }

      const standardSubtitle: Subtitle = {
        id: `subtitle-${index}-${Date.now()}`,
        index: sub.index || index + 1,
        startTime: sub.startTime,
        endTime: sub.endTime,
        duration: sub.duration || sub.endTime - sub.startTime,
        text,
        translation: sub.translation,
        confidence: sub.confidence,
      };

      validatedSubtitles.push(standardSubtitle);
    }

    return { subtitles: validatedSubtitles };
  } else {
    throw new Error(
      'Invalid JSON format: Expected array of subtitle objects or CantoCap format with subtitles array'
    );
  }
}

/**
 * Converts CantoCap subtitle data (from Step 3 processing) to standard Subtitle[] format
 */
export function convertCantocapToStandardSubtitles(data: CantocapSubtitleData): Subtitle[] {
  if (!data || !data.subtitles || !Array.isArray(data.subtitles)) {
    return [];
  }

  return data.subtitles.map((subtitle: SubtitleEntry, index: number) => {
    // CantoCap subtitles may have different field names
    const text = subtitle.caption || '';
    const translation = subtitle.translation;

    return {
      id: `processing-${index}-${Date.now()}`,
      index: subtitle.index || index + 1,
      startTime: subtitle.startTime || 0,
      endTime: subtitle.endTime || 0,
      duration: subtitle.duration || subtitle.endTime - subtitle.startTime,
      text,
      translation,
      confidence: subtitle.confidence,
      speaker: subtitle.speaker,
    };
  });
}

/**
 * Main converter function - handles any subtitle source and converts to standard format
 */
export function convertToStandardSubtitles(data: unknown): Subtitle[] {
  if (!data) {
    return [];
  }

  // Check if it's already in Subtitle[] format
  if (Array.isArray(data) && data.length > 0 && 'id' in data[0]) {
    return data as Subtitle[];
  }

  // Try to parse as CantoCap format
  try {
    if (typeof data === 'object' && data !== null && 'subtitles' in data) {
      return convertCantocapToStandardSubtitles(data as CantocapSubtitleData);
    }
  } catch (error) {
    logger.warn('Failed to convert CantoCap format', { error });
  }

  // Try to parse as JSON import format
  try {
    const validated = validateJsonSubtitleStructure(data);
    return validated.subtitles;
  } catch (error) {
    logger.warn('Failed to parse as JSON import format', { error });
  }

  // If all else fails, return empty array
  logger.warn('Unable to convert subtitle data to standard format', { data });
  return [];
}

/**
 * Utility function to generate a unique subtitle ID
 */
export function generateSubtitleId(
  index: number,
  source: 'import' | 'processing' | 'manual' = 'manual'
): string {
  return `${source}-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
