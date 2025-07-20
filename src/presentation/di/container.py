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
    # UnifiedLLMService - removed, using Gemini Flash service directly
)

# Import Phase 2 services conditionally
try:
    from ...infrastructure import (
        WhisperService,
        SpeakerDiarizationService,
        # LLMServiceFactory - removed, using Gemini Flash service directly
        MusicDetectionService
    )
    _PHASE2_AVAILABLE = True
except ImportError:
    WhisperService = None
    SpeakerDiarizationService = None
    # LLMServiceFactory = None - removed, using Gemini Flash service directly
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
        
        # Enhanced services
        self._configuration_service = None
        self._video_preprocessing_service = None
        self._media_chunking_service = None
        self._gemini_flash_service = None
        
        # Phase 2 services
        self._speaker_diarization_service: Optional[SpeakerDiarizationService] = None
        self._music_detection_service: Optional[MusicDetectionService] = None
        self._charset_conversion_service: Optional[CharsetConversionService] = None
        
        # Performance services
        self._parallel_audio_service: Optional[ParallelAudioService] = None
    
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
        # Check if we need to create a new service with different parameters
        if (self._whisper_service is None or 
            getattr(self, '_whisper_model_name', None) != model_name or
            getattr(self, '_whisper_priority', None) != priority):
            
            # Store parameters for comparison
            self._whisper_model_name = model_name
            self._whisper_priority = priority
            
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
            charset_service = None
            
            if _PHASE2_AVAILABLE:
                try:
                    speaker_service = self.get_speaker_diarization_service()
                    music_service = self.get_music_detection_service()
                except Exception:
                    # Phase 2 services optional - continue without them
                    pass
            
            # Always try to get charset conversion service
            try:
                charset_service = self.get_charset_conversion_service()
            except Exception:
                # Charset service optional - continue without it
                pass
            
            self._generate_subtitles_use_case = GenerateSubtitlesUseCase(
                audio_repository=self.get_audio_repository(),
                transcription_repository=self.get_transcription_repository(),
                subtitle_repository=self.get_subtitle_repository(),
                media_file_validator=self.get_media_file_validator(),
                subtitle_formatting_service=self.get_subtitle_formatting_service(),
                # Phase 2 services (optional)
                speaker_diarization_service=speaker_service,
                music_detection_service=music_service,
                charset_conversion_service=charset_service
            )
        return self._generate_subtitles_use_case
    
    def get_speaker_diarization_service(self, hf_token: Optional[str] = None) -> SpeakerDiarizationService:
        """Get speaker diarization service instance."""
        if self._speaker_diarization_service is None:
            self._speaker_diarization_service = SpeakerDiarizationService()
            if not self._speaker_diarization_service.load_model(hf_token=hf_token):
                raise RuntimeError("Failed to load speaker diarization model.")
        return self._speaker_diarization_service
    
    # LLM service factory removed - using Gemini Flash service directly
    
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
    
    # LLM services removed - using Gemini Flash service directly
    # Use get_gemini_flash_service() for AI-powered transcription refinement
    
    # Enhanced services for Gemini Flash integration
    
    def get_configuration_service(self):
        """Get configuration service instance."""
        if self._configuration_service is None:
            from ...infrastructure.services.configuration_service import ConfigurationService
            self._configuration_service = ConfigurationService()
        return self._configuration_service
    
    def get_video_preprocessing_service(self):
        """Get video preprocessing service instance."""
        if self._video_preprocessing_service is None:
            from ...infrastructure.services.video_preprocessing_service import VideoPreprocessingService
            self._video_preprocessing_service = VideoPreprocessingService()
        return self._video_preprocessing_service
    
    def get_media_chunking_service(self, max_chunk_duration_minutes: int = 15):
        """Get media chunking service instance."""
        if self._media_chunking_service is None:
            from ...infrastructure.services.media_chunking_service import MediaChunkingService, ChunkingStrategy
            strategy = ChunkingStrategy(max_chunk_duration_seconds=max_chunk_duration_minutes * 60)
            self._media_chunking_service = MediaChunkingService(strategy)
        return self._media_chunking_service
    
    def get_gemini_flash_service(self, api_key: str):
        """Get Gemini Flash service instance."""
        if self._gemini_flash_service is None:
            from ...infrastructure.services.gemini_flash_service import GeminiFlashService
            if GeminiFlashService.is_gemini_available():
                self._gemini_flash_service = GeminiFlashService(api_key)
            else:
                raise ImportError("google-generativeai package not installed")
        return self._gemini_flash_service
    
    def get_enhanced_generate_subtitles_use_case(self, gemini_api_key: Optional[str] = None):
        """Get enhanced generate subtitles use case with Gemini Flash integration."""
        # Get enhanced services
        video_preprocessing_service = None
        media_chunking_service = None
        gemini_flash_service = None
        
        try:
            video_preprocessing_service = self.get_video_preprocessing_service()
            media_chunking_service = self.get_media_chunking_service()
            
            if gemini_api_key:
                gemini_flash_service = self.get_gemini_flash_service(gemini_api_key)
        except Exception as e:
            print(f"Warning: Enhanced services not available: {e}")
        
        # Get existing Phase 2 services
        speaker_service = None
        music_service = None
        charset_service = None
        
        if _PHASE2_AVAILABLE:
            try:
                speaker_service = self.get_speaker_diarization_service()
                music_service = self.get_music_detection_service()
            except Exception:
                pass
        
        try:
            charset_service = self.get_charset_conversion_service()
        except Exception:
            pass
        
        return GenerateSubtitlesUseCase(
            audio_repository=self.get_audio_repository(),
            transcription_repository=self.get_transcription_repository(),
            subtitle_repository=self.get_subtitle_repository(),
            media_file_validator=self.get_media_file_validator(),
            subtitle_formatting_service=self.get_subtitle_formatting_service(),
            # Enhanced services
            video_preprocessing_service=video_preprocessing_service,
            media_chunking_service=media_chunking_service,
            gemini_flash_service=gemini_flash_service,
            # Phase 2 services (optional)
            speaker_diarization_service=speaker_service,
            music_detection_service=music_service,
            charset_conversion_service=charset_service
        )
    
    def cleanup(self) -> None:
        """Clean up resources."""
        if self._whisper_service is not None:
            self._whisper_service.cleanup()
        
        # Cleanup enhanced services
        if self._video_preprocessing_service is not None:
            self._video_preprocessing_service.cleanup_temp_files()
        
        if self._media_chunking_service is not None:
            self._media_chunking_service.cleanup_chunks()
        
        # Note: Gemini Flash service doesn't need cleanup
        # Note: Configuration service doesn't need cleanup
        
        # Cleanup Phase 2 services
        if self._speaker_diarization_service is not None:
            self._speaker_diarization_service.cleanup()
        # Note: Music detection service doesn't need cleanup (no model loading)
        if self._charset_conversion_service is not None:
            self._charset_conversion_service.cleanup()