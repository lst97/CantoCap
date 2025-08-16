import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut, protocol, net } from 'electron';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { DependencyChecker } from './dependency-checker';
import { ProcessManager } from './process-manager';
import { InitializationService } from './initialization-service';
import { AppStateService } from './config/AppStateService';
import { WorkspaceConfigService } from './config/WorkspaceConfigService';
import { GroupConfigService } from './config/GroupConfigService';
import { WorkflowStateService } from './config/WorkflowStateService';
import { IPCConfigHandlers } from './ipc-handlers/IPCConfigHandlers';
import { MediaIPCHandlers } from './ipc-handlers/MediaIPCHandlers';
import { SubtitleIPCHandlers } from './ipc-handlers/SubtitleIPCHandlers';
import { WorkflowIPCHandlers } from './ipc-handlers/WorkflowIPCHandlers';
import { ProcessingIPCHandlers } from './ipc-handlers/ProcessingIPCHandlers';
import type {
  DependencyStatus,
  AppConfig,
  HardwareInfo,
  FileDialogOptions,
  InitializationResult,
} from '../types';

// Enhanced media registry entry with metadata and security features
interface MediaRegistryEntry {
  filePath: string;
  registeredAt: number;
  lastAccessed: number;
  accessCount: number;
  fileSize: number;
  isValid: boolean;
}

// Safe logging function to prevent EPIPE errors
const safeLog = (message: string, ...args: unknown[]) => {
  try {
    if (process.stdout && !process.stdout.destroyed) {
      console.log(message, ...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Silently ignore EPIPE and other stream errors
  }
};

// Register custom protocol for local media access
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localmedia',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true, // Critical for video/audio streaming and seeking
    },
  },
]);

class CantoCap {
  private static instance: CantoCap | null = null;
  private dependencyChecker: DependencyChecker;
  private processManager: ProcessManager;
  private initializationService: InitializationService;
  private appStateService: AppStateService;
  private workspaceConfigService: WorkspaceConfigService;
  private groupConfigService: GroupConfigService;
  private workflowStateService: WorkflowStateService;
  private ipcConfigHandlers: IPCConfigHandlers | null = null;
  private mediaIPCHandlers: MediaIPCHandlers | null = null;
  private subtitleIPCHandlers: SubtitleIPCHandlers | null = null;
  private workflowIPCHandlers: WorkflowIPCHandlers | null = null;
  private processingIPCHandlers: ProcessingIPCHandlers | null = null;
  private mainWindow: BrowserWindow | null = null;
  private mediaRegistry: Map<string, MediaRegistryEntry> = new Map(); // Media ID to file path mapping

  constructor() {
    CantoCap.instance = this;
    this.dependencyChecker = new DependencyChecker();
    this.processManager = new ProcessManager();
    this.initializationService = new InitializationService();
    this.appStateService = new AppStateService();
    this.workspaceConfigService = new WorkspaceConfigService();
    this.groupConfigService = new GroupConfigService();
    this.workflowStateService = new WorkflowStateService();
  }

  public static getInstance(): CantoCap | null {
    return CantoCap.instance;
  }

