/**
 * Tests for the enhanced message processor.
 */

import { MessageProcessor } from '../message-processor'
import type { IPCMessage } from '../../../../../types'

describe('MessageProcessor', () => {
  describe('processMessage', () => {
    it('should process a basic message correctly', () => {
      const message: IPCMessage = {
        id: 'test_001',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'info',
        category: 'process',
        source: 'test_source',
        content: 'Test message'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(false)
      expect(processed.displayClass).toBe('message-info category-process')
      expect(processed.icon).toBe('ℹ️')
    })

    it('should mark error messages for notification', () => {
      const message: IPCMessage = {
        id: 'test_002',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'error',
        category: 'system',
        source: 'error_source',
        content: 'Error occurred'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(true)
      expect(processed.displayClass).toBe('message-error category-system')
      expect(processed.icon).toBe('❌')
    })

    it('should mark critical messages for notification', () => {
      const message: IPCMessage = {
        id: 'test_003',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'critical',
        category: 'system',
        source: 'critical_source',
        content: 'Critical failure'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(true)
      expect(processed.displayClass).toBe('message-critical category-system')
      expect(processed.icon).toBe('🚨')
    })

    it('should mark system warnings for notification', () => {
      const message: IPCMessage = {
        id: 'test_004',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'warning',
        category: 'system',
        source: 'warning_source',
        content: 'System warning'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(true)
      expect(processed.displayClass).toBe('message-warning category-system')
      expect(processed.icon).toBe('⚠️')
    })

    it('should NOT mark model warnings for notification', () => {
      const message: IPCMessage = {
        id: 'test_005',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'warning',
        category: 'model',
        source: 'model_source',
        content: 'Model warning'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(false)
      expect(processed.displayClass).toBe('message-warning category-model')
      expect(processed.icon).toBe('⚠️')
    })

    it('should NOT mark debug messages for notification', () => {
      const message: IPCMessage = {
        id: 'test_006',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'debug',
        category: 'system',
        source: 'debug_source',
        content: 'Debug information'
      }

      const processed = MessageProcessor.processMessage(message)

      expect(processed.shouldNotify).toBe(false)
      expect(processed.displayClass).toBe('message-debug category-system')
      expect(processed.icon).toBe('🐛')
    })
  })

  describe('isLegacyMessage', () => {
    it('should identify legacy messages correctly', () => {
      const legacyMessage = {
        type: 'log',
        timestamp: '2024-01-01T12:00:00Z',
        data: {
          message: 'Legacy message',
          level: 'info'
        }
      }

      expect(MessageProcessor.isLegacyMessage(legacyMessage)).toBe(true)
    })

    it('should NOT identify new messages as legacy', () => {
      const newMessage: IPCMessage = {
        id: 'test_007',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'info',
        category: 'process',
        source: 'test_source',
        content: 'New message'
      }

      expect(MessageProcessor.isLegacyMessage(newMessage)).toBe(false)
    })
  })

  describe('convertLegacyMessage', () => {
    it('should convert legacy log messages', () => {
      const legacyMessage = {
        type: 'log',
        timestamp: '2024-01-01T12:00:00Z',
        data: {
          message: 'Legacy log message',
          level: 'warning'
        }
      }

      const converted = MessageProcessor.convertLegacyMessage(legacyMessage)

      expect(converted.level).toBe('warning')
      expect(converted.category).toBe('system')
      expect(converted.source).toBe('legacy_handler')
      expect(converted.content).toBe('Legacy log message')
      expect(converted.id).toMatch(/^legacy_/)
    })

    it('should convert legacy error messages', () => {
      const legacyMessage = {
        type: 'error',
        timestamp: '2024-01-01T12:00:00Z',
        data: {
          error: 'Legacy error message'
        }
      }

      const converted = MessageProcessor.convertLegacyMessage(legacyMessage)

      expect(converted.level).toBe('error')
      expect(converted.category).toBe('system')
      expect(converted.content).toBe('Legacy error message')
    })

    it('should convert legacy progress messages', () => {
      const legacyMessage = {
        type: 'progress',
        timestamp: '2024-01-01T12:00:00Z',
        data: {
          task: 'Processing',
          percent: 50.0,
          message: 'Halfway done'
        }
      }

      const converted = MessageProcessor.convertLegacyMessage(legacyMessage)

      expect(converted.level).toBe('info')
      expect(converted.category).toBe('process')
      expect(converted.content).toBe('{"task":"Processing","percent":50,"message":"Halfway done"}')
    })
  })

  describe('filterByLevel', () => {
    const testMessages = [
      {
        id: '1', timestamp: '2024-01-01T12:00:00Z', level: 'debug', category: 'system', source: 'test', content: 'Debug',
        shouldNotify: false, displayClass: 'message-debug', icon: '🐛'
      },
      {
        id: '2', timestamp: '2024-01-01T12:00:00Z', level: 'info', category: 'process', source: 'test', content: 'Info',
        shouldNotify: false, displayClass: 'message-info', icon: 'ℹ️'
      },
      {
        id: '3', timestamp: '2024-01-01T12:00:00Z', level: 'error', category: 'system', source: 'test', content: 'Error',
        shouldNotify: true, displayClass: 'message-error', icon: '❌'
      }
    ] as const

    it('should return all messages when filter is "all"', () => {
      const filtered = MessageProcessor.filterByLevel(testMessages, 'all')
      expect(filtered).toHaveLength(3)
    })

    it('should filter by debug level', () => {
      const filtered = MessageProcessor.filterByLevel(testMessages, 'debug')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].level).toBe('debug')
    })

    it('should filter by error level', () => {
      const filtered = MessageProcessor.filterByLevel(testMessages, 'error')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].level).toBe('error')
    })
  })

  describe('filterByCategory', () => {
    const testMessages = [
      {
        id: '1', timestamp: '2024-01-01T12:00:00Z', level: 'info', category: 'system', source: 'test', content: 'System',
        shouldNotify: false, displayClass: 'message-info', icon: 'ℹ️'
      },
      {
        id: '2', timestamp: '2024-01-01T12:00:00Z', level: 'info', category: 'process', source: 'test', content: 'Process',
        shouldNotify: false, displayClass: 'message-info', icon: 'ℹ️'
      },
      {
        id: '3', timestamp: '2024-01-01T12:00:00Z', level: 'info', category: 'model', source: 'test', content: 'Model',
        shouldNotify: false, displayClass: 'message-info', icon: 'ℹ️'
      }
    ] as const

    it('should return all messages when filter is "all"', () => {
      const filtered = MessageProcessor.filterByCategory(testMessages, 'all')
      expect(filtered).toHaveLength(3)
    })

    it('should filter by system category', () => {
      const filtered = MessageProcessor.filterByCategory(testMessages, 'system')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].category).toBe('system')
    })

    it('should filter by model category', () => {
      const filtered = MessageProcessor.filterByCategory(testMessages, 'model')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].category).toBe('model')
    })
  })

  describe('display name functions', () => {
    it('should return proper level display names', () => {
      expect(MessageProcessor.getLevelDisplayName('debug')).toBe('Debug')
      expect(MessageProcessor.getLevelDisplayName('info')).toBe('Info')
      expect(MessageProcessor.getLevelDisplayName('warning')).toBe('Warning')
      expect(MessageProcessor.getLevelDisplayName('error')).toBe('Error')
      expect(MessageProcessor.getLevelDisplayName('critical')).toBe('Critical')
      expect(MessageProcessor.getLevelDisplayName('unknown')).toBe('unknown')
    })

    it('should return proper category display names', () => {
      expect(MessageProcessor.getCategoryDisplayName('system')).toBe('System')
      expect(MessageProcessor.getCategoryDisplayName('process')).toBe('Process')
      expect(MessageProcessor.getCategoryDisplayName('model')).toBe('Model')
      expect(MessageProcessor.getCategoryDisplayName('user')).toBe('User')
      expect(MessageProcessor.getCategoryDisplayName('unknown')).toBe('unknown')
    })
  })

  describe('real-world scenarios', () => {
    it('should properly classify model loading messages as non-notifying', () => {
      const modelMessage: IPCMessage = {
        id: 'model_001',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'info',
        category: 'model',
        source: 'model_loader',
        content: 'Loading checkpoint shards: 100%|██████████| 2/2 [00:01<00:00,  1.33it/s]'
      }

      const processed = MessageProcessor.processMessage(modelMessage)

      expect(processed.shouldNotify).toBe(false)
      expect(processed.level).toBe('info')
      expect(processed.category).toBe('model')
    })

    it('should properly classify debug messages as non-notifying', () => {
      const debugMessage: IPCMessage = {
        id: 'debug_001',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'debug',
        category: 'system',
        source: 'debug_system',
        content: 'Debug: STDERR - transformers.tokenization_utils_base: Model loaded'
      }

      const processed = MessageProcessor.processMessage(debugMessage)

      expect(processed.shouldNotify).toBe(false)
      expect(processed.level).toBe('debug')
      expect(processed.category).toBe('system')
    })

    it('should properly classify actual errors as notifying', () => {
      const errorMessage: IPCMessage = {
        id: 'error_001',
        timestamp: '2024-01-01T12:00:00Z',
        level: 'error',
        category: 'system',
        source: 'system_error',
        content: 'Error: Failed to load configuration file'
      }

      const processed = MessageProcessor.processMessage(errorMessage)

      expect(processed.shouldNotify).toBe(true)
      expect(processed.level).toBe('error')
      expect(processed.category).toBe('system')
    })
  })
})