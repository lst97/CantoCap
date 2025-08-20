import { useState, useEffect, useCallback } from 'react';
import { checkFileExists, getFileStatus } from '../utils/fileUtils';
import type { ExportRecord } from '../stores/types/StoreTypes';

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
      console.warn('Error checking file status:', error);
      setStatus({
        exists: false,
        isChecking: false,
        lastChecked: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    if (filePath) {
      checkFile(filePath);
    } else {
      setStatus({ exists: false, isChecking: false });
    }
  }, [filePath, checkFile]);

  return status;
}

/**
 * Hook to check file existence for multiple export records
 */
export function useExportHistoryFileStatus(exportHistory: ExportRecord[]): Map<string, FileStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, FileStatus>>(new Map());

  useEffect(() => {
    const checkFiles = async () => {
      const newStatusMap = new Map<string, FileStatus>();

      // Initialize all entries as checking to prevent false positives
      exportHistory.forEach((record) => {
        const key = `${record.outputPath}-${record.exportedAt}`;
        newStatusMap.set(key, { exists: false, isChecking: true });
      });

      // Update state immediately to show checking status
      setStatusMap(new Map(newStatusMap));

      // Check each export record's file
      const checkPromises = exportHistory.map(async (record) => {
        const key = `${record.outputPath}-${record.exportedAt}`;

        if (!record.outputPath || record.outputPath.trim() === '') {
          return { key, status: { exists: false, isChecking: false } };
        }

        try {
          // Use both methods to ensure accuracy
          const fileExists = await checkFileExists(record.outputPath);
          const fileStats = await getFileStatus(record.outputPath);

          console.log(
            `File check for ${record.outputPath}: exists=${fileExists}, stats.exists=${fileStats.exists}`
          );

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
          console.warn('Error checking file status for export record:', record.outputPath, error);
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

      setStatusMap(newStatusMap);
    };

    if (exportHistory.length > 0) {
      checkFiles();
    } else {
      setStatusMap(new Map());
    }
  }, [exportHistory]);

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
