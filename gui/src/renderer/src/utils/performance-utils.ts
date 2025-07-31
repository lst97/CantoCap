/**
 * Performance utilities for handling large datasets and preventing UI freezing
 */

// Debounce function to prevent excessive re-renders
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Throttle function for limiting function calls
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Performance monitoring for detecting potential freezes
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private startTime: number = 0;
  private operationName: string = '';
  private warningThreshold: number = 100; // ms
  private errorThreshold: number = 1000;   // ms
  private operationHistory: Array<{
    name: string;
    duration: number;
    dataSize?: number;
    timestamp: number;
    throughput?: number;
  }> = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startOperation(operationName: string): void {
    this.startTime = performance.now();
    this.operationName = operationName;
    console.log(`🚀 Starting operation: ${operationName}`);
  }

  endOperation(operationName: string, dataSize?: number): void {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    // Calculate throughput for data operations
    const throughput = dataSize && duration > 0 ? (dataSize / duration * 1000) : undefined;
    const throughputInfo = throughput ? ` (${throughput.toFixed(1)} items/sec)` : '';
    
    const sizeInfo = dataSize ? ` (${dataSize} items)` : '';
    
    // Store operation in history
    this.operationHistory.push({
      name: operationName,
      duration,
      dataSize,
      timestamp: Date.now(),
      throughput
    });
    
    // Keep only last 50 operations
    if (this.operationHistory.length > 50) {
      this.operationHistory.shift();
    }
    
    // Enhanced logging with performance targets
    if (duration > this.errorThreshold) {
      console.error(`🚨 PERFORMANCE ISSUE: ${operationName}${sizeInfo} took ${duration.toFixed(2)}ms${throughputInfo}`);
    } else if (duration > this.warningThreshold) {
      console.warn(`⚠️ SLOW OPERATION: ${operationName}${sizeInfo} took ${duration.toFixed(2)}ms${throughputInfo}`);
      
      // Provide optimization suggestions for subtitle operations
      if (operationName.includes('Session Init') && dataSize) {
        const targetTime = dataSize * 3; // Target: 3ms per item
        if (duration > targetTime) {
          console.warn(`💡 OPTIMIZATION TIP: Target time for ${dataSize} items should be ~${targetTime}ms. Consider async processing or caching.`);
        }
      }
    } else {
      console.log(`✅ Operation completed: ${operationName}${sizeInfo} in ${duration.toFixed(2)}ms${throughputInfo}`);
    }
  }
  
  // Get performance statistics
  getPerformanceStats(): {
    averageDuration: number;
    operationCount: number;
    slowOperations: number;
    fastestOperation: { name: string; duration: number } | null;
    slowestOperation: { name: string; duration: number } | null;
  } {
    if (this.operationHistory.length === 0) {
      return {
        averageDuration: 0,
        operationCount: 0,
        slowOperations: 0,
        fastestOperation: null,
        slowestOperation: null
      };
    }
    
    const durations = this.operationHistory.map(op => op.duration);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const slowOperations = this.operationHistory.filter(op => op.duration > this.warningThreshold).length;
    
    const sortedOps = [...this.operationHistory].sort((a, b) => a.duration - b.duration);
    
    return {
      averageDuration,
      operationCount: this.operationHistory.length,
      slowOperations,
      fastestOperation: sortedOps[0] ? { name: sortedOps[0].name, duration: sortedOps[0].duration } : null,
      slowestOperation: sortedOps[sortedOps.length - 1] ? { 
        name: sortedOps[sortedOps.length - 1].name, 
        duration: sortedOps[sortedOps.length - 1].duration 
      } : null
    };
  }
  
  // Clear performance history
  clearHistory(): void {
    this.operationHistory = [];
  }
}

// Memory usage monitoring
export const getMemoryUsage = (): {
  used: number;
  total: number;
  percentage: number;
} | null => {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize;
    const total = memory.totalJSHeapSize;
    
    return {
      used: Math.round(used / 1024 / 1024 * 100) / 100, // MB
      total: Math.round(total / 1024 / 1024 * 100) / 100, // MB
      percentage: Math.round((used / total) * 100)
    };
  }
  return null;
};

// Check if we should use performance optimizations based on data size
export const shouldUsePerformanceMode = (dataSize: number): boolean => {
  const memoryUsage = getMemoryUsage();
  
  // Use performance mode if:
  // - Data size is large (>100 items)
  // - Memory usage is high (>70%)
  return dataSize > 100 || (memoryUsage?.percentage || 0) > 70;
};

// Batch processing for large arrays to prevent blocking
export const batchProcess = async <T, R>(
  items: T[],
  processor: (item: T, index: number) => R | Promise<R>,
  batchSize: number = 50
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );
    results.push(...batchResults);
    
    // Yield to event loop between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
};

// RequestIdleCallback polyfill
export const requestIdleCallbackPolyfill = (callback: () => void): void => {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(callback);
  } else {
    setTimeout(callback, 0);
  }
};