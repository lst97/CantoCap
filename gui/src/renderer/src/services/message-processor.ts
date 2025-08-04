/**
 * Enhanced message processor for the new IPC system.
 * Processes and classifies messages for appropriate UI display.
 */

import type { IPCMessage, ProcessedMessage } from '../../../types'
import { generateLegacyId } from '../utils/id-generator'

export class MessageProcessor {
  private static readonly NOTIFICATION_LEVELS = new Set(['error', 'critical'])
  private static readonly WARNING_NOTIFICATION_CATEGORIES = new Set(['system'])
  
  /**
   * Process a raw IPC message and add UI-specific properties.
   */
  public static processMessage(message: IPCMessage): ProcessedMessage {
    return {
      ...message,
      shouldNotify: this.shouldNotify(message),
      displayClass: this.getDisplayClass(message),
      icon: this.getIcon(message)
    }
  }
  
  /**
   * Determine if message should trigger a notification.
   */
  private static shouldNotify(message: IPCMessage): boolean {
    // Critical and error always notify
    if (this.NOTIFICATION_LEVELS.has(message.level)) {
      return true
    }
    
    // System warnings also notify
    if (message.level === 'warning' && 
        this.WARNING_NOTIFICATION_CATEGORIES.has(message.category)) {
      return true
    }
    
    return false
  }
  
  /**
   * Get CSS class for message display.
   */
  private static getDisplayClass(message: IPCMessage): string {
    const levelClass = `message-${message.level}`
    const categoryClass = `category-${message.category}`
    return `${levelClass} ${categoryClass}`
  }
  
  /**
   * Get icon for message level.
   */
  private static getIcon(message: IPCMessage): string {
    const iconMap: Record<string, string> = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      debug: '🐛'
    }
    return iconMap[message.level] || 'ℹ️'
  }
  
  /**
   * Check if message is a legacy format.
   */
  public static isLegacyMessage(data: any): boolean {
    return typeof data === 'object' && 
           data.type && 
           data.timestamp &&
           !data.id &&
           !data.level
  }
  
  /**
   * Convert legacy message format to new format.
   */
  public static convertLegacyMessage(data: any): IPCMessage {
    const level = this.mapLegacyLevel(data)
    
    return {
      id: generateLegacyId(),
      timestamp: data.timestamp || new Date().toISOString(),
      level,
      category: this.mapLegacyCategory(data),
      source: 'legacy_handler',
      content: this.extractLegacyContent(data),
      data: data.data
    }
  }
  
  /**
   * Map legacy message type to new level.
   */
  private static mapLegacyLevel(data: any): IPCMessage['level'] {
    if (data.type === 'error') return 'error'
    if (data.data?.level) return data.data.level as IPCMessage['level']
    return 'info'
  }
  
  /**
   * Map legacy message type to new category.
   */
  private static mapLegacyCategory(data: any): IPCMessage['category'] {
    if (data.type === 'progress') return 'process'
    if (data.type === 'error') return 'system'
    if (data.type === 'result') return 'process'
    return 'system'
  }
  
  /**
   * Extract content from legacy message.
   */
  private static extractLegacyContent(data: any): string {
    if (data.data?.message) return data.data.message
    if (data.data?.error) return data.data.error
    if (typeof data.data === 'string') return data.data
    return JSON.stringify(data.data || {})
  }
  
  /**
   * Filter messages by level.
   */
  public static filterByLevel(messages: ProcessedMessage[], level: string): ProcessedMessage[] {
    if (level === 'all') return messages
    return messages.filter(message => message.level === level)
  }
  
  /**
   * Filter messages by category.
   */
  public static filterByCategory(messages: ProcessedMessage[], category: string): ProcessedMessage[] {
    if (category === 'all') return messages
    return messages.filter(message => message.category === category)
  }
  
  /**
   * Get user-friendly level name.
   */
  public static getLevelDisplayName(level: string): string {
    const displayNames: Record<string, string> = {
      debug: 'Debug',
      info: 'Info',
      warning: 'Warning',
      error: 'Error',
      critical: 'Critical'
    }
    return displayNames[level] || level
  }
  
  /**
   * Get user-friendly category name.
   */
  public static getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      system: 'System',
      process: 'Process',
      model: 'Model',
      user: 'User'
    }
    return displayNames[category] || category
  }
}