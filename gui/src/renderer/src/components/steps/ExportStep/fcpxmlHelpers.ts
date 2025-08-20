/**
 * FCPXML Generation Helpers
 * 
 * Utilities for generating Final Cut Pro XML (FCPXML) format
 * Compatible with FCPXML version 1.9 for maximum compatibility
 */

import type { Subtitle } from '../../../stores/types/StoreTypes';

export interface FCPXMLMetadata {
  projectName?: string;
  eventName?: string;
  frameRate?: number;
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * Convert seconds to FCPXML timecode format
 * Example: 1.5 seconds -> "150/100s" or "4500/3000s" for 30fps
 */
export const formatFCPXMLTime = (seconds: number, frameRate: number = 30): string => {
  // Convert to rational time format used by FCPXML
  // For 30fps: 1 second = 3000 units, so multiply seconds by 3000
  const numerator = Math.round(seconds * frameRate * 100);
  const denominator = frameRate * 100;
  return `${numerator}/${denominator}s`;
};

/**
 * Escape XML characters and format text for FCPXML
 */
export const formatFCPXMLText = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')     // Must be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .trim();
};

/**
 * Generate resource definitions for FCPXML
 */
export const createResourceDefinitions = (metadata: FCPXMLMetadata): string => {
  const frameRate = metadata.frameRate || 30;
  const width = metadata.width || 1920;
  const height = metadata.height || 1080;
  
  // Calculate frame duration for the given frame rate
  const frameDuration = formatFCPXMLTime(1 / frameRate, frameRate);
  
  return `    <resources>
        <format id="r1" name="FFVideoFormat${height}p${frameRate}" frameDuration="${frameDuration}" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
        <effect id="r2" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>
    </resources>`;
};

/**
 * Create a title element for a single subtitle
 */
export const createTitleElement = (
  subtitle: Subtitle, 
  index: number, 
  frameRate: number = 30,
  selectedLanguages: string[] = ['original'],
  includeMetadata: boolean = false
): string => {
  const startTime = formatFCPXMLTime(subtitle.startTime, frameRate);
  const duration = formatFCPXMLTime(subtitle.endTime - subtitle.startTime, frameRate);
  
  // Determine which text to display based on language selection
  let displayText = '';
  if (selectedLanguages.includes('translation') && subtitle.translation) {
    if (selectedLanguages.includes('original') && subtitle.text) {
      // Both languages - show original first, then translation
      displayText = `${subtitle.text}\n${subtitle.translation}`;
    } else {
      // Translation only
      displayText = subtitle.translation;
    }
  } else {
    // Original text only (default)
    displayText = subtitle.text || '';
  }
  
  // Add speaker info if available
  if (subtitle.speaker) {
    displayText = `[${subtitle.speaker}] ${displayText}`;
  }
  
  // Add metadata if requested
  if (includeMetadata && subtitle.confidence) {
    displayText += `\n[Confidence: ${Math.round(subtitle.confidence * 100)}%]`;
  }
  
  const escapedText = formatFCPXMLText(displayText);
  
  return `            <title ref="r2" offset="${startTime}" duration="${duration}" name="Subtitle ${index + 1}">
                <text>
                    <text-style ref="ts1">${escapedText}</text-style>
                </text>
                <text-style-def id="ts1">
                    <text-style font="Helvetica" fontSize="36" fontFace="Regular" fontColor="1 1 1 1" alignment="center" baseline="baseline"/>
                </text-style-def>
            </title>`;
};

/**
 * Generate the complete FCPXML structure
 */
