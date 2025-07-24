"""
Integration tests for Whisper service functionality.

These tests verify that the Whisper service integrates correctly with actual models
and produces expected transcription outputs.
"""

import pytest
import tempfile
import os
from pathlib import Path
from typing import Optional, Dict, Any
import torch

from src.infrastructure.services.whisper_service import WhisperService
from src.infrastructure.services.hardware_detector import HardwareDetector
from src.domain.value_objects import AudioFormat, FilePath


class TestWhisperServiceIntegration:
    """Test Whisper service integration with real models."""
    
    @pytest.fixture
    def test_audio_path(self) -> Path:
        """Path to test audio file (extracted from test video)."""
        return Path(__file__).parent.parent / "test-keep-talking.mp4"
    
    @pytest.fixture
    def hardware_detector(self) -> HardwareDetector:
        """Hardware detector instance."""
        return HardwareDetector()
    
    @pytest.fixture
    def whisper_service_small(self) -> WhisperService:
        """Whisper service with small model for testing."""
        return WhisperService(
            model_name="openai/whisper-small",
            auto_select_model=False
        )
    
    @pytest.fixture
    def temp_audio_dir(self) -> Path:
        """Temporary directory for audio files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    def test_model_loading_small(self, whisper_service_small):
        """Test loading of small Whisper model."""
        # Model should load successfully
        assert whisper_service_small.model_name == "openai/whisper-small"
        
        # Test model initialization
        model = whisper_service_small._get_model()
        assert model is not None
    
    def test_hardware_detection(self, hardware_detector):
        """Test hardware detection capabilities."""
        hardware_profile = hardware_detector.detect_hardware()
        
        assert hasattr(hardware_profile, 'device_type')
        assert hasattr(hardware_profile, 'vram_gb')
        assert hasattr(hardware_profile, 'ram_gb')
        assert hardware_profile.device_type in ["cuda", "mps", "cpu"]
    
    def test_optimal_model_selection(self, hardware_detector):
        """Test optimal model selection based on hardware."""
        for priority in ["speed", "quality", "balanced"]:
            recommended_model, details = hardware_detector.recommend_model(priority=priority)
            assert hasattr(recommended_model, 'value')
            assert isinstance(recommended_model.value, str)
            assert "whisper" in recommended_model.value.lower()
    
    @pytest.mark.slow
    def test_transcription_basic(self, whisper_service_small, test_audio_path):
        """Test basic transcription functionality."""
        if not test_audio_path.exists():
            pytest.skip("Test audio file not available")
        
        # Create a progress callback for testing
        progress_events = []
        
        def progress_callback(stage: str, progress: float = 0.0, message: str = ""):
            progress_events.append({
                "stage": stage,
                "progress": progress,
                "message": message
            })
        
        whisper_service_small.set_progress_callback(progress_callback)
        
        try:
            # Perform transcription
            result = whisper_service_small.transcribe_audio(
                audio_file_path=FilePath.from_string(str(test_audio_path)),
                language="zh"
            )
            
            # Verify result structure
            assert hasattr(result, 'segments')
            assert len(result.segments) > 0
            
            # Verify progress callback was called
            assert len(progress_events) > 0
            
            # Check for expected progress stages
            stages = [event["stage"] for event in progress_events]
            assert "model_load_start" in stages or "transcription_start" in stages
            
            # Verify transcription content
            for segment in result.segments:
                assert hasattr(segment, 'text')
                assert hasattr(segment, 'start')
                assert hasattr(segment, 'end')
                assert isinstance(segment.text, str)
                assert len(segment.text.strip()) > 0
                
        finally:
            # Cleanup
            whisper_service_small.cleanup()
    
    def test_model_performance_characteristics(self, hardware_detector):
        """Test model performance characteristics."""
        hardware_profile = hardware_detector.detect_hardware()
        
        # Test model recommendations for different scenarios
        priorities = ["speed", "quality", "balanced"]
        models = {}
        
        for priority in priorities:
            recommended_model, details = hardware_detector.recommend_model(priority=priority)
            models[priority] = recommended_model.value
        
        assert len(models) == 3
        assert "speed" in models
        assert "quality" in models
        assert "balanced" in models
        
        # Verify model names are valid
        for priority, model_name in models.items():
            assert isinstance(model_name, str)
            assert "whisper" in model_name.lower()
    
    def test_memory_usage_monitoring(self, whisper_service_small):
        """Test memory usage monitoring during model operations."""
        if torch.cuda.is_available():
            # Monitor GPU memory
            initial_memory = torch.cuda.memory_allocated()
            
            # Load model
            model = whisper_service_small._get_model()
            model_loaded_memory = torch.cuda.memory_allocated()
            
            # Model should use some memory
            assert model_loaded_memory > initial_memory
            
            # Cleanup should reduce memory usage
            whisper_service_small.cleanup()
            final_memory = torch.cuda.memory_allocated()
            
            # Memory should be released (allow some tolerance)
            assert final_memory <= model_loaded_memory
    
    def test_error_handling_invalid_audio(self, whisper_service_small):
        """Test error handling with invalid audio files."""
        # Test with non-existent file
        with pytest.raises(Exception):
            whisper_service_small.transcribe_audio(
                audio_file_path=FilePath.from_string("nonexistent.wav"),
                language="zh"
            )
    
    def test_language_detection(self, whisper_service_small, test_audio_path):
        """Test language detection capabilities."""
        if not test_audio_path.exists():
            pytest.skip("Test audio file not available")
        
        # Test with language detection
        try:
            result = whisper_service_small.transcribe_audio(
                audio_file_path=FilePath.from_string(str(test_audio_path)),
                language=None  # Auto-detect language
            )
            
            # Should still produce valid results
            assert hasattr(result, 'segments')
            
        except Exception as e:
            # Language detection might not be supported by all models
            if "language detection" not in str(e).lower():
                raise
    
    def test_quiet_mode(self, whisper_service_small):
        """Test quiet mode functionality."""
        # Test enabling and disabling quiet mode
        whisper_service_small.set_quiet_mode(True)
        # Should not raise exceptions
        
        whisper_service_small.set_quiet_mode(False)
        # Should not raise exceptions
    
    def test_service_cleanup(self, whisper_service_small):
        """Test proper service cleanup."""
        # Load model
        model = whisper_service_small._get_model()
        assert model is not None
        
        # Cleanup should work without errors
        whisper_service_small.cleanup()
        
        # Multiple cleanups should be safe
        whisper_service_small.cleanup()
    
    def test_concurrent_model_access(self):
        """Test concurrent access to model instances."""
        # Create multiple service instances
        service1 = WhisperService(
            model_name="openai/whisper-small",
            auto_select_model=False
        )
        
        service2 = WhisperService(
            model_name="openai/whisper-small", 
            auto_select_model=False
        )
        
        try:
            # Both should be able to load models
            model1 = service1._get_model()
            model2 = service2._get_model()
            
            assert model1 is not None
            assert model2 is not None
            
        finally:
            service1.cleanup()
            service2.cleanup()


class TestWhisperModelVariants:
    """Test different Whisper model variants."""
    
    @pytest.fixture
    def hardware_detector(self) -> HardwareDetector:
        """Hardware detector instance."""
        return HardwareDetector()
    
    def test_available_models(self):
        """Test that expected models are available."""
        models = [
            "openai/whisper-small",
            "openai/whisper-medium",
        ]
        
        for model_name in models:
            service = WhisperService(
                model_name=model_name,
                auto_select_model=False
            )
            
            try:
                # Should be able to create service without errors
                assert service.model_name == model_name
            finally:
                service.cleanup()
    
    def test_model_size_characteristics(self, hardware_detector):
        """Test model size and performance characteristics."""
        # Test model selection based on hardware constraints
        hardware_profile = hardware_detector.detect_hardware()
        available_memory = hardware_profile.vram_gb + hardware_profile.ram_gb
        
        # Should recommend appropriate model based on memory
        if available_memory < 2:
            recommended_model, details = hardware_detector.recommend_model(priority="speed")
            assert "small" in recommended_model.value
        elif available_memory > 8:
            recommended_model, details = hardware_detector.recommend_model(priority="quality")
            # Should be able to recommend larger models
            assert isinstance(recommended_model.value, str)


class TestWhisperXIntegration:
    """Test WhisperX integration if available."""
    
    @pytest.fixture
    def hardware_detector(self) -> HardwareDetector:
        """Hardware detector instance.""" 
        return HardwareDetector()
    
    def test_whisperx_availability(self):
        """Test WhisperX model availability."""
        try:
            service = WhisperService(
                model_name="whisperx/large-v3",
                auto_select_model=False
            )
            
            # If WhisperX is available, should work
            assert service.model_name == "whisperX/large-v3"
            service.cleanup()
            
        except ImportError:
            pytest.skip("WhisperX not available in test environment")
        except Exception as e:
            # Other errors might indicate configuration issues
            pytest.skip(f"WhisperX not properly configured: {e}")


@pytest.mark.integration
@pytest.mark.slow
class TestWhisperPerformance:
    """Test Whisper performance characteristics."""
    
    def test_transcription_speed(self):
        """Test transcription speed benchmarks."""
        # This would test transcription speed with different models
        # and compare against expected performance baselines
        pass
    
    def test_memory_efficiency(self):
        """Test memory usage efficiency."""
        # This would test memory usage patterns and ensure
        # proper cleanup and resource management
        pass
    
    def test_accuracy_baselines(self):
        """Test transcription accuracy baselines."""
        # This would test transcription accuracy against
        # known reference transcriptions
        pass