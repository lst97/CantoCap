/**
 * Jest configuration for Phase 4 Integration Testing
 * 
 * Comprehensive test coverage for workspace management system
 * including end-to-end workflows, migration validation, performance testing,
 * and workspace grouping system validation.
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/renderer/src/test-setup.ts'],
  
  // Module paths
  roots: ['<rootDir>/src'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.integration.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.e2e.test.{js,jsx,ts,tsx}'
  ],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping for aliases and static assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
  },
  
  // Coverage settings - expanded for Phase 4 and Configuration Manager
  collectCoverageFrom: [
    // Core workspace system
    'src/renderer/src/stores/workspace-store.ts',
    'src/renderer/src/services/workspace-*.ts',
    'src/renderer/src/components/workspace/**/*.{ts,tsx}',
    
    // Configuration Manager System
    'src/renderer/src/services/configuration-manager.ts',
    'src/renderer/src/contexts/EnhancedWorkspaceConfigContext.tsx',
    'src/renderer/src/hooks/useConfigurationMigration.ts',
    'src/renderer/src/utils/config-error-handler.ts',
    
    // Integration layers
    'src/renderer/src/services/workspace-ipc-integration.ts',
    'src/renderer/src/services/workspace-database.ts',
    
    // Performance and monitoring
    'src/renderer/src/utils/performance-utils.ts',
    'src/renderer/src/utils/workflow-integration.ts',
    
    // Export system (existing)
    'src/renderer/src/utils/format-converters.ts',
    'src/renderer/src/stores/export-store.ts',
    'src/renderer/src/components/steps/ExportStep.tsx',
    
    // Exclude test files and type definitions
    '!src/renderer/src/**/*.d.ts',
    '!src/renderer/src/**/__tests__/**',
    '!src/renderer/src/**/*.test.{ts,tsx}',
    '!src/renderer/src/**/*.spec.{ts,tsx}'
  ],
  
  // Stricter coverage thresholds for Phase 4 and Configuration Manager
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Critical workspace system requires higher coverage
    'src/renderer/src/stores/workspace-store.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/renderer/src/services/workspace-ipc-integration.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Configuration Manager System - Critical components require 95% coverage
    'src/renderer/src/services/configuration-manager.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/renderer/src/contexts/EnhancedWorkspaceConfigContext.tsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/renderer/src/utils/config-error-handler.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/dist/'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Handle ES modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(zustand|@mui|@emotion)/)'
  ]
}