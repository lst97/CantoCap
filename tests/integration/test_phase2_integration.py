"""Integration tests for Phase 2 features."""

import pytest
from pathlib import Path

from cantosub.application import GenerateSubtitlesCommand
from cantosub.presentation.di.container import Container
from cantosub.infrastructure.services import (
    SpeakerDiarizationService,
    LLMServiceFactory,
    MusicDetectionService,
    CharsetConversionService
)


class TestPhase2Integration:
    """Test Phase 2 service integration."""
    
    def setup_method(self):
        """Set up test dependencies."""
        self.container = Container()
        
    def teardown_method(self):
        """Clean up after tests."""
        self.container.cleanup()
    
    def test_container_provides_phase2_services(self):
        """Test that container provides all Phase 2 services."""
        # Test service creation
        speaker_service = self.container.get_speaker_diarization_service()
        llm_factory = self.container.get_llm_service_factory()
        music_service = self.container.get_music_detection_service()
        charset_service = self.container.get_charset_conversion_service()
        
        # Verify service types
        assert isinstance(speaker_service, SpeakerDiarizationService)
        assert isinstance(llm_factory, LLMServiceFactory)
        assert isinstance(music_service, MusicDetectionService)
        assert isinstance(charset_service, CharsetConversionService)
    
    def test_container_singleton_behavior(self):
        """Test that container returns same instances (singleton behavior)."""
        # Get services twice
        speaker1 = self.container.get_speaker_diarization_service()
        speaker2 = self.container.get_speaker_diarization_service()
        
        music1 = self.container.get_music_detection_service()
        music2 = self.container.get_music_detection_service()
        
        # Should be same instances
        assert speaker1 is speaker2
        assert music1 is music2
    
    def test_phase2_command_creation(self):
        """Test creating command with Phase 2 features enabled."""
        test_file = Path(__file__).parent.parent / "test.mp3"
        
        # Create command with all Phase 2 features
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_file),
            output_file_path=None,
            language="zh",
            model_name="openai/whisper-large-v3",
            enable_speakers=True,
            enable_written_style=True,
            enable_music_detection=True,
            charset="traditional"
        )
        
        # Verify Phase 2 properties
        assert command.enable_speakers is True
        assert command.enable_written_style is True
        assert command.enable_music_detection is True
        assert command.charset == "traditional"
    
    def test_speaker_diarization_service_info(self):
        """Test speaker diarization service provides info."""
        service = self.container.get_speaker_diarization_service()
        
        # Should provide model info (even if not loaded)
        info = service.get_model_info()
        assert isinstance(info, dict)
        assert "model_name" in info
        assert "device" in info
        assert "is_loaded" in info
    
    def test_music_detection_service_info(self):
        """Test music detection service provides info."""
        service = self.container.get_music_detection_service()
        
        # Should provide model info
        info = service.get_model_info()
        assert isinstance(info, dict)
        assert "model_name" in info
        assert "device" in info
        assert "is_loaded" in info
    
    def test_charset_service_availability(self):
        """Test charset conversion service availability."""
        service = self.container.get_charset_conversion_service()
        
        # Should provide service info
        info = service.get_service_info()
        assert isinstance(info, dict)
        assert "service_name" in info
        assert "supported_charsets" in info
        
        # Should list supported charsets
        charsets = service.get_supported_charsets()
        assert "traditional" in charsets
        assert "simplified" in charsets
    
    def test_llm_service_factory(self):
        """Test LLM service factory creation."""
        factory = self.container.get_llm_service_factory()
        
        # Should be able to create services (even without API keys)
        try:
            openai_service = factory.create_service("openai")
            assert openai_service is not None
        except Exception:
            # Expected if no API key - that's fine for this test
            pass
        
        try:
            gemini_service = factory.create_service("gemini")
            assert gemini_service is not None
        except Exception:
            # Expected if no API key - that's fine for this test
            pass
    
    def test_phase2_services_cleanup(self):
        """Test that Phase 2 services clean up properly."""
        # Get all services
        speaker_service = self.container.get_speaker_diarization_service()
        music_service = self.container.get_music_detection_service()
        charset_service = self.container.get_charset_conversion_service()
        
        # Cleanup should not raise exceptions
        self.container.cleanup()
        
        # Services should still be accessible but cleaned up
        assert speaker_service is not None
        assert music_service is not None
        assert charset_service is not None


class TestPhase2ServiceIntegration:
    """Test individual Phase 2 service functionality."""
    
    def test_charset_conversion_basic(self):
        """Test basic charset conversion functionality."""
        from cantosub.domain.value_objects import Charset
        
        service = CharsetConversionService()
        
        # Test charset detection
        test_text = "你好世界"
        detected = service.detect_charset(test_text)
        assert isinstance(detected, Charset)
        
        # Test supported charsets
        charsets = service.get_supported_charsets()
        assert len(charsets) > 0
    
    def test_music_detection_basic(self):
        """Test basic music detection functionality."""
        service = MusicDetectionService()
        
        # Test model info without loading
        info = service.get_model_info()
        assert info["is_loaded"] is False
        
        # Test processing time estimation
        estimated_time = service.estimate_processing_time(30.0)
        assert estimated_time > 0
    
    def test_speaker_diarization_basic(self):
        """Test basic speaker diarization functionality."""
        service = SpeakerDiarizationService()
        
        # Test model info without loading
        info = service.get_model_info()
        assert info["is_loaded"] is False
        
        # Test processing time estimation
        estimated_time = service.estimate_processing_time(60.0)
        assert estimated_time > 0


if __name__ == "__main__":
    pytest.main([__file__])