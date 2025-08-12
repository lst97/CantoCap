import { spawn } from 'child_process'
import { app, shell, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { DependencyChecker } from './dependency-checker'
import type { DependencyStatus } from '../types'

export interface InitializationResult {
  success: boolean
  message: string
  dependencies: Record<string, DependencyStatus>
  requiresRestart?: boolean
}

export class InitializationService {
  private dependencyChecker: DependencyChecker
  constructor() {
    this.dependencyChecker = new DependencyChecker()
  }

  public async initialize(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      message: '',
      dependencies: {},
      requiresRestart: false
    }

    try {
      // Check all dependencies first
      result.dependencies = await this.dependencyChecker.checkAll()
      
      const missingDependencies = Object.entries(result.dependencies)
        .filter(([_, status]) => status.status === 'missing')
        .map(([key, _]) => key)

      if (missingDependencies.length === 0) {
        result.success = true
        result.message = 'All dependencies are satisfied'
        return result
      }

      // Show initialization dialog
      const userChoice = await this.showInitializationDialog(result.dependencies)
      
      if (!userChoice) {
        result.message = 'Initialization cancelled by user'
        return result
      }

      // Attempt to install missing dependencies
      await this.installMissingDependencies(missingDependencies)
      
      // Re-check dependencies after installation attempts
      result.dependencies = await this.dependencyChecker.checkAll()
      
      const stillMissing = Object.entries(result.dependencies)
        .filter(([_, status]) => status.status === 'missing')
        .length

      if (stillMissing === 0) {
        result.success = true
        result.message = 'All dependencies installed successfully'
        result.requiresRestart = true
      } else {
        result.success = false
        result.message = 'Some dependencies could not be installed automatically'
      }

    } catch (error) {
      result.success = false
      result.message = `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return result
  }

  private async showInitializationDialog(dependencies: Record<string, DependencyStatus>): Promise<boolean> {
    const missingDeps = Object.entries(dependencies)
      .filter(([_, status]) => status.status === 'missing')
      .map(([_, status]) => status.name)

    const response = await dialog.showMessageBox({
      type: 'question',
      title: 'Setup Required',
      message: 'Missing Dependencies Detected',
      detail: `The following dependencies are required:\n\n${missingDeps.join('\n')}\n\nWould you like to install them automatically?`,
      buttons: ['Install Automatically', 'Manual Setup', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    })

    switch (response.response) {
      case 0: // Install Automatically
        return true
      case 1: // Manual Setup
        await this.openManualSetupDialog(dependencies)
        return false
      case 2: // Cancel
      default:
        return false
    }
  }

  private async openManualSetupDialog(dependencies: Record<string, DependencyStatus>): Promise<void> {
    let message = 'Manual Setup Instructions:\n\n'
    
    for (const [, status] of Object.entries(dependencies)) {
      if (status.status === 'missing') {
        message += `${status.name}:\n`
        message += `  ${status.helpText}\n`
        message += `  Download: ${status.downloadUrl}\n\n`
      }
    }

    message += 'After installing dependencies, restart the application.'

    await dialog.showMessageBox({
      type: 'info',
      title: 'Manual Setup Instructions',
      message: 'Setup Instructions',
      detail: message,
      buttons: ['Open Download Pages', 'Close']
    }).then(async (response) => {
      if (response.response === 0) {
        // Open download pages
        for (const [_, status] of Object.entries(dependencies)) {
          if (status.status === 'missing' && status.downloadUrl) {
            await shell.openExternal(status.downloadUrl)
          }
        }
      }
    })
  }

  private async installMissingDependencies(missingDeps: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    for (const dep of missingDeps) {
      try {
        switch (dep) {
          case 'python':
            results[dep] = await this.installPython()
            break
          case 'ffmpeg':
            results[dep] = await this.installFFmpeg()
            break
          default:
            results[dep] = false
        }
      } catch (error) {
        console.error(`Failed to install ${dep}:`, error)
        results[dep] = false
      }
    }

    return results
  }

  private async installPython(): Promise<boolean> {
    // For Python, we can't easily install it automatically, so we guide the user
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Python Installation',
      message: 'Python Installation Required',
      detail: 'Python 3.9-3.12 is required (3.12 recommended).\n\nWe recommend using pyenv for version management.\n\nWould you like to open the installation guide?',
      buttons: ['Open Python.org', 'Open pyenv Guide', 'Skip']
    })

    switch (response.response) {
      case 0:
        await shell.openExternal('https://www.python.org/downloads/')
        break
      case 1:
        await shell.openExternal('https://github.com/pyenv/pyenv#installation')
        break
    }

    return false // We can't verify installation immediately
  }

  private async installFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      // Get the project root (assuming GUI is in project/gui/)
      const projectRoot = join(app.getAppPath(), '..')
      const setupScript = join(projectRoot, 'engine', 'setup_env.py')

      if (!existsSync(setupScript)) {
        console.error('Setup script not found:', setupScript)
        resolve(false)
        return
      }

      // Try to run the setup script to install FFmpeg
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const installProcess = spawn(pythonCmd, [setupScript, '--ffmpeg-only'], {
        cwd: join(projectRoot, 'engine'),
        stdio: 'pipe'
      })

      let _output = ''
      let errorOutput = ''

      installProcess.stdout.on('data', (data) => {
        _output += data.toString()
      })

      installProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      const timeout = setTimeout(() => {
        installProcess.kill()
        resolve(false)
      }, 300000) // 5 minute timeout

      installProcess.on('close', (code) => {
        clearTimeout(timeout)
        const success = code === 0
        
        if (!success) {
          console.error('FFmpeg installation failed:', errorOutput)
        }
        
        resolve(success)
      })

      installProcess.on('error', (error) => {
        clearTimeout(timeout)
        console.error('Failed to start FFmpeg installation:', error)
        resolve(false)
      })
    })
  }

  public async openPythonDownload(): Promise<void> {
    await shell.openExternal('https://www.python.org/downloads/')
  }

  public async openPyenvGuide(): Promise<void> {
    await shell.openExternal('https://github.com/pyenv/pyenv#installation')
  }

  public async openFFmpegDownload(): Promise<void> {
    const platform = process.platform
    let url: string

    switch (platform) {
      case 'win32':
        url = 'https://www.gyan.dev/ffmpeg/builds/'
        break
      case 'darwin':
        url = 'https://formulae.brew.sh/formula/ffmpeg'
        break
      case 'linux':
        url = 'https://ffmpeg.org/download.html#build-linux'
        break
      default:
        url = 'https://ffmpeg.org/download.html'
    }

    await shell.openExternal(url)
  }

  public async checkDependenciesStatus(): Promise<Record<string, DependencyStatus>> {
    return await this.dependencyChecker.checkAll()
  }

  public getDependencyInstallationGuide(dependency: string): string {
    const guides: Record<string, string> = {
      python: `Python 3.9-3.12 Installation:

1. Using pyenv (Recommended):
   - macOS: brew install pyenv
   - Linux: curl https://pyenv.run | bash
   - Windows: https://github.com/pyenv-win/pyenv-win
   
   Then run:
   pyenv install 3.12
   pyenv local 3.12

2. Direct Installation:
   - Download from: https://www.python.org/downloads/
   - Make sure to select "Add to PATH" during installation`,

      ffmpeg: `FFmpeg Installation:

1. Automatic (via this app):
   - Click "Download FFmpeg" button below
   
2. Manual Installation:
   - Windows: Download from https://www.gyan.dev/ffmpeg/builds/
   - macOS: brew install ffmpeg
   - Linux: sudo apt install ffmpeg (Ubuntu/Debian)
            sudo yum install ffmpeg (CentOS/RHEL)`
    }

    return guides[dependency] || 'No installation guide available for this dependency.'
  }

  public async runEngineSetup(): Promise<boolean> {
    // TODO: Implement engine setup during workspace system migration
    // This should setup the CantoCap Python engine with proper workspace integration
    console.warn('runEngineSetup not yet implemented in new architecture');
    return false;
  }
}