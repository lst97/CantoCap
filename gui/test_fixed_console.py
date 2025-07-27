#!/usr/bin/env python3
"""
Test the fixed console interceptor to ensure IPC output appears.
"""

import sys
import os

# Add the engine path
engine_path = "/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine"
sys.path.insert(0, engine_path)
sys.path.insert(0, os.path.join(engine_path, "src", "presentation", "cli"))

def test_fixed_console():
    """Test that console interception works without hanging."""
    print("=== Testing Fixed Console Interceptor ===")
    
    try:
        # Import the fixed modules
        from ipc_handler import IPCHandler
        from console_interceptor import ConsoleInterceptor
        
        # Create handler and interceptor
        handler = IPCHandler()
        interceptor = ConsoleInterceptor(handler)
        
        print("✅ Modules imported successfully")
        print("✅ Handler and interceptor created")
        
        # Test console capture
        print("🔄 Starting console capture...")
        interceptor.start_capture()
        
        # Test various outputs - these should generate IPC messages
        print("✅ Using Apple Metal Performance Shaders (MPS)")
        print("Loading model 'openai/whisper-small' on device: mps")
        print("Device set to use mps")
        print("✅ Standard pipeline loading successful")
        
        # Test stderr output
        print("Using `chunk_length_s` is very experimental with seq2seq models", file=sys.stderr)
        
        # Stop capture
        interceptor.stop_capture()
        print("🔄 Console capture stopped")
        
        print("✅ Test completed - if you see JSON messages above, the fix worked!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_fixed_console()