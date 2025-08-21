/**
 * Workspace validation utilities for ensuring data integrity
 */

import { createComponentLogger } from './logger';

const logger = createComponentLogger('WorkspaceValidation');

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a workspace ID format
 */
export function validateWorkspaceId(workspaceId: string | null): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!workspaceId) {
    result.isValid = false;
    result.errors.push('Workspace ID cannot be null or empty');
    return result;
  }

  if (typeof workspaceId !== 'string') {
    result.isValid = false;
    result.errors.push('Workspace ID must be a string');
    return result;
  }

  if (workspaceId.trim().length === 0) {
    result.isValid = false;
    result.errors.push('Workspace ID cannot be empty or whitespace only');
    return result;
  }

  // Check for valid UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(workspaceId)) {
    result.warnings.push('Workspace ID does not appear to be a valid UUID format');
  }

  return result;
}

/**
 * Validates workspace metadata
 */
export function validateWorkspaceMetadata(metadata: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!metadata) {
    result.isValid = false;
    result.errors.push('Workspace metadata cannot be null');
    return result;
  }

  // Check required fields
  const requiredFields = ['id', 'name', 'createdAt', 'lastAccessed'];
  for (const field of requiredFields) {
    if (!metadata[field]) {
      result.isValid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate dates
  if (metadata.createdAt && isNaN(Date.parse(metadata.createdAt))) {
    result.isValid = false;
    result.errors.push('Invalid createdAt date format');
  }

  if (metadata.lastAccessed && isNaN(Date.parse(metadata.lastAccessed))) {
    result.isValid = false;
    result.errors.push('Invalid lastAccessed date format');
  }

  // Validate name
  if (metadata.name && typeof metadata.name !== 'string') {
    result.isValid = false;
    result.errors.push('Workspace name must be a string');
  }

  if (metadata.name && metadata.name.trim().length === 0) {
    result.isValid = false;
    result.errors.push('Workspace name cannot be empty');
  }

  return result;
}

/**
 * Validates step content structure
 */
export function validateStepContent(stepName: string, content: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!content) {
    result.warnings.push(`Step content for ${stepName} is empty`);
    return result;
  }

  // Basic structure validation based on step type
  switch (stepName) {
    case 'input':
      if (!Array.isArray(content.selectedFiles)) {
        result.warnings.push('Input step selectedFiles should be an array - auto-correcting to empty array');
        // Auto-correct the issue
        content.selectedFiles = [];
      }
      break;
    
    case 'config':
      if (content.modelSettings && typeof content.modelSettings !== 'object') {
        result.isValid = false;
        result.errors.push('Config step modelSettings must be an object');
      }
      break;
    
    case 'processing':
      if (content.status && !['idle', 'running', 'completed', 'error'].includes(content.status)) {
        result.warnings.push('Processing step has invalid status value');
      }
      break;
    
    case 'review':
      if (content.subtitles && !Array.isArray(content.subtitles)) {
        result.isValid = false;
        result.errors.push('Review step subtitles must be an array');
      }
      break;
    
    case 'export':
      if (content.exportSettings && typeof content.exportSettings !== 'object') {
        result.warnings.push('Export step exportSettings should be an object');
      }
      break;
  }

  return result;
}

/**
 * Safely handles workspace operations with validation
 */
export async function safeWorkspaceOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    logger.debug('Executing workspace operation', { operationName });
    const result = await operation();
    logger.debug('Workspace operation completed', { operationName });
    return result;
  } catch (error) {
    logger.error('Workspace operation failed', {
      operationName,
      error: error instanceof Error ? error.message : String(error)
    });
    
    if (fallbackValue !== undefined) {
      logger.info('Using fallback value for operation', { operationName });
      return fallbackValue;
    }
    
    return undefined;
  }
}

/**
 * Validates app state integrity
 */
export function validateAppState(appState: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!appState) {
    result.isValid = false;
    result.errors.push('App state cannot be null');
    return result;
  }

  // Validate active workspace ID if present
  if (appState.activeWorkspaceId) {
    const workspaceIdValidation = validateWorkspaceId(appState.activeWorkspaceId);
    if (!workspaceIdValidation.isValid) {
      result.warnings.push('Active workspace ID is invalid');
      result.warnings.push(...workspaceIdValidation.errors);
    }
  }

  // Validate recent workspaces
  if (appState.recentWorkspaces && !Array.isArray(appState.recentWorkspaces)) {
    result.isValid = false;
    result.errors.push('Recent workspaces must be an array');
  }

  if (appState.recentWorkspaces) {
    appState.recentWorkspaces.forEach((id: string, index: number) => {
      const workspaceIdValidation = validateWorkspaceId(id);
      if (!workspaceIdValidation.isValid) {
        result.warnings.push(`Recent workspace at index ${index} has invalid ID`);
      }
    });
  }

  return result;
}