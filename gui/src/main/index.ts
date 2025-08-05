import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from "electron";
import { join } from "path";
import { writeFile, readFile } from "fs/promises";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { DependencyChecker } from "./dependency-checker";
import { ProcessManager } from "./process-manager";
import { InitializationService } from "./initialization-service";
import { getConfigManager } from "./config-manager";
import { getWorkspaceManager } from "./workspace-manager";
import { getMigrationCoordinator } from "./migration-coordinator";
import { getSubtitleFileManager } from "./subtitle-file-manager";
import { SUBTITLE_IPC_CHANNELS, validateSubtitlePath } from "../types/subtitle-ipc";
import type {
  DependencyStatus,
  AppConfig,
  HardwareInfo,
  FileDialogOptions,
  InitializationResult,
} from "../types";
import type {
  WorkspaceMetadata,
  MigrationStatus
} from "../renderer/src/types/workspace";
import type {
  CreateSubtitleFileParams,
  LoadSubtitleFileParams,
  SaveSubtitleFileParams,
  DeleteSubtitleFileParams,
  GetSubtitleMetadataParams,
  CleanupSubtitleFilesParams,
  BatchSubtitleOperationParams,
  StreamSubtitleFileParams,
  StreamWriteSubtitleParams
} from "../types/subtitle-ipc";

// Safe logging function to prevent EPIPE errors
const safeLog = (message: string, ...args: any[]) => {
  try {
    if (process.stdout && !process.stdout.destroyed) {
      console.log(message, ...args);
    }
  } catch (error) {
    // Silently ignore EPIPE and other stream errors
  }
};

const safeError = (message: string, ...args: any[]) => {
  try {
    if (process.stderr && !process.stderr.destroyed) {
      console.error(message, ...args);
    }
  } catch (error) {
    // Silently ignore EPIPE and other stream errors
  }
};

