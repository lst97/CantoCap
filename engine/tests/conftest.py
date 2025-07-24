"""
Global test configuration and fixtures for CantoCap test suite.
"""

import pytest
import tempfile
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
from unittest.mock import MagicMock


# Test data fixtures
@pytest.fixture
def sample_video_path() -> Path:
    """Path to the test video file."""
    return Path(__file__).parent / "test-keep-talking.mp4"


@pytest.fixture
def temp_directory():
    """Create a temporary directory for test outputs."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def temp_output_file(temp_directory):
    """Temporary output file path."""
    return temp_directory / "test_output.srt"


@pytest.fixture
def ffmpeg_path() -> Optional[str]:
    """FFmpeg path for testing - skip tests if not available."""
    possible_paths = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/bin/ffmpeg", 
        "/usr/local/bin/ffmpeg",
        "ffmpeg"
    ]
    
    for path in possible_paths:
        if path == "ffmpeg":
            try:
                subprocess.run([path, "-version"], 
                             capture_output=True, check=True)
                return path
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        elif os.path.exists(path):
            return path
    
    return None


# Mock fixtures
@pytest.fixture
def mock_whisper_service():
    """Mock Whisper service for testing."""
    mock_service = MagicMock()
    mock_service.model_name = "openai/whisper-small"
    mock_service.transcribe_audio.return_value = MagicMock()
    mock_service.cleanup.return_value = None
    return mock_service


@pytest.fixture
def mock_hardware_detector():
    """Mock hardware detector for testing."""
    mock_detector = MagicMock()
    mock_detector.get_hardware_capabilities.return_value = {
        "device_type": "cpu",
        "available_memory_gb": 8.0,
        "cuda_available": False
    }
    mock_detector.get_optimal_model.return_value = "openai/whisper-small"
    return mock_detector


@pytest.fixture
def mock_container():
    """Mock DI container for testing."""
    mock = MagicMock()
    mock.get_whisper_service.return_value = MagicMock()
    mock.get_enhanced_generate_subtitles_use_case.return_value = MagicMock()
    mock.cleanup.return_value = None
    return mock


# Environment fixtures
@pytest.fixture
def test_environment():
    """Set up test environment variables."""
    original_env = os.environ.copy()
    
    # Set test environment variables
    os.environ["PYTEST_RUNNING"] = "1"
    os.environ.pop("GEMINI_API_KEY", None)  # Remove API keys in tests
    os.environ.pop("HF_TOKEN", None)
    
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def api_keys_available():
    """Check if API keys are available for testing."""
    return {
        "gemini": os.environ.get("GEMINI_API_KEY") is not None,
        "hf": os.environ.get("HF_TOKEN") is not None
    }


# Test markers
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "requires_ffmpeg: Tests that require FFmpeg to be installed"
    )
    config.addinivalue_line(
        "markers", "requires_api: Tests that require API keys"
    )
    config.addinivalue_line(
        "markers", "requires_gpu: Tests that require GPU acceleration"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on test names/paths."""
    for item in items:
        # Add markers based on test file location
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        elif "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        
        # Add slow marker for tests that might be slow
        if any(keyword in item.name for keyword in ["complete", "full", "processing", "workflow"]):
            item.add_marker(pytest.mark.slow)


# Skip conditions
def pytest_runtest_setup(item):
    """Skip tests based on conditions."""
    # Skip FFmpeg tests if FFmpeg not available
    if item.get_closest_marker("requires_ffmpeg"):
        ffmpeg_available = any(
            os.path.exists(path) if path != "ffmpeg" else 
            subprocess.run(["ffmpeg", "-version"], capture_output=True).returncode == 0
            for path in ["/opt/homebrew/bin/ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"]
        )
        if not ffmpeg_available:
            pytest.skip("FFmpeg not available")
    
    # Skip API tests if no API keys
    if item.get_closest_marker("requires_api"):
        if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("HF_TOKEN")):
            pytest.skip("API keys not available")
    
    # Skip GPU tests if no GPU
    if item.get_closest_marker("requires_gpu"):
        try:
            import torch
            if not torch.cuda.is_available():
                pytest.skip("GPU not available")
        except ImportError:
            pytest.skip("PyTorch not available")


# Utility fixtures
@pytest.fixture
def sample_subtitle_data():
    """Sample subtitle data for testing."""
    return [
        {"index": 1, "start": 0.0, "end": 2.0, "text": "Hello world"},
        {"index": 2, "start": 3.0, "end": 5.0, "text": "This is a test"},
        {"index": 3, "start": 6.0, "end": 8.0, "text": "Testing subtitles"}
    ]


@pytest.fixture
def sample_transcription_result():
    """Sample transcription result for testing."""
    mock_result = MagicMock()
    mock_result.segments = [
        MagicMock(start=0.0, end=2.0, text="Hello world"),
        MagicMock(start=3.0, end=5.0, text="This is a test"),
        MagicMock(start=6.0, end=8.0, text="Testing subtitles")
    ]
    mock_result.language = "zh"
    return mock_result


@pytest.fixture
def sample_command_args():
    """Sample command arguments for testing."""
    return {
        "input_file_path": "/path/to/test.mp4",
        "output_file_path": "/path/to/output.srt",
        "language": "zh",
        "model_name": "openai/whisper-small",
        "enable_speakers": False,
        "enable_written_style": False,
        "enable_music_detection": False,
        "charset": "traditional",
        "enable_gemini_refinement": False,
        "gemini_api_key": None,
        "video_compression_quality": "360p",
        "max_chunk_duration_minutes": 15,
        "terminology_config_path": None,
        "hf_token": None,
        "enable_translation": False,
        "translation_language": None
    }


# Performance testing fixtures
@pytest.fixture
def performance_timer():
    """Simple performance timer for test benchmarking."""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.time()
        
        def stop(self):
            self.end_time = time.time()
        
        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()


# Test data validation
@pytest.fixture(autouse=True)
def validate_test_data():
    """Validate that required test data files exist."""
    test_files = [
        Path(__file__).parent / "test-keep-talking.mp4"
    ]
    
    missing_files = [f for f in test_files if not f.exists()]
    if missing_files:
        pytest.skip(f"Test data files missing: {missing_files}")


# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_temp_files():
    """Clean up any temporary files created during tests."""
    yield
    
    # Clean up any test output files in the current directory
    test_dir = Path(__file__).parent
    for pattern in ["test_*.srt", "*_test.srt", "temp_*.srt"]:
        for file in test_dir.glob(pattern):
            try:
                file.unlink()
            except FileNotFoundError:
                pass


# Logging configuration for tests
@pytest.fixture(autouse=True)
def configure_test_logging():
    """Configure logging for tests to avoid spam."""
    import logging
    
    # Reduce logging noise during tests
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.ERROR)
    
    yield
    
    # Reset logging levels
    logging.getLogger("urllib3").setLevel(logging.INFO)
    logging.getLogger("requests").setLevel(logging.INFO)
    logging.getLogger("transformers").setLevel(logging.INFO)