import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Base JavaScript recommended config
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      'dist/**',
      'dist-electron/**', 
      'out/**',
      'node_modules/**',
      '.eslintcache',
      '*.config.js.map'
    ],
  },

  // Configuration files (CommonJS)
  {
    files: ['*.config.js', 'postcss.config.js', 'setup.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  // Scripts directory (Node.js environment)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  // Main files (Node.js + Electron environment)
  {
    files: ['src/main/**/*.{js,ts}'],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        __static: 'readonly',
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'error',
    },
  },

  // Preload files (Bridge environment)
  {
    files: ['src/preload/**/*.{js,ts}'],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        __static: 'readonly',
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-undef': 'error',
    },
  },

  // Renderer files (Browser + React environment)
  {
    files: ['src/renderer/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        // Additional browser APIs
        ResizeObserver: 'readonly',
        // IndexedDB types
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBObjectStore: 'readonly',
        IDBTransaction: 'readonly',
        IDBKeyRange: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBRequest: 'readonly',
        IDBIndex: 'readonly',
        IDBValidKey: 'readonly',
        IDBTransactionMode: 'readonly',
        IDBObjectStoreParameters: 'readonly',
        IDBIndexParameters: 'readonly',
        DOMStringList: 'readonly',
        // Additional DOM types
        DOMException: 'readonly',
        // Electron context
        process: 'readonly',
        // React types
        JSX: 'readonly',
        // TypeScript global types
        NodeJS: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'error',
      'no-case-declarations': 'off', // Allow declarations in case blocks
      'no-undef': 'error',
    },
  },

  // TypeScript declaration files
  {
    files: ['src/types/**/*.ts', '**/*.d.ts'],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // Electron types
        IpcRendererEvent: 'readonly',
        // Additional browser types
        Console: 'readonly',
        DOMException: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBRequest: 'readonly',
        IDBValidKey: 'readonly',
        IDBKeyRange: 'readonly',
        IDBTransactionMode: 'readonly',
        IDBObjectStoreParameters: 'readonly',
        IDBIndexParameters: 'readonly',
        IDBIndex: 'readonly',
        DOMStringList: 'readonly',
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off', // TypeScript handles undefined variables
    },
  },

  // Jest test files
  {
    files: [
      '**/__tests__/**/*.{js,ts,tsx}',
      '**/*.test.{js,ts,tsx}',
      '**/*.spec.{js,ts,tsx}'
    ],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        // Additional test globals
        afterEach: 'readonly',
        beforeEach: 'readonly',
        DOMException: 'readonly',
        // Fake IndexedDB globals
        FDBKeyRange: 'readonly',
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'error',
    },
  },
];