import { spawn, ChildProcess } from 'child_process'
import { join, resolve, dirname } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import type { AppConfig, HardwareInfo } from '../types'

type ProcessCallback = (eventType: string, data: unknown) => void

export class ProcessManager {
  private activeProcess: ChildProcess | null = null
  private pythonPath: string | null = null
  private enginePath: string
  private venvActivated: boolean = false
  private currentStatistics: any = null
  private currentOutputFile: string | null = null

  constructor() {
    this.enginePath = this.getEnginePath()
  }

  private getEnginePath(): string {
    if (app.isPackaged) {
      // In production, engine is in resources/engine
      return join(process.resourcesPath, 'engine')
    } else {
      // In development, engine is in parent directory
      return resolve(join(__dirname, '../../../engine'))
    }
  }

  private async findPythonExecutable(): Promise<string> {
    if (this.pythonPath && this.venvActivated) return this.pythonPath

    // First, try to find and use the virtual environment Python
    const venvPython = await this.findVenvPython()
    if (venvPython) {
      this.pythonPath = venvPython
      this.venvActivated = true
      return venvPython
    }

    // Fallback to system Python if no venv found
    const candidates = ['python3.12', 'python3', 'python']
    
    for (const candidate of candidates) {
      try {
        await this.testPythonExecutable(candidate)
        this.pythonPath = candidate
        this.venvActivated = false
        return candidate
      } catch (error) {
        continue
      }
    }
    
    throw new Error('No suitable Python executable found')
  }

  private async findVenvPython(): Promise<string | null> {
    const venvPath = join(this.enginePath, 'venv')
    const venvPython = process.platform === 'win32' 
      ? join(venvPath, 'Scripts', 'python.exe')
      : join(venvPath, 'bin', 'python')

    try {
      // Check if venv directory exists first
      if (!existsSync(venvPath)) {
        return null
      }

      // Check if Python executable exists
      if (!existsSync(venvPython)) {
        return null
      }

      // Check if venv exists and Python is valid
      await this.testPythonExecutable(venvPython)
      return venvPython
    } catch (error) {
      console.warn('Virtual environment Python test failed:', error)
      return null
    }
  }

