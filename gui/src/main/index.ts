import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { DependencyChecker } from "./dependency-checker";
import { ProcessManager } from "./process-manager";
import { InitializationService } from "./initialization-service";
import { getConfigManager } from "./config-manager";
import type {
  DependencyStatus,
  AppConfig,
  HardwareInfo,
  FileDialogOptions,
  InitializationResult,
} from "../types";

class CantoCap {
  private dependencyChecker: DependencyChecker;
  private processManager: ProcessManager;
  private initializationService: InitializationService;
  private configManager = getConfigManager();
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
        preload: join(__dirname, "../preload/index.js"),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Restore maximized state
    if (windowState.maximized) {
      this.mainWindow.maximize();
    }

    this.mainWindow.on("ready-to-show", () => {
      this.mainWindow?.show();
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
      this.mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      this.mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
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
