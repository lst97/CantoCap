import { useState, useEffect, useCallback, useMemo } from 'react';
import { checkFileExists, getFileStatus } from '../utils/fileUtils';
import type { ExportRecord } from '../stores/types/StoreTypes';
import { createHookLogger } from '../utils/logger';

// Module-scoped loggers to maintain stable identity across renders
const fileExistsLogger = createHookLogger('FileExistsHook');
const exportHistoryLogger = createHookLogger('ExportHistoryFileStatusHook');

export interface FileStatus {
  exists: boolean;
  isChecking: boolean;
  lastChecked?: number;
  size?: number;
  lastModified?: number;
}

/**
 * Hook to check file existence for a single file path
 */
export function useFileExists(filePath: string | null | undefined): FileStatus {
  const [status, setStatus] = useState<FileStatus>({
    exists: false, // Start as false, will be updated after check
    isChecking: true, // Start checking immediately
  });

  const checkFile = useCallback(async (path: string) => {
    if (!path) {
      setStatus({ exists: false, isChecking: false });
      return;
    }

    setStatus((prev) => ({ ...prev, isChecking: true }));

    try {
      const fileStatus = await getFileStatus(path);
      setStatus({
        exists: fileStatus.exists,
        isChecking: false,
        lastChecked: Date.now(),
        size: fileStatus.size,
        lastModified: fileStatus.lastModified,
      });
    } catch (error) {
      fileExistsLogger.warn('File status check failed', { path, error });
      setStatus({
        exists: false,
        isChecking: false,
        lastChecked: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    fileExistsLogger.hookMount({ filePath });
    if (filePath) {
      checkFile(filePath);
    } else {
      setStatus({ exists: false, isChecking: false });
    }
    return () => fileExistsLogger.hookUnmount();
  }, [filePath, checkFile]);

  return status;
}

/**
 * Hook to check file existence for multiple export records
 */
export function useExportHistoryFileStatus(exportHistory: ExportRecord[]): Map<string, FileStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, FileStatus>>(new Map());

  // Create a stable reference to the minimal history data we care about
  const stableHistory = useMemo(() => {
    return exportHistory.map((record) => ({
      outputPath: record.outputPath,
      exportedAt: record.exportedAt,
    }));
  }, [exportHistory]);

  useEffect(() => {
    exportHistoryLogger.hookMount({ exportRecordsCount: stableHistory.length });

    let isMounted = true;

    const checkFiles = async () => {
      const newStatusMap = new Map<string, FileStatus>();

      // Check each export record's file directly without intermediate state update
      const checkPromises = stableHistory.map(async (record) => {
        const key = `${record.outputPath}-${record.exportedAt}`;

        if (!record.outputPath || record.outputPath.trim() === '') {
          return { key, status: { exists: false, isChecking: false } };
        }

        try {
          // Use both methods to ensure accuracy
          const fileExists = await checkFileExists(record.outputPath);
          const fileStats = await getFileStatus(record.outputPath);

          // Only log when there's a discrepancy between checks
          if (fileExists !== fileStats.exists) {
            exportHistoryLogger.warn('File existence check discrepancy', {
              path: record.outputPath,
              checkFileExists: fileExists,
              getFileStatus: fileStats.exists,
            });
          }

          return {
            key,
            status: {
              exists: fileExists && fileStats.exists,
              isChecking: false,
              lastChecked: Date.now(),
              size: fileStats.size,
              lastModified: fileStats.lastModified,
            },
          };
        } catch (error) {
          exportHistoryLogger.warn('Export record file check failed', {
            path: record.outputPath,
            exportedAt: record.exportedAt,
            error,
          });
          return {
            key,
            status: {
              exists: false,
              isChecking: false,
              lastChecked: Date.now(),
            },
          };
        }
      });

      const results = await Promise.all(checkPromises);

      // Update the status map with results
      results.forEach(({ key, status }) => {
        newStatusMap.set(key, status);
      });

      // Only update state if component is still mounted
      if (isMounted) {
        setStatusMap(newStatusMap);
      }
    };

    if (stableHistory.length > 0) {
      checkFiles();
    } else if (isMounted) {
      setStatusMap(new Map());
    }

    return () => {
      isMounted = false;
      exportHistoryLogger.hookUnmount();
    };
  }, [stableHistory]);

  return statusMap;
}

/**
 * Helper function to get file status for a specific export record
 */
export function getExportRecordStatus(
  record: ExportRecord,
  statusMap: Map<string, FileStatus>
): FileStatus {
  const key = `${record.outputPath}-${record.exportedAt}`;
  return statusMap.get(key) || { exists: false, isChecking: true };
}
