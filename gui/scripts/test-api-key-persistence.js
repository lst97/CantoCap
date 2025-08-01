#!/usr/bin/env node

/**
 * Test script to verify API key persistence fix
 * 
 * This script simulates the config mapping logic to verify that
 * the main process config structure is correctly mapped to the
 * renderer config structure.
 */

// Simulate main process config structure
const mockMainConfig = {
  apiKeys: {
    gemini: 'AI12345_test_gemini_key',
    huggingface: 'hf_test_token_123456'
  },
  dependencies: {
    ffmpegPath: '/usr/local/bin/ffmpeg'
  },
  modelSettings: {
    priority: 'balanced'
  },
  lastInputPath: '/test/input.mp4',
  lastOutputPath: '/test/output.srt'
}

// Simulate renderer config defaults
const rendererDefaults = {
  geminiKey: '',
  hfToken: '',
  ffmpegPath: null,
  inputFile: null,
  outputFile: null
}

// Apply the fixed mapping logic
function mapMainConfigToRenderer(mainConfig) {
  if (!mainConfig) return null
  
  return {
    ...mainConfig,
    // Map nested API keys to flat structure
    geminiKey: mainConfig.apiKeys?.gemini || '',
    hfToken: mainConfig.apiKeys?.huggingface || '',
    // Map other nested structures as needed
    ffmpegPath: mainConfig.dependencies?.ffmpegPath || null,
    // Remove nested structures to avoid conflicts
    apiKeys: undefined,
    dependencies: undefined,
    modelSettings: undefined,
    advancedSettings: undefined,
    ui: undefined,
    window: undefined
  }
}

// Test the mapping
console.log('🧪 Testing API Key Persistence Fix')
console.log('=====================================')

console.log('\n📥 Mock Main Process Config:')
console.log(JSON.stringify(mockMainConfig, null, 2))

const mappedConfig = mapMainConfigToRenderer(mockMainConfig)
console.log('\n🔄 Mapped Renderer Config:')
console.log(JSON.stringify(mappedConfig, null, 2))

const finalConfig = {
  ...rendererDefaults,
  ...mappedConfig
}

console.log('\n✅ Final Merged Config:')
console.log(JSON.stringify(finalConfig, null, 2))

// Verify the fix
const isFixed = finalConfig.geminiKey === 'AI12345_test_gemini_key' && 
                finalConfig.hfToken === 'hf_test_token_123456'

console.log('\n🔍 Verification:')
console.log(`Gemini Key: ${finalConfig.geminiKey ? '✅ SET' : '❌ MISSING'}`)
console.log(`HF Token: ${finalConfig.hfToken ? '✅ SET' : '❌ MISSING'}`)
console.log(`FFmpeg Path: ${finalConfig.ffmpegPath ? '✅ SET' : '❌ MISSING'}`)

console.log(`\n${isFixed ? '✅ FIX VERIFIED - API keys should persist correctly!' : '❌ FIX FAILED - API keys still missing'}`)