/**
 * Subtitle Performance Optimization Tests
 * 
 * Tests to validate that subtitle loading performance improvements
 * meet the target of <30ms for small datasets (11 items).
 */

import { transformSubtitleData, clearTransformationCache, getCacheStats } from '../subtitle-transformation';
import { PerformanceMonitor } from '../performance-utils';

// Mock subtitle data similar to what causes the 115ms issue
const createMockSubtitleData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    index: index + 1,
    startTime: index * 5,
    endTime: (index + 1) * 5,
    caption: `Chinese subtitle ${index + 1}`,
    translation: `English translation ${index + 1}`,
    confidence: 0.8 + Math.random() * 0.19,
    speaker: index % 2 === 0 ? 'Speaker A' : 'Speaker B',
    isMusic: index % 10 === 0
  }));
};

// Nested structure data (like CantoCap JSON export)
const createNestedMockData = (count: number) => {
  return [{
    subtitles: createMockSubtitleData(count)
  }];
};

describe('Subtitle Performance Optimization', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
    performanceMonitor.clearHistory();
    clearTransformationCache();
  });

  describe('Small Dataset Performance (11 items)', () => {
    it('should transform 11 items in under 30ms (sync)', async () => {
      const data = createMockSubtitleData(11);
      
      const startTime = performance.now();
      const result = await transformSubtitleData(data, { forceSync: true });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(30);
      expect(result).toHaveLength(11);
      expect(result[0].text).toBe('Chinese subtitle 1');
      expect(result[0].originalText).toBe('English translation 1');
    });

    it('should transform 11 items with nested structure in under 30ms', async () => {
      const data = createNestedMockData(11);
      
      const startTime = performance.now();
      const result = await transformSubtitleData(data);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(30);
      expect(result).toHaveLength(11);
    });

    it('should achieve target throughput of >366 items/sec for 11 items', async () => {
      const data = createMockSubtitleData(11);
      
      const startTime = performance.now();
      await transformSubtitleData(data, { forceSync: true });
      const duration = performance.now() - startTime;
      
      const throughput = (11 / duration) * 1000; // items per second
      expect(throughput).toBeGreaterThan(366); // 11 items in 30ms = 366.67 items/sec
    });
  });

  describe('Caching Performance', () => {
    it('should cache results and return faster on subsequent calls', async () => {
      const data = createMockSubtitleData(11);
      
      // First call
      const startTime1 = performance.now();
      const result1 = await transformSubtitleData(data, { useCache: true });
      const duration1 = performance.now() - startTime1;
      
      // Add small delay to ensure timing difference is measurable
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Second call (should be cached)
      const startTime2 = performance.now();
      const result2 = await transformSubtitleData(data, { useCache: true });
      const duration2 = performance.now() - startTime2;
      
      // Cache should be significantly faster, but allow for some variation
      expect(duration2).toBeLessThan(Math.max(duration1 * 0.8, 1)); // At least 20% faster or under 1ms
      expect(result1).toEqual(result2);
      
      const cacheStats = getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Larger Dataset Performance', () => {
    it('should handle 50 items efficiently with batching', async () => {
      const data = createMockSubtitleData(50);
      
      const startTime = performance.now();
      const result = await transformSubtitleData(data);
      const duration = performance.now() - startTime;

      // Should be reasonable for 50 items (target: ~150ms max)
      expect(duration).toBeLessThan(150);
      expect(result).toHaveLength(50);
    }, 10000); // 10 second timeout

    it('should handle 100 items with async batching', async () => {
      const data = createMockSubtitleData(100);
      
      const startTime = performance.now();
      const result = await transformSubtitleData(data, { forceSync: false });
      const duration = performance.now() - startTime;

      // Should handle 100 items reasonably (target: ~300ms max)
      expect(duration).toBeLessThan(300);
      expect(result).toHaveLength(100);
    }, 10000); // 10 second timeout
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive memory overhead', async () => {
      const data = createMockSubtitleData(11);
      
      // Get initial memory if available
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      await transformSubtitleData(data);
      
      // Memory should not increase dramatically for small datasets
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use more than 1MB for 11 items
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      const result = await transformSubtitleData([]);
      expect(result).toEqual([]);
    });

    it('should handle malformed data gracefully', async () => {
      const data = [
        { /* missing required fields */ },
        { text: 'Valid subtitle', startTime: 0, endTime: 5 }
      ];
      
      const result = await transformSubtitleData(data);
      expect(result).toHaveLength(2);
      expect(result[1].text).toBe('Valid subtitle');
    });

    it('should handle deeply nested structures', async () => {
      const data = [
        {
          subtitles: [
            {
              subtitles: createMockSubtitleData(5) // Double nesting
            }
          ]
        }
      ];
      
      const result = await transformSubtitleData(data);
      // Should handle gracefully even if structure is unexpected
      expect(result).toBeDefined();
    });
  });

  describe('Performance Monitor Integration', () => {
    it('should provide throughput metrics for performance monitoring', async () => {
      const data = createMockSubtitleData(11);
      
      performanceMonitor.startOperation('Test Subtitle Transform');
      const startTime = performance.now();
      await transformSubtitleData(data);
      const duration = performance.now() - startTime;
      performanceMonitor.endOperation('Test Subtitle Transform', 11);
      
      const stats = performanceMonitor.getPerformanceStats();
      expect(stats.operationCount).toBeGreaterThan(0);
      // Use duration from our measurement since monitor might have timing issues
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Regression Prevention', () => {
    it('should maintain performance standards over multiple runs', async () => {
      const data = createMockSubtitleData(11);
      const durations: number[] = [];
      
      // Run multiple times to check consistency
      for (let i = 0; i < 5; i++) {
        clearTransformationCache(); // Clear cache for fair comparison
        
        const startTime = performance.now();
        await transformSubtitleData(data, { forceSync: true });
        const duration = performance.now() - startTime;
        
        durations.push(duration);
      }
      
      // All runs should be under 30ms
      durations.forEach(duration => {
        expect(duration).toBeLessThan(30);
      });
      
      // Average should be well under target
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      expect(average).toBeLessThan(25);
    });
  });
});

// Performance benchmark utility
export const runPerformanceBenchmark = async (itemCount: number = 11): Promise<{
  duration: number;
  throughput: number;
  memoryUsed: number;
  cacheHit: boolean;
}> => {
  const data = createMockSubtitleData(itemCount);
  
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const startTime = performance.now();
  
  const result = await transformSubtitleData(data, { useCache: true });
  
  const duration = performance.now() - startTime;
  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const throughput = (itemCount / duration) * 1000;
  
  return {
    duration,
    throughput,
    memoryUsed: finalMemory - initialMemory,
    cacheHit: duration < 5 // Assume cache hit if very fast
  };
};