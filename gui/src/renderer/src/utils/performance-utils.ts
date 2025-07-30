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
  private warningThreshold: number = 100; // ms
  private errorThreshold: number = 1000;   // ms

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startOperation(operationName: string): void {
    this.startTime = performance.now();
    console.log(`🚀 Starting operation: ${operationName}`);
  }

  endOperation(operationName: string, dataSize?: number): void {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    const sizeInfo = dataSize ? ` (${dataSize} items)` : '';
    
    if (duration > this.errorThreshold) {
      console.error(`🚨 PERFORMANCE ISSUE: ${operationName}${sizeInfo} took ${duration.toFixed(2)}ms`);
    } else if (duration > this.warningThreshold) {
      console.warn(`⚠️ SLOW OPERATION: ${operationName}${sizeInfo} took ${duration.toFixed(2)}ms`);
    } else {
      console.log(`✅ Operation completed: ${operationName}${sizeInfo} in ${duration.toFixed(2)}ms`);
    }
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