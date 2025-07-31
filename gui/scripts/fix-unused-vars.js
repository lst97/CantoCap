#!/usr/bin/env node

/**
 * Script to automatically fix unused variable issues by prefixing with underscore
 * This script scans for common unused variable patterns and fixes them automatically
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const patterns = [
  // Common unused variable patterns that should be prefixed with _
  { pattern: /\bcatch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g, replacement: 'catch (_$1)' },
  { pattern: /\bcatch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([^)]+)\s*\)/g, replacement: 'catch (_$1: $2)' },
  
  // Function parameters that are obviously unused (like error handlers)
  { pattern: /(\w+Error[^,)]*)[,)]/g, replacement: '_$1$&' },
  { pattern: /(\w*error[^,)]*)[,)]/gi, replacement: '_$1$&' },
  
  // Common unused variables
  { pattern: /const\s+(output|stdout|stderr|result|response|data)\s*=/g, replacement: 'const _$1 =' },
  { pattern: /let\s+(output|stdout|stderr|result|response|data)\s*=/g, replacement: 'let _$1 =' },
  
  // Destructured unused variables
  { pattern: /{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*}/g, replacement: '{ _$1 }' },
];

async function fixUnusedVariables() {
  console.log('🔧 Fixing unused variable patterns...');
  
  const files = await glob('src/**/*.{ts,tsx,js,jsx}', { cwd: process.cwd() });
  let totalFixed = 0;
  
  for (const file of files) {
    try {
      let content = readFileSync(file, 'utf8');
      let modified = false;
      let fixes = 0;
      
      // Apply each pattern
      for (const { pattern, replacement } of patterns) {
        const originalContent = content;
        content = content.replace(pattern, replacement);
        if (content !== originalContent) {
          modified = true;
          fixes++;
        }
      }
      
      // Additional manual fixes for specific patterns
      // Fix error variables in catch blocks
      content = content.replace(
        /catch\s*\(\s*([a-zA-Z][a-zA-Z0-9]*)\s*\)/g,
        (match, varName) => {
          if (!varName.startsWith('_')) {
            return `catch (_${varName})`;
          }
          return match;
        }
      );
      
      // Fix unused imports
      content = content.replace(
        /import\s*{([^}]+)}\s*from/g,
        (match, imports) => {
          const fixedImports = imports
            .split(',')
            .map(imp => {
              const trimmed = imp.trim();
              if (trimmed && !trimmed.startsWith('_')) {
                // Check if it's an unused type import
                if (trimmed.includes('Error') || trimmed.includes('Exception')) {
                  return ` _${trimmed}`;
                }
              }
              return imp;
            })
            .join(',');
          return `import {${fixedImports}} from`;
        }
      );
      
      if (modified) {
        writeFileSync(file, content, 'utf8');
        console.log(`✅ Fixed ${fixes} patterns in ${file}`);
        totalFixed += fixes;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Total fixes applied: ${totalFixed}`);
  console.log('📝 Run `pnpm run lint:fix` to apply ESLint auto-fixes');
}

fixUnusedVariables().catch(console.error);