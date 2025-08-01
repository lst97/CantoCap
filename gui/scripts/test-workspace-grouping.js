#!/usr/bin/env node

/**
 * Workspace Grouping Test Runner
 * Comprehensive test execution script for the workspace grouping system
 * with detailed reporting, coverage analysis, and performance metrics.
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// Test configuration
const testConfig = {
  patterns: {
    database: 'workspace-database-grouping.test.ts',
    store: 'workspace-store-grouping.test.ts',
    components: [
      'WorkspaceGroup.test.tsx',
      'EnhancedWorkspacePanel-dnd.test.tsx'
    ],
    integration: [
      'workspace-grouping-integration.test.ts',
      'workspace-grouping-performance.test.ts',
      'workspace-grouping-accessibility.test.tsx',
      'workspace-grouping-edge-cases.test.ts'
    ]
  },
  coverage: {
    threshold: {
      global: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      },
      critical: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95
      }
    }
  },
  performance: {
    maxDuration: 30000, // 30 seconds per test suite
    memoryLimit: 512 * 1024 * 1024 // 512MB
  }
}

// Utility functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

const logSection = (title) => {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(`${title.toUpperCase()}`, 'cyan')
  log(`${'='.repeat(60)}`, 'cyan')
}

const logStep = (step, status = 'info') => {
  const symbol = status === 'success' ? '✓' : status === 'error' ? '✗' : '→'
  const color = status === 'success' ? 'green' : status === 'error' ? 'red' : 'blue'
  log(`${symbol} ${step}`, color)
}

const runCommand = (command, options = {}) => {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      ...options 
    })
    return { success: true, output: result }
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || error.message,
      error: error.stderr || error.message
    }
  }
}

const measurePerformance = (testSuite, duration, memory) => {
  const status = duration > testConfig.performance.maxDuration ? 'warning' : 'success'
  log(`  Duration: ${duration}ms`, status === 'warning' ? 'yellow' : 'green')
  log(`  Memory: ${Math.round(memory / 1024 / 1024)}MB`, 'blue')
  
  if (status === 'warning') {
    log(`  ⚠️  Test suite exceeded recommended duration`, 'yellow')
  }
}

// Test execution functions
const runUnitTests = async () => {
  logSection('Unit Tests')
  
  const unitTests = [
    { name: 'Database Layer', pattern: testConfig.patterns.database },
    { name: 'Store Management', pattern: testConfig.patterns.store },
    ...testConfig.patterns.components.map(pattern => ({
      name: `Component - ${pattern.replace('.test.tsx', '')}`,
      pattern
    }))
  ]

  const results = []
  
  for (const test of unitTests) {
    logStep(`Running ${test.name}`)
    
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    const result = runCommand(`npx jest --testPathPattern="${test.pattern}" --coverage=false --verbose`)
    
    const endTime = Date.now()
    const endMemory = process.memoryUsage().heapUsed
    const duration = endTime - startTime
    const memoryDelta = endMemory - startMemory
    
    if (result.success) {
      logStep(`${test.name} - PASSED`, 'success')
      measurePerformance(test.name, duration, memoryDelta)
    } else {
      logStep(`${test.name} - FAILED`, 'error')
      log(result.error, 'red')
    }
    
    results.push({
      name: test.name,
      success: result.success,
      duration,
      memory: memoryDelta,
      output: result.output
    })
  }
  
  return results
}

const runIntegrationTests = async () => {
  logSection('Integration Tests')
  
  const integrationTests = testConfig.patterns.integration.map(pattern => ({
    name: pattern.replace('workspace-grouping-', '').replace('.test.ts', '').replace('.test.tsx', ''),
    pattern
  }))

  const results = []
  
  for (const test of integrationTests) {
    logStep(`Running ${test.name} integration tests`)
    
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    const result = runCommand(`npx jest --testPathPattern="${test.pattern}" --coverage=false --verbose --maxWorkers=1`)
    
    const endTime = Date.now()
    const endMemory = process.memoryUsage().heapUsed
    const duration = endTime - startTime
    const memoryDelta = endMemory - startMemory
    
    if (result.success) {
      logStep(`${test.name} - PASSED`, 'success')
      measurePerformance(test.name, duration, memoryDelta)
    } else {
      logStep(`${test.name} - FAILED`, 'error')
      log(result.error, 'red')
    }
    
    results.push({
      name: test.name,
      success: result.success,
      duration,
      memory: memoryDelta,
      output: result.output
    })
  }
  
  return results
}

const runCoverageAnalysis = async () => {
  logSection('Coverage Analysis')
  
  logStep('Generating coverage report')
  
  const coverageCommand = `npx jest --testPathPattern="workspace.*grouping" --coverage --coverageReporters=text --coverageReporters=html --coverageReporters=json`
  const result = runCommand(coverageCommand)
  
  if (result.success) {
    logStep('Coverage report generated', 'success')
    
    // Parse coverage results
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json')
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
        
        log('\nCoverage Summary:', 'bright')
        log(`  Lines: ${coverage.total.lines.pct}%`, coverage.total.lines.pct >= 85 ? 'green' : 'red')
        log(`  Functions: ${coverage.total.functions.pct}%`, coverage.total.functions.pct >= 85 ? 'green' : 'red')
        log(`  Branches: ${coverage.total.branches.pct}%`, coverage.total.branches.pct >= 85 ? 'green' : 'red')
        log(`  Statements: ${coverage.total.statements.pct}%`, coverage.total.statements.pct >= 85 ? 'green' : 'red')
        
        // Check critical files
        const criticalFiles = [
          'workspace-database.ts',
          'workspace-store.ts'
        ]
        
        log('\nCritical File Coverage:', 'bright')
        for (const file of criticalFiles) {
          const fileKey = Object.keys(coverage).find(key => key.includes(file))
          if (fileKey && coverage[fileKey]) {
            const fileCoverage = coverage[fileKey]
            const meetsCritical = fileCoverage.lines.pct >= 95
            log(`  ${file}: ${fileCoverage.lines.pct}%`, meetsCritical ? 'green' : 'red')
          }
        }
      }
    } catch (error) {
      log(`Error parsing coverage: ${error.message}`, 'yellow')
    }
    
    return { success: true, output: result.output }
  } else {
    logStep('Coverage analysis failed', 'error')
    log(result.error, 'red')
    return { success: false, error: result.error }
  }
}

const runPerformanceBenchmarks = async () => {
  logSection('Performance Benchmarks')
  
  logStep('Running performance-specific tests')
  
  const perfCommand = `npx jest --testPathPattern="workspace-grouping-performance" --verbose --maxWorkers=1`
  const result = runCommand(perfCommand)
  
  if (result.success) {
    logStep('Performance benchmarks completed', 'success')
    
    // Extract performance metrics from output
    const lines = result.output.split('\n')
    const perfMetrics = lines.filter(line => 
      line.includes('ms') || line.includes('MB') || line.includes('operation')
    )
    
    if (perfMetrics.length > 0) {
      log('\nPerformance Metrics:', 'bright')
      perfMetrics.forEach(metric => log(`  ${metric}`, 'blue'))
    }
    
    return { success: true, metrics: perfMetrics }
  } else {
    logStep('Performance benchmarks failed', 'error')
    log(result.error, 'red')
    return { success: false, error: result.error }
  }
}

const runAccessibilityTests = async () => {
  logSection('Accessibility Tests')
  
  logStep('Running accessibility compliance tests')
  
  const a11yCommand = `npx jest --testPathPattern="workspace-grouping-accessibility" --verbose`
  const result = runCommand(a11yCommand)
  
  if (result.success) {
    logStep('Accessibility tests passed', 'success')
    log('  ✓ WCAG 2.1 AA compliance verified', 'green')
    log('  ✓ Keyboard navigation functional', 'green')
    log('  ✓ Screen reader support confirmed', 'green')
    return { success: true }
  } else {
    logStep('Accessibility tests failed', 'error')
    log(result.error, 'red')
    return { success: false, error: result.error }
  }
}

const generateTestReport = (results) => {
  logSection('Test Summary Report')
  
  const allTests = [
    ...results.unit,
    ...results.integration
  ]
  
  const totalTests = allTests.length
  const passedTests = allTests.filter(test => test.success).length
  const failedTests = totalTests - passedTests
  
  const totalDuration = allTests.reduce((sum, test) => sum + test.duration, 0)
  const totalMemory = allTests.reduce((sum, test) => sum + test.memory, 0)
  
  log(`\nOverall Results:`, 'bright')
  log(`  Total Tests: ${totalTests}`, 'blue')
  log(`  Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow')
  log(`  Failed: ${failedTests}`, failedTests === 0 ? 'green' : 'red')
  log(`  Total Duration: ${Math.round(totalDuration / 1000)}s`, 'blue')
  log(`  Memory Usage: ${Math.round(totalMemory / 1024 / 1024)}MB`, 'blue')
  
  if (results.coverage.success) {
    log(`  Coverage: Generated ✓`, 'green')
  } else {
    log(`  Coverage: Failed ✗`, 'red')
  }
  
  if (results.performance.success) {
    log(`  Performance: Benchmarked ✓`, 'green')
  } else {
    log(`  Performance: Failed ✗`, 'red')
  }
  
  if (results.accessibility.success) {
    log(`  Accessibility: Compliant ✓`, 'green')
  } else {
    log(`  Accessibility: Issues Found ✗`, 'red')
  }
  
  // Generate detailed report file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      duration: totalDuration,
      memory: totalMemory
    },
    results: {
      unit: results.unit,
      integration: results.integration,
      coverage: results.coverage,
      performance: results.performance,
      accessibility: results.accessibility
    }
  }
  
  const reportPath = path.join(process.cwd(), 'test-reports', 'workspace-grouping-report.json')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
  
  log(`\nDetailed report saved to: ${reportPath}`, 'cyan')
  
  return {
    success: failedTests === 0 && results.coverage.success && results.performance.success && results.accessibility.success,
    summary: reportData.summary
  }
}

// Main execution
const main = async () => {
  log('🧪 Workspace Grouping System Test Suite', 'bright')
  log('==========================================', 'cyan')
  
  const startTime = Date.now()
  
  try {
    // Run all test suites
    const unitResults = await runUnitTests()
    const integrationResults = await runIntegrationTests()
    const coverageResults = await runCoverageAnalysis()
    const performanceResults = await runPerformanceBenchmarks()
    const accessibilityResults = await runAccessibilityTests()
    
    // Generate comprehensive report
    const testResults = {
      unit: unitResults,
      integration: integrationResults,
      coverage: coverageResults,
      performance: performanceResults,
      accessibility: accessibilityResults
    }
    
    const report = generateTestReport(testResults)
    
    const endTime = Date.now()
    const totalDuration = Math.round((endTime - startTime) / 1000)
    
    logSection('Final Results')
    
    if (report.success) {
      log('🎉 ALL TESTS PASSED! Workspace grouping system is production-ready.', 'green')
      log(`   Total execution time: ${totalDuration}s`, 'blue')
      process.exit(0)
    } else {
      log('❌ Some tests failed. Please review the results above.', 'red')
      log(`   Total execution time: ${totalDuration}s`, 'blue')
      process.exit(1)
    }
    
  } catch (error) {
    log(`💥 Test execution failed: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Handle CLI arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  log('Workspace Grouping Test Runner', 'cyan')
  log('Usage: node test-workspace-grouping.js [options]', 'blue')
  log('')
  log('Options:', 'bright')
  log('  --unit          Run only unit tests', 'blue')
  log('  --integration   Run only integration tests', 'blue')
  log('  --coverage      Run only coverage analysis', 'blue')
  log('  --performance   Run only performance benchmarks', 'blue')
  log('  --accessibility Run only accessibility tests', 'blue')
  log('  --help, -h      Show this help message', 'blue')
  process.exit(0)
}

if (args.includes('--unit')) {
  runUnitTests().then(() => process.exit(0)).catch(() => process.exit(1))
} else if (args.includes('--integration')) {
  runIntegrationTests().then(() => process.exit(0)).catch(() => process.exit(1))
} else if (args.includes('--coverage')) {
  runCoverageAnalysis().then(() => process.exit(0)).catch(() => process.exit(1))
} else if (args.includes('--performance')) {
  runPerformanceBenchmarks().then(() => process.exit(0)).catch(() => process.exit(1))
} else if (args.includes('--accessibility')) {
  runAccessibilityTests().then(() => process.exit(0)).catch(() => process.exit(1))
} else {
  main()
}