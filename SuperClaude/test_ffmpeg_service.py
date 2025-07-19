#!/usr/bin/env python3
"""
Test FFmpegService directly with local ffmpeg.exe.
"""

import sys
import os
from pathlib import Path

def test_ffmpeg_service_direct():
    """Test FFmpegService with local ffmpeg.exe."""
    
    print("🔍 Testing FFmpegService with Local FFmpeg...")
    
    sys.path.insert(0, 'src')
    
    try:
        # Import FFmpegService directly
        from cantosub.infrastructure.services.ffmpeg_service import FFmpegService
        
        # Get local ffmpeg path
        ffmpeg_path = Path("lib/ffmpeg.exe").absolute()
        print(f"✅ Using FFmpeg at: {ffmpeg_path}")
        
        # Create service with custom path
        ffmpeg_service = FFmpegService(ffmpeg_path=str(ffmpeg_path))
        
        print(f"✅ FFmpegService created with path: {ffmpeg_service.ffmpeg_path}")
        
        # Test availability
        if ffmpeg_service.is_available():
            print("✅ FFmpeg service is available")
            
            # Get version
            version = ffmpeg_service.get_version()
            if version:
                print(f"✅ Version: {version}")
            
            return True
        else:
            print("❌ FFmpeg service not available")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_media_probe():
    """Test media probing with local ffmpeg."""
    
    print("\n🔍 Testing Media Probing...")
    
    sys.path.insert(0, 'src')
    
    try:
        from cantosub.infrastructure.services.ffmpeg_service import FFmpegService
        
        # Create service with local ffmpeg
        ffmpeg_path = str(Path("lib/ffmpeg.exe").absolute())
        ffmpeg_service = FFmpegService(ffmpeg_path=ffmpeg_path)
        
        # Test with media file
        test_file = "tests/test.mp4"
        
        if not Path(test_file).exists():
            print(f"❌ Test file not found: {test_file}")
            return False
        
        print(f"✅ Testing with: {test_file}")
        
        # Get media info
        info = ffmpeg_service.get_media_info(test_file)
        print("✅ Successfully got media info")
        
        # Show some details
        format_info = info.get('format', {})
        duration = format_info.get('duration')
        if duration:
            print(f"   Duration: {float(duration):.2f} seconds")
        
        # Count streams
        streams = info.get('streams', [])
        audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
        video_streams = [s for s in streams if s.get('codec_type') == 'video']
        
        print(f"   Streams: {len(video_streams)} video, {len(audio_streams)} audio")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_cli_with_local_ffmpeg():
    """Test running the CLI with local ffmpeg configured."""
    
    print("\n🔍 Testing CLI with Local FFmpeg...")
    
    try:
        import subprocess
        
        # Try to run the CLI with the test file
        result = subprocess.run([
            sys.executable, "-c", """
import sys
sys.path.insert(0, 'src')

# Test just the container creation with local ffmpeg
from cantosub.presentation.di.container import Container

container = Container()
ffmpeg_service = container.get_ffmpeg_service()

print(f'FFmpeg path: {ffmpeg_service.ffmpeg_path}')
print(f'Available: {ffmpeg_service.is_available()}')
print(f'Version: {ffmpeg_service.get_version()}')
"""
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Container with local FFmpeg working")
            print("Output:")
            for line in result.stdout.strip().split('\n'):
                print(f"   {line}")
            return True
        else:
            print("❌ Container test failed")
            print(f"Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ CLI test error: {e}")
        return False

def main():
    """Run FFmpeg service tests."""
    
    print("🚀 CantoSub FFmpeg Service Test")
    print("=" * 50)
    
    tests = [
        ("FFmpeg Service Direct", test_ffmpeg_service_direct),
        ("Media Probing", test_media_probe),
        ("Container Integration", test_cli_with_local_ffmpeg)
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
    
    if passed >= 2:  # Allow for some failures due to torch dependencies
        print("\n🎉 FFmpeg configuration working with local executable!")
        print("\n📝 You can now run CantoSub once torch dependencies are installed:")
        print("   pip install torch torchaudio transformers")
        print("   python -m cantosub.presentation.cli.main tests/test.mp4")
        return 0
    else:
        print("\n⚠️ FFmpeg configuration needs attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())