export const generateFCPXMLStructure = (
  subtitles: Subtitle[],
  metadata: FCPXMLMetadata = {},
  selectedLanguages: string[] = ['original'],
  includeMetadata: boolean = false
): string => {
  const projectName = metadata.projectName || 'CantoCap Subtitles';
  const eventName = metadata.eventName || 'CantoCap Export';
  const frameRate = metadata.frameRate || 30;
  
  // Calculate total duration if not provided
  const totalDuration = metadata.duration || (subtitles.length > 0 
    ? Math.max(...subtitles.map(sub => sub.endTime)) 
    : 60);
  
  const resourceDefinitions = createResourceDefinitions(metadata);
  
  // Generate title elements for all subtitles
  const titleElements = subtitles.map((subtitle, index) => 
    createTitleElement(subtitle, index, frameRate, selectedLanguages, includeMetadata)
  ).join('\n');
  
  // Calculate sequence duration
  const sequenceDuration = formatFCPXMLTime(totalDuration, frameRate);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
${resourceDefinitions}
    <library>
        <event name="${formatFCPXMLText(eventName)}">
            <project name="${formatFCPXMLText(projectName)}">
                <sequence format="r1" duration="${sequenceDuration}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
                    <spine>
${titleElements}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>`;
};

/**
 * Generate FCPXML with language-aware content
 */
export const generateLanguageAwareFCPXML = (
  subtitles: Subtitle[],
  selectedLanguages: string[],
  includeMetadata: boolean,
  showTimestamps: boolean,
  customMetadata: Partial<FCPXMLMetadata> = {}
): string => {
  // Prepare metadata with defaults
  const metadata: FCPXMLMetadata = {
    projectName: 'CantoCap Subtitles',
    eventName: 'CantoCap Export',
    frameRate: 30,
    width: 1920,
    height: 1080,
    ...customMetadata
  };
  
  // Filter and prepare subtitles
  const processedSubtitles = subtitles.map(subtitle => {
    const processed = { ...subtitle };
    
    // Add timestamps to text if requested
    if (showTimestamps && processed.text) {
      const startTime = formatTimestamp(processed.startTime);
      processed.text = `[${startTime}] ${processed.text}`;
    }
    
    return processed;
  });
  
  return generateFCPXMLStructure(
    processedSubtitles, 
    metadata, 
    selectedLanguages, 
    includeMetadata
  );
};

/**
 * Format timestamp for display (helper function)
 */
const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
};

/**
 * Validate FCPXML structure (basic validation)
 */
export const validateFCPXML = (xmlString: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for basic XML structure
  if (!xmlString.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push('Missing XML declaration');
  }
  
  if (!xmlString.includes('<!DOCTYPE fcpxml>')) {
    errors.push('Missing FCPXML doctype');
  }
  
  if (!xmlString.includes('<fcpxml version="1.9">')) {
    errors.push('Missing or incorrect FCPXML version');
  }
  
  // Check for required elements
  if (!xmlString.includes('<resources>')) {
    errors.push('Missing resources section');
  }
  
  if (!xmlString.includes('<library>')) {
    errors.push('Missing library section');
  }
  
  if (!xmlString.includes('<sequence')) {
    errors.push('Missing sequence element');
  }
  
  // Check for basic structure completeness (simplified validation)
  const requiredStructure = [
    { element: '</fcpxml>', description: 'Missing closing fcpxml tag' },
    { element: '</resources>', description: 'Missing closing resources tag' },
    { element: '</library>', description: 'Missing closing library tag' },
    { element: '</event>', description: 'Missing closing event tag' },
    { element: '</project>', description: 'Missing closing project tag' },
    { element: '</sequence>', description: 'Missing closing sequence tag' },
    { element: '</spine>', description: 'Missing closing spine tag' }
  ];
  
  requiredStructure.forEach(({ element, description }) => {
    if (!xmlString.includes(element)) {
      errors.push(description);
    }
  });
  
  // Check for malformed XML patterns (basic check)
  if (xmlString.includes('<>') || xmlString.includes('</>')) {
    errors.push('Malformed XML tags detected');
  }
  
  // Ensure proper FCPXML structure hierarchy
  const fcpxmlStart = xmlString.indexOf('<fcpxml');
  const fcpxmlEnd = xmlString.indexOf('</fcpxml>');
  if (fcpxmlStart === -1 || fcpxmlEnd === -1 || fcpxmlStart >= fcpxmlEnd) {
    errors.push('Invalid FCPXML structure');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get FCPXML format information
 */
export const getFCPXMLInfo = () => ({
  version: '1.9',
  name: 'Final Cut Pro XML',
  extension: 'fcpxml',
  mimeType: 'application/xml',
  description: 'Final Cut Pro XML format for professional video editing workflows',
  compatibility: ['Final Cut Pro X', 'DaVinci Resolve', 'Adobe Premiere Pro'],
  features: [
    'Professional timeline integration',
    'Timing and positioning information',
    'Text styling and formatting',
    'Multi-language subtitle support',
    'Metadata preservation'
  ]
});