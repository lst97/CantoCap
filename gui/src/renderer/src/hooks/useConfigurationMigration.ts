/**
 * Configuration Migration Hook
 * 
 * Provides utilities for migrating components from direct store access
 * to the centralized configuration manager.
 */

import { useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { useEnhancedWorkspaceConfig, useUnifiedConfig } from '../contexts/EnhancedWorkspaceConfigContext'
import type { AppConfig } from '../../../types'
import type { ConfigUpdateOptions } from '../services/configuration-manager'

/**
 * Migration hook that provides both old and new configuration APIs
 * for gradual migration of components.
 */
export const useConfigurationMigration = () => {
  const appStore = useAppStore()
  const enhancedConfig = useEnhancedWorkspaceConfig()
  const unifiedConfig = useUnifiedConfig()

  // Legacy method (for backward compatibility)
  const legacyUpdateConfig = useCallback(<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K]
  ) => {
    console.warn(
      `[MIGRATION] Component is using legacy updateConfig for '${key}'. ` +
      `Consider migrating to useUnifiedConfig().setValue() for better workspace targeting.`
    )
    return appStore.updateConfig(key, value)
  }, [appStore])

  // New centralized method
  const centralizedUpdateConfig = useCallback(<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ) => {
    return unifiedConfig.setValue(key, value, options)
  }, [unifiedConfig])

  // Migration status checker
  const checkMigrationStatus = useCallback(() => {
    const isReady = enhancedConfig.isWorkspaceReady
    const hasWorkspaces = enhancedConfig.hasWorkspaces
    const workspaceContext = enhancedConfig.workspaceContext

    return {
      canMigrate: isReady && hasWorkspaces,
      isReady,
      hasWorkspaces,
      workspaceContext,
      recommendations: {
        useUnifiedConfig: isReady && hasWorkspaces,
        useLegacyFallback: !isReady || !hasWorkspaces,
        requiresWorkspaceSetup: !hasWorkspaces
      }
    }
  }, [enhancedConfig])

  return {
    // Legacy API (for components not yet migrated)
    legacy: {
      updateConfig: legacyUpdateConfig,
      getConfig: () => appStore.config
    },
    
    // New centralized API
    centralized: {
      updateConfig: centralizedUpdateConfig,
      getConfig: unifiedConfig.getValue,
      validateConfig: unifiedConfig.validateConfig
    },
    
    // Migration utilities
    migration: {
      checkStatus: checkMigrationStatus,
      isReady: unifiedConfig.isReady,
      error: unifiedConfig.error,
      clearError: unifiedConfig.clearError
    }
  }
}

/**
 * Wrapper hook for components that need automatic fallback
 * between centralized and legacy configuration management.
 */
export const useSmartConfig = () => {
  const migration = useConfigurationMigration()
  const migrationStatus = migration.migration.checkStatus()

  // Automatically choose the best configuration method
  const updateConfig = useCallback(<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
    options?: ConfigUpdateOptions
  ) => {
    if (migrationStatus.recommendations.useUnifiedConfig) {
      return migration.centralized.updateConfig(key, value, options)
    } else {
      // Fallback to legacy method
      migration.legacy.updateConfig(key, value)
      return Promise.resolve({
        success: true,
        targetStore: 'app' as const,
        workspaceId: undefined
      })
    }
  }, [migration, migrationStatus])

  const getConfig = useCallback(<K extends keyof AppConfig>(key: K) => {
    if (migrationStatus.recommendations.useUnifiedConfig) {
      return migration.centralized.getConfig(key)
    } else {
      return Promise.resolve(migration.legacy.getConfig()[key])
    }
  }, [migration, migrationStatus])

  return {
    updateConfig,
    getConfig,
    isReady: migrationStatus.isReady,
    migrationStatus,
    workspaceContext: migrationStatus.workspaceContext
  }
}