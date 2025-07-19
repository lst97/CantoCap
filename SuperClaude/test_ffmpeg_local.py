#!/usr/bin/env python3
"""
Test local FFmpeg configuration with CantoSub.
"""

import sys
import os
from pathlib import Path

def test_local_ffmpeg():
    """Test that local ffmpeg.exe can be found and used."""
    
    print("🔍 Testing Local FFmpeg Configuration...")
    
    # Add src to path
    sys.path.insert(0, 'src')
    
    try:
        from cantosub.presentation.di.container import Container
        
        # Create container
        container = Container()
        
        # Get FFmpeg service
        ffmpeg_service = container.get_ffmpeg_service()
        
        print(f"✅ FFmpeg path: {ffmpeg_service.ffmpeg_path}")
        
        # Test if FFmpeg is available
        if ffmpeg_service.is_available():
            print("✅ FFmpeg is available and working")
            
            # Get version
            version = ffmpeg_service.get_version()
            if version:
                print(f"✅ FFmpeg version: {version}")
            else:
                print("⚠️ Could not get FFmpeg version")
            
            return True
        else:
            print("❌ FFmpeg is not working")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ffmpeg_direct():
    """Test ffmpeg.exe directly."""
    
    print("\n🔍 Testing FFmpeg.exe Directly...")
    
    ffmpeg_path = Path("lib/ffmpeg.exe")
    
    if not ffmpeg_path.exists():
        print(f"❌ FFmpeg not found at: {ffmpeg_path}")
        return False
    
    print(f"✅ FFmpeg found at: {ffmpeg_path.absolute()}")
    
    try:
        import subprocess
        
        # Test ffmpeg version
        result = subprocess.run(
            [str(ffmpeg_path), "-version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print("✅ FFmpeg executable working")
            
            # Extract version from output
            lines = result.stdout.split('\n')
            if lines:
                version_line = lines[0]
                print(f"✅ Version: {version_line}")
            
            return True
        else:
            print(f"❌ FFmpeg failed with return code: {result.returncode}")
            print(f"Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing FFmpeg: {e}")
        return False

def test_media_file():
    """Test with actual media file."""
    
    print("\n🔍 Testing with Media File...")
    
    test_file = Path("tests/test.mp4")
    
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        return False
    
    try:
        sys.path.insert(0, 'src')
        from cantosub.presentation.di.container import Container
        
        container = Container()
        ffmpeg_service = container.get_ffmpeg_service()
        
        # Try to get media info
        info = ffmpeg_service.get_media_info(str(test_file))
        
        print("✅ Successfully read media file info")
        print(f"   Duration: {info.get('format', {}).get('duration', 'unknown')} seconds")
        
        # Get duration using service method
        duration = ffmpeg_service.get_audio_duration(str(test_file))
        print(f"   Audio duration: {duration:.2f} seconds")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading media file: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all FFmpeg tests."""
    
    print("🚀 CantoSub Local FFmpeg Configuration Test")
    print("=" * 50)
    
    tests = [
        ("Direct FFmpeg Test", test_ffmpeg_direct),
        ("Container FFmpeg Test", test_local_ffmpeg),
        ("Media File Test", test_media_file)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                print(f"\n✅ {test_name}: PASSED")
                passed += 1
            else:
                print(f"\n❌ {test_name}: FAILED")
        except Exception as e:
            print(f"\n❌ {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 Local FFmpeg configuration working!")
        print("\n📝 Next step: Try running CantoSub:")
        print("   python -m cantosub.presentation.cli.main tests/test.mp4")
        return 0
    else:
        print("\n⚠️ Some FFmpeg tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())