  private testPythonExecutable(pythonCmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(pythonCmd, ['--version'], { 
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      })

      let stdout = ''
      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      process.on('close', (code: number | null) => {
        if (code === 0 && stdout.includes('Python 3.')) {
          resolve(pythonCmd)
        } else {
          reject(new Error(`Invalid Python executable: ${pythonCmd}`))
        }
      })

      process.on('error', reject)
    })
  }

  public async startTranscription(config: AppConfig, callback: ProcessCallback): Promise<void> {
    try {
      if (this.activeProcess) {
        throw new Error('Another transcription process is already running')
      }

      // Reset captured data for new processing
      this.currentStatistics = null
      this.currentOutputFile = null

      // Ensure engine setup before starting transcription
      callback('process-started', {
        message: 'Ensuring engine setup...',
        stage: 'setup'
      })

      // Debug: Log engine status before setup
      const engineStatus = this.getEngineStatus()
      callback('process-message', {
        message: `Debug: Engine status - VenvExists: ${engineStatus.venvExists}, VenvActivated: ${engineStatus.venvActivated}, PythonPath: ${engineStatus.currentPythonPath || 'None'}`
      })

      await this.ensureEngineSetup(callback)

      const pythonCmd = await this.findPythonExecutable()
      const args = this.buildCliArguments(config)

      // Debug: Log output path decision
      if (config.outputFile && config.inputFile) {
        const inputDir = dirname(config.inputFile)
        const outputDir = dirname(config.outputFile)
        const includeOutput = inputDir !== outputDir
        callback('process-message', {
          message: `Debug: Output path decision - Input dir: "${inputDir}", Output dir: "${outputDir}", Including -o: ${includeOutput}`
        })
      }

      // Debug: Log the exact command being executed (with proper quoting for shell)
      const quotedArgs = args.map(arg => {
        // Quote all string arguments that are not flags (don't start with -)
        if (!arg.startsWith('-')) {
          return `"${arg}"`
        }
        return arg
      })
      const fullCommand = `"${pythonCmd}" -m src.presentation.cli.main --ipc-mode ${quotedArgs.join(' ')}`
      callback('process-message', {
        message: `Debug: Executing command - ${fullCommand}`
      })

      callback('process-message', {
        message: `Debug: Working directory - ${this.enginePath}`
      })

      callback('process-message', {
        message: `Debug: Python executable - ${pythonCmd} (venv: ${this.venvActivated})`
      })

      callback('process-started', {
        message: 'Starting transcription process...',
        stage: 'initializing'
      })

      // Ensure we're using the venv python with proper module path
      this.activeProcess = spawn(pythonCmd, [
        '-m', 'src.presentation.cli.main',
        '--ipc-mode',
        ...args
      ], {
        cwd: this.enginePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PYTHONPATH: this.enginePath
        }
      })

      // Handle stdout (JSON messages from new IPC system)
      this.activeProcess.stdout?.on('data', (data: Buffer) => {
        this.classifyAndSendMessage(data, 'stdout', callback)
      })

      // Handle stderr (classify all output intelligently)
      this.activeProcess.stderr?.on('data', (data: Buffer) => {
        this.classifyAndSendMessage(data, 'stderr', callback)
      })

      // Handle process completion
      this.activeProcess.on('close', (code: number | null) => {
        this.activeProcess = null
        
        if (code === 0) {
          const completionData: any = {
            message: 'Transcription completed successfully',
            exitCode: code
          }
          
          // Include statistics if captured
          if (this.currentStatistics) {
            completionData.statistics = this.currentStatistics
          }
          
          // Include output file if captured
          if (this.currentOutputFile) {
            completionData.outputFile = this.currentOutputFile
          }
          
          callback('process-complete', completionData)
          
          // Reset captured data for next run
          this.currentStatistics = null
          this.currentOutputFile = null
        } else {
          callback('process-error', {
            message: `Process exited with code ${code}`,
            type: 'exit_error',
            exitCode: code
          })
          
          // Reset captured data on error too
          this.currentStatistics = null
          this.currentOutputFile = null
        }
      })

      // Handle process errors
      this.activeProcess.on('error', (error: Error) => {
        this.activeProcess = null
        callback('process-error', {
          message: `Failed to start process: ${error.message}`,
          type: 'spawn_error'
        })
      })

    } catch (error) {
      callback('process-error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'setup_error'
      })
    }
  }

  public async checkHardware(): Promise<HardwareInfo> {
    try {
      // Ensure engine is set up before checking hardware
      await this.ensureEngineSetup()
      const pythonCmd = await this.findPythonExecutable()
      
      console.log(`Debug: Hardware check using Python: ${pythonCmd} (venv: ${this.venvActivated})`)
      
      return new Promise((resolve, reject) => {
        const hardwareProcess = spawn(pythonCmd, [
          '-m', 'src.presentation.cli.main',
          'hardware'
        ], {
          cwd: this.enginePath,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PYTHONPATH: this.enginePath
          }
        })

        let stdout = ''
        let stderr = ''

        hardwareProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        hardwareProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        hardwareProcess.on('close', (code: number | null) => {
          if (code === 0) {
            // Parse hardware information
            try {
              // Try to parse as JSON first
              const hardwareInfo = JSON.parse(stdout)
              resolve(hardwareInfo)
            } catch (e) {
              // Fallback to plain text parsing
              resolve({
                raw_output: stdout,
                python_available: true,
                engine_path: this.enginePath
              })
            }
          } else {
            reject(new Error(`Hardware check failed: ${stderr || stdout}`))
          }
        })

        process.on('error', (error: Error) => {
          reject(new Error(`Failed to run hardware check: ${error.message}`))
        })
      })
    } catch (error) {
      throw new Error(`Hardware check setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async ensureEngineSetup(callback?: ProcessCallback): Promise<void> {
    const venvPath = join(this.enginePath, 'venv')

    // Check if venv exists
    if (!existsSync(venvPath)) {
      if (callback) {
        callback('process-started', {
          message: 'Virtual environment not found. Running engine setup...',
          stage: 'setup'
        })
      }

      // Run the setup script to create venv and install dependencies
      await this.runEngineSetup(callback)
    } else {
      // Verify venv is working
      const venvPython = await this.findVenvPython()
      if (!venvPython) {
        if (callback) {
          callback('process-started', {
            message: 'Virtual environment corrupted. Re-running setup...',
            stage: 'setup'
          })
        }
        await this.runEngineSetup(callback)
      }
    }

    // Refresh python path to use venv
    this.pythonPath = null
    this.venvActivated = false
    await this.findPythonExecutable()
  }

  private async runEngineSetup(callback?: ProcessCallback): Promise<void> {
    const setupScript = join(this.enginePath, 'setup_env.py')

    if (!existsSync(setupScript)) {
      const errorMessage = `Engine setup script not found at: ${setupScript}\n\n` +
        `This may indicate that:\n` +
        `- The application was not installed correctly\n` +
        `- Files were moved or deleted\n` +
        `- You're running from an incomplete installation\n\n` +
        `Please reinstall the application to fix this issue.`
      
      if (callback) {
        callback('process-error', {
          message: errorMessage,
          type: 'setup_error'
        })
      }
      throw new Error(errorMessage)
    }

    if (callback) {
      callback('process-started', {
        message: 'Running engine setup script...',
        stage: 'setup'
      })
    }

    return new Promise((resolve, reject) => {
      // Use system Python to run the setup script
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const setupProcess = spawn(pythonCmd, [setupScript], {
        cwd: this.enginePath,
        stdio: 'pipe',
        shell: true
      })

      let stdout = ''
      let stderr = ''

      setupProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        stdout += output
        if (callback) {
          callback('process-message', { message: output.trim() })
        }
      })

      setupProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        stderr += output
        if (callback) {
          callback('process-message', { message: output.trim() })
        }
      })

      const timeout = setTimeout(() => {
        setupProcess.kill()
        reject(new Error('Engine setup timed out after 10 minutes'))
      }, 600000) // 10 minute timeout

      setupProcess.on('close', (code: number | null) => {
        clearTimeout(timeout)
        if (code === 0) {
          if (callback) {
            callback('process-started', {
              message: 'Engine setup completed successfully',
              stage: 'setup'
            })
          }
          resolve()
        } else {
          const errorMessage = `Engine setup failed with exit code ${code}. This may be due to:\n` +
            `- Missing Python dependencies\n` +
            `- Network connectivity issues\n` +
            `- Insufficient disk space\n` +
            `- Permission issues\n\n` +
            `Error output:\n${stderr || 'No error output available'}`
          
          if (callback) {
            callback('process-error', {
              message: errorMessage,
              type: 'setup_error'
            })
          }
          reject(new Error(errorMessage))
        }
      })

      setupProcess.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start engine setup: ${error.message}`))
      })
    })
  }

  public cancelProcess(): void {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM')
      
      // Force kill after 5 seconds if process doesn't terminate gracefully
      setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill('SIGKILL')
          this.activeProcess = null
        }
      }, 5000)
    }
  }

  private buildCliArguments(config: AppConfig): string[] {
    const args: string[] = []

    // All arguments first, input file at the end

    // Only include -o if output directory differs from input directory
    if (config.outputFile && config.inputFile) {
      const inputDir = dirname(config.inputFile)
      const outputDir = dirname(config.outputFile)
      
      // Only add -o flag if directories are different
      if (inputDir !== outputDir) {
        args.push('-o', config.outputFile)
      }
    }

    if (config.language) {
      args.push('-l', config.language)
    }

    if (config.model) {
      args.push('-m', config.model)
    }

    if (config.priority && config.priority !== 'balanced') {
      args.push('-p', config.priority)
    }

    // Boolean flags
    if (config.speakers) {
      args.push('--speakers')
    }

    if (config.written) {
      args.push('--written')
    }

    if (config.music) {
      args.push('--music')
    }

    if (config.verbose) {
      args.push('--verbose')
    }

    if (config.noGeminiRefinement) {
      args.push('--no-gemini-refinement')
    }

    // String/number arguments
    if (config.charset && config.charset !== 'traditional') {
      args.push('--charset', config.charset)
    }

    if (config.geminiKey) {
      args.push('--gemini-key', config.geminiKey)
    }

    if (config.maxChunkDuration && config.maxChunkDuration !== 15) {
      args.push('--max-chunk-duration', String(config.maxChunkDuration))
    }

    if (config.videoQuality && config.videoQuality !== '360p') {
      args.push('--video-quality', config.videoQuality)
    }

    if (config.terminologyConfig) {
      args.push('-c', config.terminologyConfig)
    }

    // FFmpeg path is now required
    if (config.ffmpegPath) {
      args.push('--ffmpeg-path', config.ffmpegPath)
    } else {
      // If no custom path is set, use 'ffmpeg' (system PATH)
      args.push('--ffmpeg-path', 'ffmpeg')
    }

    if (config.subtitle && typeof config.subtitle === 'string') {
      args.push('--subtitle', config.subtitle)
    }

    if (config.duration && config.duration !== 10.0) {
      args.push('-d', String(config.duration))
    }

    // Input file at the end (required)
    if (config.inputFile) {
      args.push(config.inputFile)
    }

    return args
  }

  public isProcessRunning(): boolean {
    return this.activeProcess !== null
  }

  public getProcessStats(): { pid: number; running: boolean; enginePath: string; pythonPath: string | null } | null {
    if (!this.activeProcess) return null

    return {
      pid: this.activeProcess.pid || 0,
      running: !this.activeProcess.killed,
      enginePath: this.enginePath,
      pythonPath: this.pythonPath
    }
  }

  public async runSetupOnly(): Promise<boolean> {
    try {
      await this.ensureEngineSetup()
      return true
    } catch (error) {
      console.error('Engine setup failed:', error)
      return false
    }
  }

  public async isEngineSetupRequired(): Promise<boolean> {
    const venvPath = join(this.enginePath, 'venv')
    
    // Check if venv exists
    if (!existsSync(venvPath)) {
      return true
    }
    
    // Check if venv Python is working
    const venvPython = await this.findVenvPython()
    return venvPython === null
  }

  public getEngineStatus(): {
    enginePath: string
    venvExists: boolean
    venvPythonPath: string | null
    currentPythonPath: string | null
    venvActivated: boolean
  } {
    const venvPath = join(this.enginePath, 'venv')
    const venvPython = process.platform === 'win32' 
      ? join(venvPath, 'Scripts', 'python.exe')
      : join(venvPath, 'bin', 'python')

    return {
      enginePath: this.enginePath,
      venvExists: existsSync(venvPath),
      venvPythonPath: existsSync(venvPython) ? venvPython : null,
      currentPythonPath: this.pythonPath,
      venvActivated: this.venvActivated
    }
  }

  private classifyAndSendMessage(data: Buffer, stream: 'stdout' | 'stderr', callback: ProcessCallback): void {
    const lines = data.toString().split('\n')
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      try {
        const parsedData = JSON.parse(line)
        
        // Check for new IPC message format (has id and level)
        if (parsedData.id && parsedData.level) {
          // Check if this is a result message with statistics
          if (parsedData.category === 'process' && parsedData.source === 'result' && parsedData.data) {
            if (parsedData.data.statistics) {
              this.currentStatistics = parsedData.data.statistics
            }
            if (parsedData.data.output_path) {
              this.currentOutputFile = parsedData.data.output_path
            }
          }
          callback('ipc-message', parsedData)
        } else {
          // Legacy format - convert to new format
          const convertedMessage = this.convertLegacyMessage(parsedData, stream)
          callback('ipc-message', convertedMessage)
        }
      } catch (e) {
        // Non-JSON output - create new format message
        const enhancedMessage = this.createEnhancedMessage(line.trim(), stream)
        callback('ipc-message', enhancedMessage)
      }
    }
  }

  private createEnhancedMessage(content: string, stream: 'stdout' | 'stderr'): any {
    const level = this.classifyRawOutput(content, stream)
    const category = stream === 'stderr' ? 'model' : 'process'
    
    return {
      id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      source: `${stream}_capture`,
      content,
      data: {
        stream,
        raw_output: true
      }
    }
  }

  private convertLegacyMessage(parsedData: any, stream: string): any {
    // Convert old message format to new format
    let level = 'info'
    let category = 'process'
    
    if (parsedData.type === 'error') {
      level = 'error'
      category = 'system'
    } else if (parsedData.data?.level) {
      level = parsedData.data.level
    }
    
    return {
      id: `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: parsedData.timestamp || new Date().toISOString(),
      level,
      category,
      source: 'legacy_handler',
      content: parsedData.data?.message || parsedData.data?.error || JSON.stringify(parsedData.data || {}),
      data: parsedData.data
    }
  }

  private classifyRawOutput(message: string, stream: string): string {
    const msgLower = message.toLowerCase()
    
    // Model/library output patterns (INFO level - not errors!)
    if (msgLower.includes('loading checkpoint') ||
        msgLower.includes('transformers') ||
        msgLower.includes('model loaded') ||
        msgLower.includes('special tokens') ||
        msgLower.includes('safetensors')) {
      return 'info'
    }
    
    // Debug patterns
    if (msgLower.includes('debug:') ||
        msgLower.includes('hardware check') ||
        msgLower.includes('engine status') ||
        msgLower.includes('cli command')) {
      return 'debug'
    }
    
    // Warning patterns
    if (msgLower.includes('warning') ||
        msgLower.includes('deprecated') ||
        msgLower.includes('userwarning')) {
      return 'warning'
    }
    
    // Critical patterns
    if (msgLower.includes('fatal') ||
        msgLower.includes('critical') ||
        msgLower.includes('segmentation fault')) {
      return 'critical'
    }
    
    // Error patterns
    if (msgLower.includes('error') ||
        msgLower.includes('failed') ||
        msgLower.includes('exception')) {
      return 'error'
    }
    
    // Default: stderr without error patterns is likely model output (INFO)
    return stream === 'stderr' ? 'info' : 'info'
  }
}