/**
 * Jest configuration for ExportStep testing
 * 
 * Required dependencies to add to package.json:
 * npm install --save-dev jest @types/jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
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
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}'
  ],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping for aliases and static assets
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
  },
  
  // Coverage settings
  collectCoverageFrom: [
    'src/renderer/src/utils/format-converters.ts',
    'src/renderer/src/stores/export-store.ts',
    'src/renderer/src/components/steps/ExportStep.tsx',
    '!src/renderer/src/**/*.d.ts'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
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