  private createWindow(): void {
    // Get saved window state
    const windowState = this.appStateService.getWindowState();

    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: windowState.width || 1200,
      height: windowState.height || 800,
      x: windowState.x,
      y: windowState.y,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      autoHideMenuBar: true,
      frame: process.platform === 'darwin' ? false : true,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true, // Enable security with proper CSP
        allowRunningInsecureContent: false, // Use secure content loading
        enableWebSQL: false, // Disable deprecated WebSQL
        experimentalFeatures: false, // Disable experimental features
      },
    });

    // Restore maximized state
    if (windowState.maximized) {
      this.mainWindow.maximize();
    }

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();

      // Open DevTools in development mode
      if (is.dev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Save window state on resize/move
    this.mainWindow.on('resize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('move', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('maximize', () => {
      this.appStateService.updateWindowState({ maximized: true });
    });

    this.mainWindow.on('unmaximize', () => {
      this.appStateService.updateWindowState({ maximized: false });
    });

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    // HMR for renderer base on electron-vite cli
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      safeLog('🔄 Loading renderer from dev server:', process.env['ELECTRON_RENDERER_URL']);
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      const rendererPath = join(__dirname, '../renderer/index.html');
      safeLog('📄 Loading renderer from file:', rendererPath);
      this.mainWindow.loadFile(rendererPath);
    }

    // Add critical diagnostic logging
    this.mainWindow.webContents.on('did-finish-load', () => {
      safeLog('✅ Renderer finished loading');
    });

    this.mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error('❌ Renderer failed to load:', errorCode, errorDescription, validatedURL);
      }
    );

    this.mainWindow.webContents.on('dom-ready', () => {
      safeLog('🌐 DOM ready');

      // Open DevTools automatically to check console
      if (is.dev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Capture console messages from renderer process
    this.mainWindow.webContents.on(
      'console-message',
      ({
        level,
        message,
        lineNumber,
        sourceId,
      }: {
        level: 'info' | 'warning' | 'error' | 'debug';
        message: string;
        lineNumber: number;
        sourceId: string;
      }) => {
        // Convert new string levels to display format
        const logLevel = level.toUpperCase();
        const source = sourceId ? sourceId.split('/').pop() : 'renderer';

        // Log all renderer console messages to main process
        console.log(`🖥️  [RENDERER ${logLevel}] ${source}:${lineNumber} - ${message}`);

        // Highlight React errors
        if (
          message.includes('React') ||
          message.includes('Maximum update depth') ||
          message.includes('Error #185')
        ) {
          console.error(`🚨 [REACT ERROR] ${message}`);
        }
      }
    );

    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('⏳ Renderer started loading');
    });
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();

    if (!isMaximized) {
      this.appStateService.updateWindowState({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: false,
      });
    }
  }

  private setupIPC(): void {
    if (!this.mainWindow) return;

    // Initialize the new IPC config handlers
    this.ipcConfigHandlers = new IPCConfigHandlers(
      this.appStateService,
      this.workspaceConfigService,
      this.groupConfigService,
      this.mainWindow.webContents
    );

    // Initialize media processing handlers
    this.mediaIPCHandlers = new MediaIPCHandlers();

    // Initialize subtitle processing handlers
    this.subtitleIPCHandlers = new SubtitleIPCHandlers();

    // Initialize workflow state handlers
    this.workflowIPCHandlers = new WorkflowIPCHandlers(
      this.workflowStateService,
      this.mainWindow.webContents
    );

    // Initialize processing handlers
    this.processingIPCHandlers = new ProcessingIPCHandlers(
      this.processManager,
      this.mainWindow.webContents
    );

    safeLog('✅ IPC config handlers initialized');
    safeLog('✅ Video processing handlers initialized');
    safeLog('✅ Subtitle processing handlers initialized');
    safeLog('✅ Workflow state handlers initialized');
    safeLog('✅ Processing IPC handlers initialized');

    // System Operations
    ipcMain.handle('check-dependencies', async (): Promise<Record<string, DependencyStatus>> => {
      return await this.dependencyChecker.checkAll();
    });

    // Initialization and Setup
    ipcMain.handle('run-initialization', async (): Promise<InitializationResult> => {
      return await this.initializationService.initialize();
    });

    ipcMain.handle('open-python-download', async (): Promise<void> => {
      await this.initializationService.openPythonDownload();
    });

    ipcMain.handle('open-pyenv-guide', async (): Promise<void> => {
      await this.initializationService.openPyenvGuide();
    });

    ipcMain.handle('open-ffmpeg-download', async (): Promise<void> => {
      await this.initializationService.openFFmpegDownload();
    });

    ipcMain.handle('run-engine-setup', async (): Promise<boolean> => {
      return await this.initializationService.runEngineSetup();
    });

    ipcMain.handle('dialog:openFile', async (_event, options?: FileDialogOptions) => {
      if (!this.mainWindow) return { canceled: true, filePaths: [] };

      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile'],
        filters: options?.filters || [
          {
            name: 'Video Files',
            extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
          },
          {
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return result;
    });

    ipcMain.handle('dialog:openFolder', async () => {
      if (!this.mainWindow) return { canceled: true, filePaths: [] };

      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
      });
      return result;
    });

    // Process Management
    ipcMain.on('start-transcription', async (_event, config: AppConfig) => {
      try {
        await this.processManager.startTranscription(
          config,
          (_eventType: string, data: unknown) => {
            // Send all events using the modern IPC message format
            this.mainWindow?.webContents.send('ipc-message', data);
          }
        );
      } catch (error) {
        // Send error using new format
        this.mainWindow?.webContents.send('ipc-message', {
          id: `error_${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          category: 'system',
          source: 'main_process',
          content: error instanceof Error ? error.message : 'Unknown error',
          data: {
            type: 'startup_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    ipcMain.handle('check-hardware', async (): Promise<HardwareInfo> => {
      // TODO: Implement hardware check
      return {
        checking: false,
        gpuAcceleration: false,
        memoryUsage: '0%',
        deviceInfo: 'Unknown',
        modelLoadTime: 0,
        processingSpeed: '0.00x',
      };

      // return await this.processManager.checkHardware();
    });

    ipcMain.on('cancel-process', () => {
      this.processManager.cancelProcess();
    });

    // Window Controls
    ipcMain.handle('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle('window:close', () => {
      this.mainWindow?.close();
    });

    ipcMain.handle('window:isMaximized', () => {
      return this.mainWindow?.isMaximized() || false;
    });

    ipcMain.handle('get-platform', () => {
      return process.platform;
    });

    // DevTools Controls
    ipcMain.handle('devtools:open', () => {
      this.mainWindow?.webContents.openDevTools();
    });

    ipcMain.handle('devtools:close', () => {
      this.mainWindow?.webContents.closeDevTools();
    });

    ipcMain.handle('devtools:toggle', () => {
      this.mainWindow?.webContents.toggleDevTools();
    });

    // Utility handlers
    ipcMain.handle('get-app-version', (): string => {
      return app.getVersion();
    });

    ipcMain.handle('open-external-url', async (_event, url: string): Promise<void> => {
      await shell.openExternal(url);
    });

    // Export Operations
    ipcMain.handle(
      'dialog:saveFile',
      async (
        _event,
        options?: {
          defaultPath?: string;
          filters?: Array<{ name: string; extensions: string[] }>;
        }
      ) => {
        if (!this.mainWindow) return { canceled: true, filePath: null };

        const result = await dialog.showSaveDialog(this.mainWindow, {
          defaultPath: options?.defaultPath,
          filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
        });

        return result;
      }
    );

    ipcMain.handle('export:writeFile', async (_event, filePath: string, content: string) => {
      try {
        await writeFile(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        console.error('Failed to write export file:', error);
        throw new Error(
          `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // File Reading Operations
    ipcMain.handle('file:readJson', async (_event, filePath: string) => {
      try {
        const content = await readFile(filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Failed to read JSON file:', error);
        throw new Error(
          `Failed to read JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // ============================================================================
    // SUBTITLE PERSISTENCE HANDLERS
    // ============================================================================
    // Subtitle persistence is now handled by SubtitleIPCHandlers - handlers are
    // automatically registered in the SubtitleIPCHandlers constructor

    safeLog('✅ All IPC handlers initialized successfully');
  }

  public cleanup(): void {
    // Cleanup IPC handlers
    if (this.ipcConfigHandlers) {
      this.ipcConfigHandlers.cleanup();
    }

    // Cleanup media handlers
    if (this.mediaIPCHandlers) {
      this.mediaIPCHandlers.cleanup();
    }

    // Cleanup subtitle handlers
    if (this.subtitleIPCHandlers) {
      this.subtitleIPCHandlers.cleanup();
    }

    // Cleanup workflow handlers
    if (this.workflowIPCHandlers) {
      this.workflowIPCHandlers.cleanup();
    }

    // Cleanup processing handlers
    if (this.processingIPCHandlers) {
      this.processingIPCHandlers.cleanup();
    }

    // Cleanup media registry
    this.clearMediaRegistry();
  }

  private setupMediaProtocol(): void {
    // Setup local media protocol handler with enhanced security and range request support
    protocol.handle('localmedia', (request) => {
      try {
        const mediaId = request.url.replace('localmedia://', '').replace(/\/$/, ''); // Remove trailing slash
        const registryEntry = this.mediaRegistry.get(mediaId);

        if (!registryEntry) {
          console.error('🎬 Media ID not found in registry:', mediaId);
          throw new Error(`Media ID not found: ${mediaId}`);
        }

        // Validate file still exists and hasn't been tampered with
        if (!registryEntry.isValid || !existsSync(registryEntry.filePath)) {
          console.error('🎬 Media file no longer valid:', registryEntry.filePath);
          this.mediaRegistry.delete(mediaId);
          throw new Error(`Media file no longer valid: ${registryEntry.filePath}`);
        }

        // Verify file size hasn't changed (basic integrity check)
        try {
          const currentStats = statSync(registryEntry.filePath);
          if (currentStats.size !== registryEntry.fileSize) {
            console.error(
              '🎬 Media file size mismatch, possible tampering:',
              registryEntry.filePath
            );
            this.mediaRegistry.delete(mediaId);
            throw new Error(`Media file integrity check failed: ${registryEntry.filePath}`);
          }
        } catch (statError) {
          console.error('🎬 Error checking file stats:', statError);
          this.mediaRegistry.delete(mediaId);
          throw new Error(`Media file access error: ${registryEntry.filePath}`);
        }

        // Update access tracking
        registryEntry.lastAccessed = Date.now();
        registryEntry.accessCount++;

        // Use Electron's native file streaming with createReadStream for better range request support

        try {
          // Get file stats for Content-Length header
          const stats = statSync(registryEntry.filePath);

          // Determine MIME type
          const mimeType = this.getMimeType(registryEntry.filePath);

          // Create proper file URL for Electron's net.fetch
          const fileUrl = new URL(`file://${registryEntry.filePath}`).href;

          // Check if this is a range request
          const rangeHeader = request.headers.get('Range');

          if (rangeHeader) {
            // Handle range requests for video seeking using net.fetch with range headers
            return net.fetch(fileUrl, {
              headers: {
                'Range': rangeHeader
              }
            }).then(response => {
              // Pass through the range response from file system with correct headers
              const range = rangeHeader.replace(/bytes=/, '').split('-');
              const start = parseInt(range[0], 10);
              const end = range[1] ? parseInt(range[1], 10) : stats.size - 1;
              const chunksize = end - start + 1;

              return new Response(response.body, {
                status: 206,
                headers: {
                  'Content-Type': mimeType,
                  'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': chunksize.toString(),
                  'Cache-Control': 'no-cache',
                },
              });
            });
          } else {
            // Serve full file using net.fetch
            return net.fetch(fileUrl).then(response => {
              return new Response(response.body, {
                status: 200,
                headers: {
                  'Content-Type': mimeType,
                  'Content-Length': stats.size.toString(),
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'no-cache',
                },
              });
            });
          }
        } catch (fileError) {
          console.error('🎬 Error creating file stream:', fileError);
          throw new Error(`Failed to stream file: ${registryEntry.filePath}`);
        }
      } catch (error) {
        console.error('🎬 Error serving media file:', error);
        throw error;
      }
    });

    console.log('✅ Local media protocol handler registered with enhanced security');
  }

  public registerMediaFile(filePath: string): string {
    try {
      // Validate file exists and get metadata
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const fileStats = statSync(filePath);
      if (!fileStats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Generate unique media ID for the file path
      const mediaId = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create enhanced registry entry
      const registryEntry: MediaRegistryEntry = {
        filePath,
        registeredAt: Date.now(),
        lastAccessed: 0,
        accessCount: 0,
        fileSize: fileStats.size,
        isValid: true,
      };

      this.mediaRegistry.set(mediaId, registryEntry);

      // Cleanup old entries to prevent memory leaks
      this.cleanupOldRegistryEntries();

      return mediaId;
    } catch (error) {
      console.error('🎬 Failed to register media file:', error);
      throw error;
    }
  }

  public unregisterMediaFile(mediaId: string): void {
    const registryEntry = this.mediaRegistry.get(mediaId);
    if (registryEntry && this.mediaRegistry.delete(mediaId)) {
      // Media file unregistered successfully
    }
  }

  public clearMediaRegistry(): void {
    this.mediaRegistry.clear();
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      // Video formats
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      flv: 'video/x-flv',
      m4v: 'video/x-m4v',
      '3gp': 'video/3gpp',
      // Audio formats
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      wma: 'audio/x-ms-wma',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private cleanupOldRegistryEntries(): void {
    const now = Date.now();
    const maxAge = 1000 * 60 * 60; // 1 hour
    const maxEntries = 100; // Maximum number of entries to keep

    // Remove entries older than maxAge or if we have too many entries
    const entries = Array.from(this.mediaRegistry.entries());
    const entriesToRemove: string[] = [];

    // Sort by registration time, oldest first
    entries.sort((a, b) => a[1].registeredAt - b[1].registeredAt);

    entries.forEach(([mediaId, entry], index) => {
      const age = now - entry.registeredAt;
      const shouldRemoveByAge = age > maxAge;
      const shouldRemoveByCount =
        entries.length > maxEntries && index < entries.length - maxEntries;

      if (shouldRemoveByAge || shouldRemoveByCount) {
        entriesToRemove.push(mediaId);
      }
    });

    entriesToRemove.forEach((mediaId) => {
      this.mediaRegistry.delete(mediaId);
    });

    if (entriesToRemove.length > 0) {
      console.log('🎬 Cleaned up old registry entries:', {
        removedCount: entriesToRemove.length,
        remainingCount: this.mediaRegistry.size,
      });
    }
  }

  private setupGlobalShortcuts(): void {
    // Register global shortcuts for DevTools
    globalShortcut.register('F12', () => {
      this.mainWindow?.webContents.toggleDevTools();
    });

    globalShortcut.register('CommandOrControl+Shift+I', () => {
      this.mainWindow?.webContents.toggleDevTools();
    });

    globalShortcut.register('CommandOrControl+Option+I', () => {
      this.mainWindow?.webContents.toggleDevTools();
    });

    // Force open DevTools in development
    if (is.dev) {
      globalShortcut.register('CommandOrControl+Shift+J', () => {
        this.mainWindow?.webContents.openDevTools({ mode: 'bottom' });
      });
    }
  }

  public async initialize(): Promise<void> {
    // This method will be called when Electron has finished initialization
    await app.whenReady();

    // Register local media protocol handler
    this.setupMediaProtocol();

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.cantocap.gui');

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    this.createWindow();
    this.setupIPC();
    this.setupGlobalShortcuts();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });
  }
}

const cantocap = new CantoCap();

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  cantocap.cleanup();
  if (process.platform !== 'darwin') app.quit();
});

// Cleanup when app is quitting
app.on('before-quit', () => {
  cantocap.cleanup();
});

// Security: Prevent new window creation is handled by setWindowOpenHandler in createWindow()

// Initialize the application
cantocap.initialize().catch(console.error);

// Export for other modules
export { CantoCap };
