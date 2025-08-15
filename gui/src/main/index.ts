import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { DependencyChecker } from './dependency-checker';
import { ProcessManager } from './process-manager';
import { InitializationService } from './initialization-service';
import { AppStateService } from './config/AppStateService';
import { WorkspaceConfigService } from './config/WorkspaceConfigService';
import { GroupConfigService } from './config/GroupConfigService';
import { WorkflowStateService } from './config/WorkflowStateService';
import { IPCConfigHandlers } from './ipc-handlers/IPCConfigHandlers';
import { VideoIPCHandlers } from './ipc-handlers/VideoIPCHandlers';
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

class CantoCap {
  private dependencyChecker: DependencyChecker;
  private processManager: ProcessManager;
  private initializationService: InitializationService;
  private appStateService: AppStateService;
  private workspaceConfigService: WorkspaceConfigService;
  private groupConfigService: GroupConfigService;
  private workflowStateService: WorkflowStateService;
  private ipcConfigHandlers: IPCConfigHandlers | null = null;
  private videoIPCHandlers: VideoIPCHandlers | null = null;
  private subtitleIPCHandlers: SubtitleIPCHandlers | null = null;
  private workflowIPCHandlers: WorkflowIPCHandlers | null = null;
  private processingIPCHandlers: ProcessingIPCHandlers | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.dependencyChecker = new DependencyChecker();
    this.processManager = new ProcessManager();
    this.initializationService = new InitializationService();
    this.appStateService = new AppStateService();
    this.workspaceConfigService = new WorkspaceConfigService();
    this.groupConfigService = new GroupConfigService();
    this.workflowStateService = new WorkflowStateService();
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

    // Initialize video processing handlers
    this.videoIPCHandlers = new VideoIPCHandlers();

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

    // Cleanup video handlers
    if (this.videoIPCHandlers) {
      this.videoIPCHandlers.cleanup();
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
