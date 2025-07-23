#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🎬 CantoCap Desktop GUI Setup\n');

// Check Node.js version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  console.log(`📦 Node.js version: ${version}`);
  
  if (major < 18) {
    console.error('❌ Node.js 18 or higher is required');
    console.log('   Please install from: https://nodejs.org/');
    process.exit(1);
  }
  
  console.log('✅ Node.js version compatible\n');
}

// Check if pnpm is installed
function checkPnpm() {
  try {
    execSync('pnpm --version', { stdio: 'pipe' });
    console.log('✅ pnpm is installed');
  } catch (error) {
    console.log('📦 Installing pnpm...');
    try {
      execSync('npm install -g pnpm', { stdio: 'inherit' });
      console.log('✅ pnpm installed successfully');
    } catch (installError) {
      console.error('❌ Failed to install pnpm');
      console.log('   Please run: npm install -g pnpm');
      process.exit(1);
    }
  }
  console.log('');
}

// Check Python installation
function checkPython() {
  const pythonCommands = ['python3.12', 'python3', 'python'];
  let pythonFound = false;
  
  console.log('🐍 Checking Python installation...');
  
  for (const cmd of pythonCommands) {
    try {
      const result = execSync(`${cmd} --version`, { stdio: 'pipe' }).toString();
      if (result.includes('Python 3.')) {
        console.log(`✅ Found ${result.trim()} at ${cmd}`);
        pythonFound = true;
        break;
      }
    } catch (error) {
      // Command not found, try next
    }
  }
  
  if (!pythonFound) {
    console.log('⚠️  Python 3.12+ not found');
    console.log('   Please install from: https://www.python.org/downloads/release/python-31210/');
  }
  console.log('');
}

// Check FFmpeg installation
function checkFFmpeg() {
  console.log('🎥 Checking FFmpeg installation...');
  
  try {
    const result = execSync('ffmpeg -version', { stdio: 'pipe' }).toString();
    const version = result.split('\n')[0];
    console.log(`✅ Found ${version}`);
  } catch (error) {
    console.log('⚠️  FFmpeg not found');
    console.log('   Installation instructions:');
    
    switch (os.platform()) {
      case 'win32':
        console.log('   Windows: winget install FFmpeg');
        console.log('   Or download from: https://www.gyan.dev/ffmpeg/builds/');
        break;
      case 'darwin':
        console.log('   macOS: brew install ffmpeg');
        break;
      case 'linux':
        console.log('   Linux: sudo apt install ffmpeg');
        break;
    }
  }
  console.log('');
}

// Install dependencies
function installDependencies() {
  console.log('📦 Installing dependencies...');
  
  try {
    execSync('pnpm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
}

// Create necessary directories
function createDirectories() {
  console.log('📁 Creating directories...');
  
  const dirs = [
    'resources',
    'build',
    'dist'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   Created: ${dir}/`);
    }
  });
  
  console.log('✅ Directories ready\n');
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
    
    console.log('🎉 Setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   pnpm dev       # Start development server');
    console.log('   pnpm build     # Build for production');
    console.log('   pnpm dist      # Create installer');
    console.log('\n💡 Make sure Python 3.12 and FFmpeg are installed for full functionality');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();