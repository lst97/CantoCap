import type { ElectronWindow } from '../stores/types/StoreTypes';

/**
 * Check if a file exists at the given path
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    if (!filePath) return false;
    
    const response = await (window as unknown as ElectronWindow)
      .electron
      .ipcRenderer
      .invoke('file:exists', filePath);
    
    return Boolean(response);
  } catch (error) {
    console.warn('Error checking file existence:', error);
    return false;
  }
}

/**
 * Get file status information including existence and size
 */
export async function getFileStatus(filePath: string): Promise<{
  exists: boolean;
  size?: number;
  lastModified?: number;
}> {
  try {
    if (!filePath) return { exists: false };
    
    const stats = await (window as unknown as ElectronWindow)
      .electron
      .ipcRenderer
      .invoke('file:getStats', filePath);
    
    if (stats && typeof stats === 'object' && 'size' in stats && 'mtime' in stats) {
      return {
        exists: true,
        size: stats.size as number,
        lastModified: stats.mtime as number
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.warn('Error getting file status:', error);
    return { exists: false };
  }
}