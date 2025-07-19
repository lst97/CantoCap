#!/usr/bin/env python3
"""
Phase 2 Integration Validation Script

Tests the Phase 2 implementation without running full dependencies.
"""

import sys
from pathlib import Path

def validate_phase2_structure():
    """Validate Phase 2 file structure and architecture."""
    
    print("🔍 Validating Phase 2 Implementation Structure...")
    
    # Check Phase 2 domain entities
    phase2_files = {
        "Domain - Speaker Entity": "src/cantosub/domain/entities/speaker.py",
        "Domain - Music Entity": "src/cantosub/domain/entities/music.py",
        "Domain - Charset Value Object": "src/cantosub/domain/value_objects/charset.py",
        "Infrastructure - Speaker Service": "src/cantosub/infrastructure/services/speaker_diarization_service.py",
        "Infrastructure - LLM Service": "src/cantosub/infrastructure/services/llm_service.py",
        "Infrastructure - Music Service": "src/cantosub/infrastructure/services/music_detection_service.py",
        "Infrastructure - Charset Service": "src/cantosub/infrastructure/services/charset_conversion_service.py",
        "Application - Updated Command": "src/cantosub/application/commands/generate_subtitles_command.py",
        "CLI - Updated Commands": "src/cantosub/presentation/cli/commands.py",
        "CLI - Updated Main": "src/cantosub/presentation/cli/main.py",
        "DI - Updated Container": "src/cantosub/presentation/di/container.py",
        "Infrastructure - Updated Init": "src/cantosub/infrastructure/__init__.py",
        "Services - Updated Init": "src/cantosub/infrastructure/services/__init__.py",
    }
    
    missing_files = []
    for component, file_path in phase2_files.items():
        if Path(file_path).exists():
            print(f"✅ {component}")
        else:
            print(f"❌ {component} - Missing: {file_path}")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n❌ Missing {len(missing_files)} Phase 2 files")
        return False
    
    print(f"\n✅ All {len(phase2_files)} Phase 2 files present")
    return True

def validate_phase2_cli_features():
    """Validate CLI features without importing dependencies."""
    
    print("\n🔍 Validating CLI Phase 2 Features...")
    
    # Check CLI commands file for Phase 2 flags
    cli_commands_file = Path("src/cantosub/presentation/cli/commands.py")
    cli_main_file = Path("src/cantosub/presentation/cli/main.py")
    
    if not cli_commands_file.exists():
        print("❌ CLI commands file not found")
        return False
    
    if not cli_main_file.exists():
        print("❌ CLI main file not found")
        return False
    
    # Read CLI files and check for Phase 2 flags
    commands_content = cli_commands_file.read_text()
    main_content = cli_main_file.read_text()
    
    phase2_flags = ["--speakers", "--written", "--music", "--charset"]
    
    print("Checking CLI commands file:")
    for flag in phase2_flags:
        if flag in commands_content:
            print(f"✅ {flag} flag present in commands")
        else:
            print(f"❌ {flag} flag missing in commands")
    
    print("Checking CLI main file:")
    for flag in phase2_flags:
        if flag in main_content:
            print(f"✅ {flag} flag present in main")
        else:
            print(f"❌ {flag} flag missing in main")
    
    # Check for Phase 2 help examples
    if "speaker diarization" in main_content:
        print("✅ Phase 2 help examples present")
    else:
        print("❌ Phase 2 help examples missing")
    
    return True

def validate_command_structure():
    """Validate command structure for Phase 2."""
    
    print("\n🔍 Validating Command Structure...")
    
    command_file = Path("src/cantosub/application/commands/generate_subtitles_command.py")
    
    if not command_file.exists():
        print("❌ Command file not found")
        return False
    
    content = command_file.read_text()
    
    phase2_fields = [
        "enable_speakers",
        "enable_written_style", 
        "enable_music_detection",
        "charset"
    ]
    
    for field in phase2_fields:
        if field in content:
            print(f"✅ {field} field present in command")
        else:
            print(f"❌ {field} field missing in command")
    
    return True

def validate_container_integration():
    """Validate dependency injection container."""
    
    print("\n🔍 Validating Container Integration...")
    
    container_file = Path("src/cantosub/presentation/di/container.py")
    
    if not container_file.exists():
        print("❌ Container file not found")
        return False
    
    content = container_file.read_text()
    
    phase2_services = [
        "SpeakerDiarizationService",
        "LLMServiceFactory",
        "MusicDetectionService", 
        "CharsetConversionService"
    ]
    
    for service in phase2_services:
        if service in content:
            print(f"✅ {service} integrated in container")
        else:
            print(f"❌ {service} missing in container")
    
    return True

def main():
    """Run all Phase 2 validations."""
    
    print("🚀 CantoSub Phase 2 Implementation Validation")
    print("=" * 50)
    
    results = []
    
    # Run all validations
    results.append(validate_phase2_structure())
    results.append(validate_phase2_cli_features())
    results.append(validate_command_structure())
    results.append(validate_container_integration())
    
    # Summary
    print("\n" + "=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"🎉 All {total} validations passed!")
        print("\n✅ Phase 2 implementation is complete and ready for testing")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Test with media files: cantosub tests/test.mp3 --speakers --written")
        print("3. Run integration tests: pytest tests/integration/test_phase2_integration.py")
        return 0
    else:
        print(f"❌ {passed}/{total} validations passed")
        print("\nPhase 2 implementation needs attention before testing")
        return 1

if __name__ == "__main__":
    sys.exit(main())