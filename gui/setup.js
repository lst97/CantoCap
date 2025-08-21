#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { platform } from 'os';
import { MainLogger } from './src/main/logger';

const logger = MainLogger.createScopedLogger('Setup');
logger.info('🎬 CantoCap Desktop GUI Setup\n');

// Check Node.js version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  logger.info(`📦 Node.js version: ${version}`);

  if (major < 18) {
    console.error('❌ Node.js 18 or higher is required');
    logger.info('   Please install from: https://nodejs.org/');
    process.exit(1);
  }

  logger.info('✅ Node.js version compatible\n');
}

// Check if pnpm is installed
function checkPnpm() {
  try {
    execSync('pnpm --version', { stdio: 'pipe' });
    logger.info('✅ pnpm is installed');
  } catch (error) { // eslint-disable-line no-unused-vars
    logger.info('📦 Installing pnpm...');
    try {
      execSync('npm install -g pnpm', { stdio: 'inherit' });
      logger.info('✅ pnpm installed successfully');
    } catch (installError) { // eslint-disable-line no-unused-vars
      console.error('❌ Failed to install pnpm');
      logger.info('   Please run: npm install -g pnpm');
      process.exit(1);
    }
  }
  logger.info('');
}

// Check Python installation
function checkPython() {
  const pythonCommands = ['python3.12', 'python3', 'python'];
  let pythonFound = false;

  logger.info('🐍 Checking Python installation...');

  for (const cmd of pythonCommands) {
    try {
      const result = execSync(`${cmd} --version`, { stdio: 'pipe' }).toString();
      if (result.includes('Python 3.')) {
        logger.info(`✅ Found ${result.trim()} at ${cmd}`);
        pythonFound = true;
        break;
      }
    } catch (error) { // eslint-disable-line no-unused-vars
      // Command not found, try next
    }
  }

  if (!pythonFound) {
    logger.info('⚠️  Python 3.12+ not found');
    logger.info('   Please install from: https://www.python.org/downloads/release/python-31210/');
  }
  logger.info('');
}

// Check FFmpeg installation
function checkFFmpeg() {
  logger.info('🎥 Checking FFmpeg installation...');

  try {
    const result = execSync('ffmpeg -version', { stdio: 'pipe' }).toString();
    const version = result.split('\n')[0];
    logger.info(`✅ Found ${version}`);
  } catch (error) { // eslint-disable-line no-unused-vars
    logger.info('⚠️  FFmpeg not found');
    logger.info('   Installation instructions:');

    switch (platform()) {
      case 'win32':
        logger.info('   Windows: winget install FFmpeg');
        logger.info('   Or download from: https://www.gyan.dev/ffmpeg/builds/');
        break;
      case 'darwin':
        logger.info('   macOS: brew install ffmpeg');
        break;
      case 'linux':
        logger.info('   Linux: sudo apt install ffmpeg');
        break;
    }
  }
  logger.info('');
}

// Install dependencies
function installDependencies() {
  logger.info('📦 Installing dependencies...');

  try {
    execSync('pnpm install', { stdio: 'inherit' });
    logger.info('✅ Dependencies installed successfully\n');
  } catch (error) { // eslint-disable-line no-unused-vars
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
}

// Create necessary directories
function createDirectories() {
  logger.info('📁 Creating directories...');

  const dirs = [
    'resources',
    'build',
    'dist'
  ];

  dirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info(`   Created: ${dir}/`);
    }
  });

  logger.info('✅ Directories ready\n');
}

// Main setup function
async function setup() {
  try {
    checkNodeVersion();
    checkPnpm();
    checkPython();
    checkFFmpeg();
    installDependencies();
    createDirectories();

    logger.info('🎉 Setup completed successfully!');
    logger.info('\n📚 Next steps:');
    logger.info('   pnpm dev       # Start development server');
    logger.info('   pnpm build     # Build for production');
    logger.info('   pnpm dist      # Create installer');
    logger.info('\n💡 Make sure Python 3.12 and FFmpeg are installed for full functionality');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();