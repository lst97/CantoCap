# buildCliCommand Initialization Error Fix

## Issue Description
**Error**: `Cannot access 'buildCliCommand' before initialization`

This is a JavaScript temporal dead zone error that occurs when trying to use a `const` or `let` declared function before it's actually declared in the code.

## Root Cause Analysis
In `src/renderer/src/components/feedback/DebugPanel.tsx`:

### Before Fix (Problematic Order):
```javascript
// Line 91-96: useEffect trying to use buildCliCommand
useEffect(() => {
  if (config.inputFile) {
    const cliCommand = buildCliCommand(config)  // ❌ Used before declaration
    addLog('command', 'CLIGenerator', `Generated CLI command: ${cliCommand}`, { config, command: cliCommand })
  }
}, [config])

// Line 102: Function declaration comes AFTER usage
const buildCliCommand = (cfg: any) => {
  // ... function body
}
```

### The Problem
- **useEffect** on line 91 calls `buildCliCommand(config)`
- **Function declaration** doesn't happen until line 102
- JavaScript temporal dead zone prevents accessing the function before its declaration

## Solution Applied

### After Fix (Correct Order):
```javascript
// Line 90: Function declaration comes FIRST
const buildCliCommand = (cfg: any) => {
  const args = []
  
  // Helper function to quote all string values (not just paths)
  const quoteValue = (value: string | number) => {
    return `"${value}"`
  }
  
  // ... rest of function body
  
  return `python3 -m src.presentation.cli.main --ipc-mode ${args.join(' ')}`
}

// Line 144: useEffect can now safely use the declared function
useEffect(() => {
  if (config.inputFile) {
    const cliCommand = buildCliCommand(config)  // ✅ Used after declaration
    addLog('command', 'CLIGenerator', `Generated CLI command: ${cliCommand}`, { config, command: cliCommand })
  }
}, [config])
```

## File Modified
- **File**: `src/renderer/src/components/feedback/DebugPanel.tsx`
- **Change**: Moved `buildCliCommand` function declaration before the `useEffect` that uses it

## Why This Happens
1. **`const` and `let` declarations** are hoisted but not initialized (temporal dead zone)
2. **`var` declarations** are hoisted and initialized with `undefined`
3. **Function declarations** (`function name() {}`) are fully hoisted and can be used before declaration
4. **Function expressions** (`const name = () => {}`) follow `const`/`let` rules

## Prevention
To avoid this in the future:
1. **Declare functions before using them**
2. **Use function declarations** (`function name() {}`) if you need hoisting
3. **Group function declarations together** at the top of components
4. **Use ESLint rules** to catch temporal dead zone issues

## Verification
✅ **Build Success**: Application builds without errors
✅ **Runtime Fix**: No more "Cannot access before initialization" error
✅ **Functionality**: Debug panel CLI command generation works correctly

## Related Functions
The `buildCliCommand` function is also used in:
- Line 226: `<pre>{buildCliCommand(config)}</pre>` (display)
- Line 228: `onClick={() => navigator.clipboard.writeText(buildCliCommand(config))}` (copy to clipboard)

All usages now work correctly since the function is declared before any usage.