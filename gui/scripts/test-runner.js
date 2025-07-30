#!/usr/bin/env node

/**
 * Test runner script for ExportStep functionality
 * Provides convenient commands for running different test suites
 */

const { spawn } = require('child_process');
const path = require('path');

const JEST_CONFIG = path.join(__dirname, '..', 'jest.config.js');

// Test configurations
const TEST_CONFIGS = {
  unit: {
    description: 'Run unit tests only',
    pattern: 'src/**/__tests__/**/*.test.{ts,tsx}',
    exclude: '**/*.integration.test.{ts,tsx}'
  },
  integration: {
    description: 'Run integration tests only', 
    pattern: 'src/**/__tests__/**/*.integration.test.{ts,tsx}'
  },
  export: {
    description: 'Run ExportStep related tests only',
    pattern: 'src/**/export*.test.{ts,tsx},src/**/Export*.test.{ts,tsx},src/**/format-converters*.test.{ts,tsx}'
  },
  accessibility: {
    description: 'Run accessibility tests only',
    pattern: 'src/**/__tests__/**/*.test.{ts,tsx}',
    grep: 'accessibility|a11y|aria|keyboard|screen reader'
  },
  coverage: {
    description: 'Run all tests with coverage report',
    coverage: true,
    coverageReporters: ['text', 'lcov', 'html']
  }
};

function runJest(args) {
  return new Promise((resolve, reject) => {
    const jest = spawn('npx', ['jest', '--config', JEST_CONFIG, ...args], {
      stdio: 'inherit',
      shell: true
    });

    jest.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', reject);
  });
}

function buildJestArgs(config) {
  const args = [];

  if (config.pattern) {
    args.push('--testPathPattern', config.pattern);
  }

  if (config.exclude) {
    args.push('--testPathIgnorePatterns', config.exclude);
  }

  if (config.grep) {
    args.push('--testNamePattern', config.grep);
  }

  if (config.coverage) {
    args.push('--coverage');
    if (config.coverageReporters) {
      args.push('--coverageReporters', ...config.coverageReporters);
    }
  }

  return args;
}

function printUsage() {
  console.log('ExportStep Test Runner\n');
  console.log('Usage: node test-runner.js [command] [options]\n');
  console.log('Commands:');
  
  Object.entries(TEST_CONFIGS).forEach(([cmd, config]) => {
    console.log(`  ${cmd.padEnd(12)} ${config.description}`);
  });

  console.log('\nOptions:');
  console.log('  --watch      Run tests in watch mode');
  console.log('  --verbose    Show detailed test output');
  console.log('  --silent     Suppress console output during tests');
  console.log('  --bail       Stop after first test failure');
  console.log('\nExamples:');
  console.log('  node test-runner.js unit --watch');
  console.log('  node test-runner.js export --verbose');
  console.log('  node test-runner.js coverage --silent');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const command = args[0];
  const options = args.slice(1);

  if (!TEST_CONFIGS[command]) {
    console.error(`Unknown command: ${command}\n`);
    printUsage();
    process.exit(1);
  }

  const config = TEST_CONFIGS[command];
  const jestArgs = buildJestArgs(config);

  // Add user options
  jestArgs.push(...options);

  console.log(`Running ${command} tests...`);
  console.log(`Description: ${config.description}`);
  
  if (jestArgs.length > 0) {
    console.log(`Jest args: ${jestArgs.join(' ')}`);
  }
  
  console.log('');

  try {
    await runJest(jestArgs);
    console.log(`\n✅ ${command} tests completed successfully!`);
  } catch (error) {
    console.error(`\n❌ ${command} tests failed:`, error.message);
    process.exit(1);
  }
}

// Custom test scenarios
const SCENARIOS = {
  'format-validation': {
    description: 'Test format validation for all supported formats',
    async run() {
      console.log('Testing format validation...');
      await runJest(['--testNamePattern', 'validateForFormat|validation']);
    }
  },
  
  'export-workflow': {
    description: 'Test complete export workflow from UI to file',
    async run() {
      console.log('Testing export workflow...');
      await runJest(['--testNamePattern', 'export.*workflow|exportSubtitles']);
    }
  },
  
  'accessibility-full': {
    description: 'Comprehensive accessibility testing',
    async run() {
      console.log('Running comprehensive accessibility tests...');
      await runJest([
        '--testNamePattern', 
        'accessibility|aria|keyboard|screen reader|focus|semantic',
        '--verbose'
      ]);
    }
  }
};

// Handle special scenarios
if (args[0] && SCENARIOS[args[0]]) {
  const scenario = SCENARIOS[args[0]];
  console.log(`Running scenario: ${scenario.description}`);
  scenario.run().catch(error => {
    console.error('Scenario failed:', error.message);
    process.exit(1);
  });
} else {
  main().catch(error => {
    console.error('Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  runJest,
  buildJestArgs,
  TEST_CONFIGS,
  SCENARIOS
};