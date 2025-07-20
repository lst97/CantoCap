"""Dependency injection container for CantoSub."""

import os
import platform
from pathlib import Path
from typing import Optional

from ...domain import SubtitleFormattingService
from ...application import GenerateSubtitlesUseCase, MediaFileValidator
from ...infrastructure import (
    FFmpegAudioRepository,
    WhisperTranscriptionRepository,
    FileSubtitleRepository,
    FFmpegService,
    CharsetConversionService,
    ParallelAudioService,
    UnifiedLLMService
)

# Import Phase 2 services conditionally
try:
    from ...infrastructure import (
        WhisperService,
        SpeakerDiarizationService,
        LLMServiceFactory,
        MusicDetectionService
    )
    _PHASE2_AVAILABLE = True
except ImportError:
    WhisperService = None
    SpeakerDiarizationService = None
    LLMServiceFactory = None
    MusicDetectionService = None
    _PHASE2_AVAILABLE = False


class Container:
    """Dependency injection container for CantoSub application."""
    
    def __init__(self):
        """Initialize container with lazy-loaded singletons."""
        self._ffmpeg_service: Optional[FFmpegService] = None
        self._whisper_service: Optional[WhisperService] = None
        self._audio_repository: Optional[FFmpegAudioRepository] = None
        self._transcription_repository: Optional[WhisperTranscriptionRepository] = None
        self._subtitle_repository: Optional[FileSubtitleRepository] = None
        self._media_file_validator: Optional[MediaFileValidator] = None
        self._subtitle_formatting_service: Optional[SubtitleFormattingService] = None
        self._generate_subtitles_use_case: Optional[GenerateSubtitlesUseCase] = None
        
        # Phase 2 services
        self._speaker_diarization_service: Optional[SpeakerDiarizationService] = None
        self._llm_service: Optional[LLMServiceFactory] = None
        self._music_detection_service: Optional[MusicDetectionService] = None
        self._charset_conversion_service: Optional[CharsetConversionService] = None
        
        # Performance services
        self._parallel_audio_service: Optional[ParallelAudioService] = None
        self._llm_service: Optional[UnifiedLLMService] = None
    
    def get_ffmpeg_service(self) -> FFmpegService:
        """Get FFmpeg service instance."""
        if self._ffmpeg_service is None:
            # Look for local ffmpeg.exe first
            ffmpeg_path = self._find_local_ffmpeg()
            
            self._ffmpeg_service = FFmpegService(ffmpeg_path=ffmpeg_path)
        return self._ffmpeg_service
    
    def _find_local_ffmpeg(self) -> Optional[str]:
        """Find local ffmpeg executable in project lib directory."""
        # Get project root directory (assuming container.py is in src/cantosub/presentation/di)
        project_root = Path(__file__).resolve().parent.parent.parent.parent

        # Define potential paths for ffmpeg
        ffmpeg_paths = []
        if platform.system() == "Windows":
            # Windows-specific path provided by user
            ffmpeg_paths.append(project_root / "lib" / "ffmpeg" / "bin" / "win" / "ffmpeg.exe")
        
        # Check each path for existence
        for ffmpeg_path in ffmpeg_paths:
            if ffmpeg_path.exists():
                return str(ffmpeg_path.absolute())

        # Fallback to system PATH
        return None
    
    def get_whisper_service(self, model_name: Optional[str] = None, priority: str = "balanced") -> WhisperService:
        """
        Get Whisper service instance with intelligent model selection.
        
        Args:
            model_name: Specific model to use (overrides auto-selection)
            priority: "speed", "quality", or "balanced" for auto-selection
        """
        if self._whisper_service is None:
            # Enable auto-selection by default, allow manual override
            auto_select = model_name is None
            self._whisper_service = WhisperService(
                model_name=model_name,
                auto_select_model=auto_select,
                priority=priority
            )
        return self._whisper_service
    
    def get_audio_repository(self) -> FFmpegAudioRepository:
        """Get audio repository instance."""
        if self._audio_repository is None:
            self._audio_repository = FFmpegAudioRepository(
                ffmpeg_service=self.get_ffmpeg_service()
            )
        return self._audio_repository
    
    def get_transcription_repository(self) -> WhisperTranscriptionRepository:
        """Get transcription repository instance."""
        if self._transcription_repository is None:
            self._transcription_repository = WhisperTranscriptionRepository(
                whisper_service=self.get_whisper_service()
            )
        return self._transcription_repository
    
    def get_subtitle_repository(self) -> FileSubtitleRepository:
        """Get subtitle repository instance."""
        if self._subtitle_repository is None:
            self._subtitle_repository = FileSubtitleRepository(
                create_backups=True
            )
        return self._subtitle_repository
    
    def get_media_file_validator(self) -> MediaFileValidator:
        """Get media file validator instance."""
        if self._media_file_validator is None:
            self._media_file_validator = MediaFileValidator(
                max_file_size_gb=10.0,
                min_file_size_mb=0.1,
                check_permissions=True
            )
        return self._media_file_validator
    
    def get_subtitle_formatting_service(self) -> SubtitleFormattingService:
        """Get subtitle formatting service instance."""
        if self._subtitle_formatting_service is None:
            self._subtitle_formatting_service = SubtitleFormattingService(
                max_chars_per_line=40,
                max_lines=2,
                min_duration=0.5,
                max_duration=10.0,
                min_gap=0.1
            )
        return self._subtitle_formatting_service
    
    def get_generate_subtitles_use_case(self) -> GenerateSubtitlesUseCase:
        """Get generate subtitles use case instance with Phase 2 services."""
        if self._generate_subtitles_use_case is None:
            # Get Phase 2 services if available
            speaker_service = None
            music_service = None
            
            if _PHASE2_AVAILABLE:
                try:
                    speaker_service = self.get_speaker_diarization_service()
                    music_service = self.get_music_detection_service()
                except Exception:
                    # Phase 2 services optional - continue without them
                    pass
            
            self._generate_subtitles_use_case = GenerateSubtitlesUseCase(
                audio_repository=self.get_audio_repository(),
                transcription_repository=self.get_transcription_repository(),
                subtitle_repository=self.get_subtitle_repository(),
                media_file_validator=self.get_media_file_validator(),
                subtitle_formatting_service=self.get_subtitle_formatting_service(),
                # Phase 2 services (optional)
                speaker_diarization_service=speaker_service,
                music_detection_service=music_service
            )
        return self._generate_subtitles_use_case
    
    def get_speaker_diarization_service(self) -> SpeakerDiarizationService:
        """Get speaker diarization service instance."""
        if self._speaker_diarization_service is None:
            self._speaker_diarization_service = SpeakerDiarizationService()
        return self._speaker_diarization_service
    
    def get_llm_service_factory(self) -> LLMServiceFactory:
        """Get LLM service factory instance."""
        if self._llm_service is None:
            self._llm_service = LLMServiceFactory()
        return self._llm_service
    
    def get_music_detection_service(self) -> MusicDetectionService:
        """Get music detection service instance."""
        if self._music_detection_service is None:
            self._music_detection_service = MusicDetectionService()
        return self._music_detection_service
    
    def get_charset_conversion_service(self) -> CharsetConversionService:
        """Get charset conversion service instance."""
        if self._charset_conversion_service is None:
            self._charset_conversion_service = CharsetConversionService()
        return self._charset_conversion_service
    
    def get_parallel_audio_service(self) -> ParallelAudioService:
        """Get parallel audio service instance."""
        if self._parallel_audio_service is None:
            whisper_service = self.get_whisper_service() if _PHASE2_AVAILABLE and WhisperService else None
            if whisper_service is None:
                raise RuntimeError("Whisper service not available for parallel audio processing")
            self._parallel_audio_service = ParallelAudioService(whisper_service)
        return self._parallel_audio_service
    
    def get_llm_service(self) -> UnifiedLLMService:
        """Get unified LLM service instance with all features."""
        if self._llm_service is None:
            # Default to OpenAI with all enhanced features enabled
            self._llm_service = UnifiedLLMService(
                provider="openai",
                max_chinese_words=20,
                max_retries=3,
                chunk_size=200,
                enable_validation=True,
                enable_chunking=True
            )
        return self._llm_service
    
    def get_enhanced_llm_service(self) -> UnifiedLLMService:
        """Get enhanced LLM service instance (backward compatibility)."""
        return self.get_llm_service()
    
    def get_llm_service(self, provider: str = "openai", enable_features: bool = False) -> UnifiedLLMService:
        """Get basic LLM service instance."""
        return UnifiedLLMService(
            provider=provider,
            enable_validation=enable_features,
            enable_chunking=enable_features
        )
    
    def cleanup(self) -> None:
        """Clean up resources."""
        if self._whisper_service is not None:
            self._whisper_service.cleanup()
        
        # Cleanup Phase 2 services
        if self._speaker_diarization_service is not None:
            self._speaker_diarization_service.cleanup()
        # Note: Music detection service doesn't need cleanup (no model loading)
        if self._charset_conversion_service is not None:
            self._charset_conversion_service.cleanup()