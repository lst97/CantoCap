/**
 * Electron Environment Type Declarations
 * Defines global variables and types for different Electron processes
 */

// Main Process Environment (Node.js)
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    ELECTRON_RENDERER_URL?: string;
    ELECTRON_DEV?: string;
  }

  interface Process {
    platform: 'darwin' | 'win32' | 'linux' | 'freebsd' | 'openbsd' | 'sunos';
    contextIsolated: boolean;
    resourcesPath: string;
  }
}

// Preload Process Environment
declare global {
  // Electron API types
  namespace Electron {
    interface IpcRenderer {
      invoke<T = any>(channel: string, ...args: any[]): Promise<T>;
      send(channel: string, ...args: any[]): void;
      on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this;
      removeListener(channel: string, listener: (...args: any[]) => void): this;
      removeAllListeners(channel: string): this;
    }

    interface ContextBridge {
      exposeInMainWorld(apiKey: string, api: any): void;
    }
  }

  // Browser Environment Globals
  interface Window {
    // Electron APIs exposed through context bridge
    cantocapAPI: import('./index').ElectronAPI;
    electronAPI: import('./index').ElectronAPI;
    electron: any;
    
    // Debug API (development only)
    debugAPI?: {
      getProcessInfo: () => any;
      testIPC: () => Promise<any>;
    };
  }

  // Web API types for renderer process
  interface Performance {
    now(): number;
    mark(markName: string): void;
    measure(measureName: string, startMark?: string, endMark?: string): void;
    getEntriesByType(type: string): PerformanceEntry[];
    clearMarks(markName?: string): void;
    clearMeasures(measureName?: string): void;
  }

  interface PerformanceEntry {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }

  // IndexedDB types for offline storage
  interface IDBDatabase {
    name: string;
    version: number;
    objectStoreNames: DOMStringList;
    transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction;
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
    deleteObjectStore(name: string): void;
    close(): void;
  }

  interface IDBTransaction {
    objectStore(name: string): IDBObjectStore;
    abort(): void;
    oncomplete: ((this: IDBTransaction, ev: Event) => any) | null;
    onerror: ((this: IDBTransaction, ev: Event) => any) | null;
    onabort: ((this: IDBTransaction, ev: Event) => any) | null;
  }

  interface IDBObjectStore {
    name: string;
    keyPath: string | string[] | null;
    indexNames: DOMStringList;
    add(value: any, key?: IDBValidKey): IDBRequest;
    put(value: any, key?: IDBValidKey): IDBRequest;
    get(query: IDBValidKey | IDBKeyRange): IDBRequest;
    delete(query: IDBValidKey | IDBKeyRange): IDBRequest;
    clear(): IDBRequest;
    count(query?: IDBValidKey | IDBKeyRange): IDBRequest;
    createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): IDBIndex;
  }

  // Node.js globals that might be available in Electron renderer
  declare var global: typeof globalThis;
  declare var process: NodeJS.Process;
  
  // Performance API
  declare var performance: Performance;
  
  // Console API
  declare var console: Console;
}

// Electron-specific global variables
declare global {
  // Electron static path (available in packaged apps)
  var __static: string;
  
  // Webpack/Vite build variables
  var __dirname: string;
  var __filename: string;
}

// Module augmentation for existing types
declare module '@electron-toolkit/preload' {
  export const electronAPI: any;
}

declare module '@electron-toolkit/utils' {
  export const electronApp: any;
  export const optimizer: any;
  export const is: {
    dev: boolean;
    mac: boolean;
    windows: boolean;
    linux: boolean;
  };
}

// Export empty object to make this a module
export {};