import { spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { access, constants } from 'fs'
import { join } from 'path'
import type { DependencyStatus } from '../types'

const accessAsync = promisify(access)

interface DependencyConfig {
  name: string
  commands: string[]
  versionPattern: RegExp
  downloadUrl: string
  autoInstallUrls?: Record<string, string>
  critical: boolean
  helpText: string
}

interface VersionCheckResult {
  version: string
  executablePath: string
}

export class DependencyChecker {
  private dependencies: Record<string, DependencyConfig>

  constructor() {
    this.dependencies = {
      python: {
        name: 'Python (3.9-3.12)',
        commands: ['python3.12', 'python3.11', 'python3.10', 'python3.9', 'python3', 'python'],
        versionPattern: /Python 3\.(9|10|11|12)\.\d+/,
        downloadUrl: 'https://www.python.org/downloads/',
        critical: true,
        helpText: 'Python 3.9-3.12 required (3.12 recommended). Consider using pyenv for version management.'
      },
      ffmpeg: {
        name: 'FFmpeg',
        commands: ['ffmpeg'],
        versionPattern: /ffmpeg version/,
        downloadUrl: 'https://ffmpeg.org/download.html',
        autoInstallUrls: {
          win32: 'https://www.gyan.dev/ffmpeg/builds/',
          darwin: 'https://formulae.brew.sh/formula/ffmpeg',
          linux: 'https://ffmpeg.org/download.html#build-linux'
        },
        critical: true,
        helpText: 'FFmpeg is required for audio/video processing'
      }
    }
  }

  public async checkAll(): Promise<Record<string, DependencyStatus>> {
    const results: Record<string, DependencyStatus> = {}
    
    for (const [key, dependency] of Object.entries(this.dependencies)) {
      results[key] = await this.checkDependency(dependency)
    }
    
    return results
  }

  private async checkDependency(dependency: DependencyConfig): Promise<DependencyStatus> {
    const result: DependencyStatus = {
      name: dependency.name,
      status: 'checking',
      version: null,
      path: null,
      available: false,
      downloadUrl: dependency.downloadUrl,
      autoInstallUrls: dependency.autoInstallUrls,
      helpText: dependency.helpText,
      error: null
    }

    try {
      // Try each command variant
      for (const command of dependency.commands) {
        try {
          const { version, executablePath } = await this.executeVersionCheck(command)
          
          if (dependency.versionPattern.test(version)) {
            result.status = 'found'
            result.version = version.match(dependency.versionPattern)?.[0] || version
            result.path = executablePath
            result.available = true
            return result
          } else if (dependency.name === 'FFmpeg' && version.includes('ffmpeg version')) {
            // FFmpeg found but accept any version
            result.status = 'found'
            result.version = version.split('\n')[0]
            result.path = executablePath
            result.available = true
            return result
          }
        } catch (error) {
          // Continue to next command
          continue
        }
      }
      
      result.status = 'missing'
      result.error = `${dependency.name} not found in PATH`
    } catch (error) {
      result.status = 'error'
      result.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return result
  }

  private executeVersionCheck(command: string): Promise<VersionCheckResult> {
    return new Promise((resolve, reject) => {
      const versionArgs = command === 'ffmpeg' ? ['-version'] : ['--version']
      const process = spawn(command, versionArgs, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      const timeout = setTimeout(() => {
        process.kill()
        reject(new Error('Command timeout'))
      }, 5000)

      process.on('close', (code: number | null) => {
        clearTimeout(timeout)
        
        if (code === 0 || (command === 'ffmpeg' && (stdout || stderr))) {
          // FFmpeg sometimes outputs to stderr
          const output = stdout || stderr
          resolve({
            version: output,
            executablePath: command // In production, we might want to resolve full path
          })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`))
        }
      })

      process.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  public async checkPythonModules(pythonPath: string): Promise<Record<string, { available: boolean; error: string | null }>> {
    // Check if required Python modules are available
    const requiredModules = [
      'whisper',
      'torch',
      'numpy',
      'scipy'
    ]

    const results: Record<string, { available: boolean; error: string | null }> = {}
    
    for (const module of requiredModules) {
      try {
        await this.checkPythonModule(pythonPath, module)
        results[module] = { available: true, error: null }
      } catch (error) {
        results[module] = { 
          available: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return results
  }

  private checkPythonModule(pythonPath: string, moduleName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(pythonPath, ['-c', `import ${moduleName}; print('${moduleName} available')`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      })

      let stderr = ''

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', (code: number | null) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Module ${moduleName} not available: ${stderr}`))
        }
      })

      process.on('error', (error: Error) => {
        reject(error)
      })
    })
  }

  public getInstallationInstructions(dependencyKey: string, platform: string = process.platform): string {
    const dependency = this.dependencies[dependencyKey]
    if (!dependency) return 'Dependency not found'

    const instructions: Record<string, Record<string, string>> = {
      python: {
        win32: 'Download Python 3.12 from python.org and run the installer',
        darwin: 'Download Python 3.12 from python.org or use: brew install python@3.12',
        linux: 'Install using: sudo apt update && sudo apt install python3.12'
      },
      ffmpeg: {
        win32: 'Download FFmpeg from gyan.dev or use: winget install FFmpeg',
        darwin: 'Install using Homebrew: brew install ffmpeg',
        linux: 'Install using: sudo apt update && sudo apt install ffmpeg'
      }
    }

    return instructions[dependencyKey]?.[platform] || 'Please install manually from the official website'
  }
}