class CantoCap {
  private dependencyChecker: DependencyChecker;
  private processManager: ProcessManager;
  private initializationService: InitializationService;
  private configManager = getConfigManager();
  private workspaceManager = getWorkspaceManager();
  private migrationCoordinator = getMigrationCoordinator();
  private subtitleFileManager = getSubtitleFileManager();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.dependencyChecker = new DependencyChecker();
    this.processManager = new ProcessManager();
    this.initializationService = new InitializationService();
  }

  private createWindow(): void {
    // Get saved window state
    const windowState = this.configManager.getWindowState();

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
        preload: join(__dirname, "../preload/index.cjs"),
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

    this.mainWindow.on("ready-to-show", () => {
      this.mainWindow?.show();
      
      // Open DevTools in development mode
      if (is.dev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Save window state on resize/move
    this.mainWindow.on("resize", () => {
      this.saveWindowState();
    });

    this.mainWindow.on("move", () => {
      this.saveWindowState();
    });

    this.mainWindow.on("maximize", () => {
      this.configManager.updateWindowState({ maximized: true });
    });

    this.mainWindow.on("unmaximize", () => {
      this.configManager.updateWindowState({ maximized: false });
    });

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    // HMR for renderer base on electron-vite cli
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      safeLog("🔄 Loading renderer from dev server:", process.env["ELECTRON_RENDERER_URL"]);
      this.mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      const rendererPath = join(__dirname, "../renderer/index.html");
      safeLog("📄 Loading renderer from file:", rendererPath);
      this.mainWindow.loadFile(rendererPath);
    }

    // Add critical diagnostic logging
    this.mainWindow.webContents.on('did-finish-load', () => {
      safeLog("✅ Renderer finished loading");
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error("❌ Renderer failed to load:", errorCode, errorDescription, validatedURL);
    });

    this.mainWindow.webContents.on('dom-ready', () => {
      safeLog("🌐 DOM ready");
      
      // Open DevTools automatically to check console
      if (is.dev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log("⏳ Renderer started loading");
    });
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();

    if (!isMaximized) {
      this.configManager.updateWindowState({
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

    // System Operations
    ipcMain.handle(
      "check-dependencies",
      async (): Promise<Record<string, DependencyStatus>> => {
        return await this.dependencyChecker.checkAll();
      }
    );

    // Initialization and Setup
    ipcMain.handle(
      "run-initialization",
      async (): Promise<InitializationResult> => {
        return await this.initializationService.initialize();
      }
    );

    ipcMain.handle("open-python-download", async (): Promise<void> => {
      await this.initializationService.openPythonDownload();
    });

    ipcMain.handle("open-pyenv-guide", async (): Promise<void> => {
      await this.initializationService.openPyenvGuide();
    });

    ipcMain.handle("open-ffmpeg-download", async (): Promise<void> => {
      await this.initializationService.openFFmpegDownload();
    });

    ipcMain.handle("run-engine-setup", async (): Promise<boolean> => {
      return await this.initializationService.runEngineSetup();
    });

    ipcMain.handle(
      "dialog:openFile",
      async (_event, options?: FileDialogOptions) => {
        if (!this.mainWindow) return { canceled: true, filePaths: [] };

        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ["openFile"],
          filters: options?.filters || [
            {
              name: "Video Files",
              extensions: ["mp4", "avi", "mov", "mkv", "webm"],
            },
            {
              name: "Audio Files",
              extensions: ["mp3", "wav", "flac", "m4a", "aac"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        });
        return result;
      }
    );

    ipcMain.handle("dialog:openFolder", async () => {
      if (!this.mainWindow) return { canceled: true, filePaths: [] };

      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ["openDirectory"],
      });
      return result;
    });

    // Process Management
    ipcMain.on("start-transcription", async (_event, config: AppConfig) => {
      try {
        await this.processManager.startTranscription(
          config,
          (eventType: string, data: unknown) => {
            // Handle both new and legacy message types
            if (eventType === 'ipc-message') {
              this.mainWindow?.webContents.send('ipc-message', data);
            } else {
              // Legacy events (for backward compatibility)
              this.mainWindow?.webContents.send(eventType, data);
            }
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
          content: error instanceof Error ? error.message : "Unknown error",
          data: {
            type: 'startup_error',
            error: error instanceof Error ? error.message : "Unknown error"
          }
        });
      }
    });

    ipcMain.handle("check-hardware", async (): Promise<HardwareInfo> => {
      return await this.processManager.checkHardware();
    });

    ipcMain.on("cancel-process", () => {
      this.processManager.cancelProcess();
    });

    // Window Controls
    ipcMain.handle("window:minimize", () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle("window:maximize", () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle("window:close", () => {
      this.mainWindow?.close();
    });

    ipcMain.handle("window:isMaximized", () => {
      return this.mainWindow?.isMaximized() || false;
    });

    ipcMain.handle("get-platform", () => {
      return process.platform;
    });

    // DevTools Controls
    ipcMain.handle("devtools:open", () => {
      this.mainWindow?.webContents.openDevTools();
    });

    ipcMain.handle("devtools:close", () => {
      this.mainWindow?.webContents.closeDevTools();
    });

    ipcMain.handle("devtools:toggle", () => {
      this.mainWindow?.webContents.toggleDevTools();
    });

    // Utility handlers
    ipcMain.handle("get-app-version", (): string => {
      return app.getVersion();
    });

    ipcMain.handle(
      "open-external-url",
      async (_event, url: string): Promise<void> => {
        await shell.openExternal(url);
      }
    );

    // Config Management
    ipcMain.handle("config:get", () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle("config:set", (_event, section: string, value: any) => {
      this.configManager.set(section as any, value);
    });

    ipcMain.handle("config:update", (_event, updates: any) => {
      // Update multiple config sections at once
      Object.entries(updates).forEach(([key, value]) => {
        this.configManager.set(key as any, value);
      });
    });

    ipcMain.handle("config:getSection", (_event, section: string) => {
      return this.configManager.get(section as any);
    });

    ipcMain.handle("config:updateSection", (_event, section: string, updates: any) => {
      if (section === 'modelSettings') {
        this.configManager.updateModelSettings(updates);
      } else if (section === 'advancedSettings') {
        this.configManager.updateAdvancedSettings(updates);
      } else if (section === 'ui') {
        this.configManager.updateUISettings(updates);
      } else if (section === 'apiKeys') {
        Object.entries(updates).forEach(([provider, key]) => {
          this.configManager.updateApiKey(provider as any, key as string);
        });
      } else if (section === 'dependencies') {
        Object.entries(updates).forEach(([dep, path]) => {
          this.configManager.updateDependency(dep as any, path as string);
        });
      }
    });

    ipcMain.handle("config:setLastInputPath", (_event, path: string) => {
      this.configManager.setLastInputPath(path);
    });

    ipcMain.handle("config:setLastOutputPath", (_event, path: string) => {
      this.configManager.setLastOutputPath(path);
    });

    ipcMain.handle("config:reset", () => {
      this.configManager.reset();
    });

    ipcMain.handle("config:resetSection", (_event, section: string) => {
      this.configManager.resetSection(section as any);
    });

    // Export Operations
    ipcMain.handle("dialog:saveFile", async (_event, options?: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => {
      if (!this.mainWindow) return { canceled: true, filePath: null };

      const result = await dialog.showSaveDialog(this.mainWindow, {
        defaultPath: options?.defaultPath,
        filters: options?.filters || [
          { name: "All Files", extensions: ["*"] }
        ]
      });

      return result;
    });

    ipcMain.handle("export:writeFile", async (_event, filePath: string, content: string) => {
      try {
        await writeFile(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        console.error('Failed to write export file:', error);
        throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // File Reading Operations
    ipcMain.handle("file:readJson", async (_event, filePath: string) => {
      try {
        const content = await readFile(filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Failed to read JSON file:', error);
        throw new Error(`Failed to read JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Workspace Management IPC Handlers
    ipcMain.handle("workspace:list", async (): Promise<Array<WorkspaceMetadata & { id: string, name: string, isActive: boolean }>> => {
      try {
        return await this.workspaceManager.getWorkspaceList();
      } catch (error) {
        console.error('Failed to get workspace list:', error);
        return [];
      }
    });

    ipcMain.handle("workspace:create", async (_event, name: string): Promise<{ success: boolean, workspaceId: string }> => {
      try {
        return await this.workspaceManager.createWorkspace(name);
      } catch (error) {
        console.error('Failed to create workspace:', error);
        return { success: false, workspaceId: '' };
      }
    });

    ipcMain.handle("workspace:delete", async (_event, workspaceId: string): Promise<{ success: boolean }> => {
      try {
        return await this.workspaceManager.deleteWorkspace(workspaceId);
      } catch (error) {
        console.error('Failed to delete workspace:', error);
        return { success: false };
      }
    });

    ipcMain.handle("workspace:sync", async (_event, workspaceId: string): Promise<{ success: boolean }> => {
      try {
        // This is a placeholder - actual sync logic would coordinate with renderer
        // For now, we just verify the workspace exists
        const config = await this.workspaceManager.getWorkspaceConfig(workspaceId);
        return { success: config !== null };
      } catch (error) {
        console.error('Failed to sync workspace:', error);
        return { success: false };
      }
    });

    // Configuration Management
    ipcMain.handle("workspace:getConfig", async (_event, workspaceId: string): Promise<AppConfig | null> => {
      try {
        return await this.workspaceManager.getWorkspaceConfig(workspaceId);
      } catch (error) {
        console.error('Failed to get workspace config:', error);
        return null;
      }
    });

    ipcMain.handle("workspace:syncConfig", async (_event, workspaceId: string, config: AppConfig): Promise<{ success: boolean }> => {
      try {
        await this.workspaceManager.syncWorkspaceConfig(workspaceId, config);
        return { success: true };
      } catch (error) {
        console.error('Failed to sync workspace config:', error);
        return { success: false };
      }
    });

    // Migration Coordination
    ipcMain.handle("workspace:startMigration", async (): Promise<{ success: boolean, backupPath: string }> => {
      try {
        return await this.migrationCoordinator.startMigration(this.mainWindow || undefined);
      } catch (error) {
        console.error('Failed to start migration:', error);
        return { success: false, backupPath: '' };
      }
    });

    ipcMain.handle("workspace:completeMigration", async (): Promise<{ success: boolean }> => {
      try {
        return await this.migrationCoordinator.completeMigration();
      } catch (error) {
        console.error('Failed to complete migration:', error);
        return { success: false };
      }
    });

    ipcMain.handle("workspace:rollbackMigration", async (): Promise<{ success: boolean }> => {
      try {
        return await this.migrationCoordinator.rollbackMigration();
      } catch (error) {
        console.error('Failed to rollback migration:', error);
        return { success: false };
      }
    });

    ipcMain.handle("workspace:getMigrationStatus", async (): Promise<MigrationStatus | null> => {
      try {
        return this.migrationCoordinator.getMigrationStatus();
      } catch (error) {
        console.error('Failed to get migration status:', error);
        return null;
      }
    });

    // Backup & Recovery
    ipcMain.handle("workspace:createBackup", async (_event, workspaceId: string): Promise<{ success: boolean, backupPath: string }> => {
      try {
        const backupPath = await this.workspaceManager.createWorkspaceBackup(workspaceId);
        return { success: true, backupPath };
      } catch (error) {
        console.error('Failed to create workspace backup:', error);
        return { success: false, backupPath: '' };
      }
    });

    ipcMain.handle("workspace:restoreBackup", async (_event, backupPath: string): Promise<{ success: boolean }> => {
      try {
        await this.workspaceManager.restoreWorkspaceFromBackup(backupPath);
        return { success: true };
      } catch (error) {
        console.error('Failed to restore workspace backup:', error);
        return { success: false };
      }
    });

    // Performance Monitoring
    ipcMain.handle("workspace:getPerformanceMetrics", async () => {
      try {
        return this.workspaceManager.getPerformanceMetrics();
      } catch (error) {
        console.error('Failed to get workspace performance metrics:', error);
        return [];
      }
    });

    ipcMain.handle("workspace:clearPerformanceMetrics", async (): Promise<{ success: boolean }> => {
      try {
        this.workspaceManager.clearPerformanceMetrics();
        return { success: true };
      } catch (error) {
        console.error('Failed to clear workspace performance metrics:', error);
        return { success: false };
      }
    });

    // Initialize workspace system
    ipcMain.handle("workspace:initialize", async (): Promise<{ success: boolean }> => {
      try {
        await this.workspaceManager.initializeRegistry();
        return { success: true };
      } catch (error) {
        console.error('Failed to initialize workspace system:', error);
        return { success: false };
      }
    });

    // ============================================================================
    // SUBTITLE FILE OPERATIONS IPC HANDLERS
    // ============================================================================

    // Core subtitle file operations
    ipcMain.handle(SUBTITLE_IPC_CHANNELS.CREATE, async (_event, params: CreateSubtitleFileParams) => {
      try {
        return await this.subtitleFileManager.createSubtitleFile(params);
      } catch (error) {
        safeError('Failed to create subtitle file:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.LOAD, async (_event, params: LoadSubtitleFileParams) => {
      try {
        return await this.subtitleFileManager.loadSubtitleFile(params);
      } catch (error) {
        safeError('Failed to load subtitle file:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.SAVE, async (_event, params: SaveSubtitleFileParams) => {
      try {
        return await this.subtitleFileManager.saveSubtitleFile(params);
      } catch (error) {
        safeError('Failed to save subtitle file:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.DELETE, async (_event, params: DeleteSubtitleFileParams) => {
      try {
        return await this.subtitleFileManager.deleteSubtitleFile(params);
      } catch (error) {
        safeError('Failed to delete subtitle file:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.METADATA, async (_event, params: GetSubtitleMetadataParams) => {
      try {
        return await this.subtitleFileManager.getSubtitleMetadata(params);
      } catch (error) {
        safeError('Failed to get subtitle metadata:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.CLEANUP, async (_event, params: CleanupSubtitleFilesParams) => {
      try {
        return await this.subtitleFileManager.cleanupSubtitleFiles(params);
      } catch (error) {
        safeError('Failed to cleanup subtitle files:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Batch operations
    ipcMain.handle(SUBTITLE_IPC_CHANNELS.BATCH_OPERATION, async (_event, params: BatchSubtitleOperationParams) => {
      try {
        return await this.subtitleFileManager.batchSubtitleOperation(params);
      } catch (error) {
        safeError('Failed to execute batch subtitle operation:', error);
        return {
          success: false,
          results: [],
          statistics: {
            totalOperations: params.operations.length,
            successfulOperations: 0,
            failedOperations: params.operations.length,
            totalTime: 0,
            averageTimePerOperation: 0
          }
        };
      }
    });

    // Cache management
    ipcMain.handle(SUBTITLE_IPC_CHANNELS.CACHE_METRICS, async () => {
      try {
        return this.subtitleFileManager.getCacheMetrics();
      } catch (error) {
        safeError('Failed to get cache metrics:', error);
        return null;
      }
    });

    ipcMain.handle(SUBTITLE_IPC_CHANNELS.CACHE_CLEAR, async (_event, workspaceId?: string) => {
      try {
        this.subtitleFileManager.clearCache(workspaceId);
        return { success: true };
      } catch (error) {
        safeError('Failed to clear cache:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Performance monitoring
    ipcMain.handle(SUBTITLE_IPC_CHANNELS.PERFORMANCE_METRICS, async () => {
      try {
        return this.subtitleFileManager.getPerformanceMetrics();
      } catch (error) {
        safeError('Failed to get performance metrics:', error);
        return [];
      }
    });

    // Validation operations
    ipcMain.handle(SUBTITLE_IPC_CHANNELS.VALIDATE_PATH, async (_event, params: { workspaceId: string, path: string, operation: 'read' | 'write' | 'delete' }) => {
      try {
        return validateSubtitlePath(params.workspaceId, params.path);
      } catch (error) {
        safeError('Failed to validate path:', error);
        return {
          isValid: false,
          normalizedPath: params.path,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          workspaceDir: '',
          relativePath: ''
        };
      }
    });

    // Stream progress event handler (for streaming large files)
    ipcMain.on(SUBTITLE_IPC_CHANNELS.STREAM_PROGRESS, (_event, data) => {
      // Forward streaming progress to renderer
      this.mainWindow?.webContents.send(SUBTITLE_IPC_CHANNELS.STREAM_PROGRESS, data);
    });

    // Session management handlers
    ipcMain.handle('save-subtitle-session', async (_event, params: { workspaceId: string, sessionData: any }) => {
      try {
        // For now, return success - implement actual session persistence later
        safeLog('Save subtitle session requested:', params.workspaceId);
        return { success: true };
      } catch (error) {
        safeError('Failed to save subtitle session:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('load-subtitle-session', async (_event, params: { workspaceId: string, sessionType: string }) => {
      try {
        // For now, return null - implement actual session loading later
        safeLog('Load subtitle session requested:', params.workspaceId, params.sessionType);
        return null;
      } catch (error) {
        safeError('Failed to load subtitle session:', error);
        return null;
      }
    });

    // Generic subtitle-file-operation router
    ipcMain.handle('subtitle-file-operation', async (_event, request: any) => {
      try {
        if (!request || !request.operation) {
          return { success: false, error: 'Invalid operation request' };
        }

        // Route to specific handler based on operation type
        switch (request.operation) {
          case 'create':
            // Transform the request to match CreateSubtitleFileParams interface
            const createParams = {
              workspaceId: request.workspaceId,
              fileType: request.options?.fileType || 'modified',
              content: request.data?.subtitles || [],
              sessionInfo: request.data?.metadata ? {
                sessionId: request.data.metadata.fileId,
                videoPath: request.data.metadata.originalFilename || ''
              } : undefined,
              options: {
                overwrite: true, // Allow overwriting for auto-save operations
                ...request.options
              }
            };
            return await this.subtitleFileManager.createSubtitleFile(createParams);
          case 'read':
          case 'load':
            return await this.subtitleFileManager.loadSubtitleFile(request);
          case 'update':
          case 'save':
            // Transform the request to match SaveSubtitleFileParams interface
            const saveParams = {
              workspaceId: request.workspaceId,
              fileType: request.options?.fileType || 'modified',
              content: request.data?.subtitles || [],
              sessionInfo: request.data?.metadata ? {
                sessionId: request.data.metadata.fileId,
                videoPath: request.data.metadata.originalFilename || ''
              } : undefined,
              options: {
                createBackup: request.options?.createBackup || false,
                ...request.options
              }
            };
            return await this.subtitleFileManager.saveSubtitleFile(saveParams);
          case 'delete':
            return await this.subtitleFileManager.deleteSubtitleFile(request);
          case 'validate':
            return await this.subtitleFileManager.getSubtitleMetadata(request);
          case 'cleanup':
            return await this.subtitleFileManager.cleanupSubtitleFiles(request);
          case 'batch':
            return await this.subtitleFileManager.batchSubtitleOperation(request);
          default:
            safeError('Unsupported subtitle file operation:', request.operation);
            return { success: false, error: `Unsupported operation: ${request.operation}` };
        }
      } catch (error) {
        safeError('Generic subtitle file operation error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // ============================================================================
    // TEMP FILE HANDLERS
    // ============================================================================

    // Store temp subtitle data
    ipcMain.handle('store-temp-subtitle-data', async (_event, data: any) => {
      try {
        const path = require('path');
        const fs = require('fs').promises;
        const os = require('os');
        
        const tempDir = path.join(os.tmpdir(), 'cantocap');
        const tempFilePath = path.join(tempDir, 'imported-subtitles.json');
        
        // Ensure temp directory exists
        await fs.mkdir(tempDir, { recursive: true });
        
        // Store the data
        await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
        
        safeLog('✅ Temp subtitle data stored:', tempFilePath);
        return { success: true, tempFilePath };
      } catch (error) {
        safeError('❌ Failed to store temp subtitle data:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Load temp subtitle data
    ipcMain.handle('load-temp-subtitle-data', async () => {
      try {
        const path = require('path');
        const fs = require('fs').promises;
        const os = require('os');
        
        const tempFilePath = path.join(os.tmpdir(), 'cantocap', 'imported-subtitles.json');
        
        // Check if file exists
        try {
          await fs.access(tempFilePath);
        } catch {
          return { success: true, data: null }; // File doesn't exist, that's ok
        }
        
        // Read and parse the data
        const fileContent = await fs.readFile(tempFilePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        safeLog('✅ Temp subtitle data loaded:', tempFilePath);
        return { success: true, data };
      } catch (error) {
        safeError('❌ Failed to load temp subtitle data:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Clear temp subtitle data
    ipcMain.handle('clear-temp-subtitle-data', async () => {
      try {
        const path = require('path');
        const fs = require('fs').promises;
        const os = require('os');
        
        const tempFilePath = path.join(os.tmpdir(), 'cantocap', 'imported-subtitles.json');
        
        // Try to delete the file
        try {
          await fs.unlink(tempFilePath);
          safeLog('✅ Temp subtitle data cleared:', tempFilePath);
        } catch {
          // File doesn't exist, that's ok
        }
        
        return { success: true };
      } catch (error) {
        safeError('❌ Failed to clear temp subtitle data:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    safeLog('✅ Subtitle file IPC handlers registered');
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
    electronApp.setAppUserModelId("com.cantocap.gui");

    // Default open or close DevTools by F12 in development
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    this.createWindow();
    this.setupIPC();
    this.setupGlobalShortcuts();

    app.on("activate", () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });
  }
}

const cantocap = new CantoCap();

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Security: Prevent new window creation is handled by setWindowOpenHandler in createWindow()

// Initialize the application
cantocap.initialize().catch(console.error);
