"""Dependency injection container for CantoCap."""

import os
import platform
from pathlib import Path
from typing import Optional

from ...domain import SubtitleFormattingService, DualLanguageSubtitleService
from ...application import GenerateSubtitlesUseCase, MediaFileValidator
from ...application.services.subtitle_validation_service import SubtitleValidationService
from ...application.services.terminology_config_service import TerminologyConfigService
from ...infrastructure import (
    FFmpegAudioRepository,
    WhisperTranscriptionRepository,
    FileSubtitleRepository,
    FFmpegService,
    CharsetConversionService,
    ParallelAudioService,
    # UnifiedLLMService - removed, using Gemini Flash service directly
)

# Import services conditionally
try:
    from ...infrastructure import (
        WhisperService,
        SpeakerDiarizationService,
        MusicDetectionService
    )
    from ...infrastructure.services.whisperx_service import WhisperXService
    from ...infrastructure.services.speaker_count_service import GeminiSpeakerCountService
    from ...infrastructure.services.transcription_refinement_service import GeminiTranscriptionRefinementService
    from ...infrastructure.services.llm_service import LLMServiceFactory, LLMProvider, LLMConfig
    from ...infrastructure.services.video_compression_service import VideoCompressionService
    from ...infrastructure.services.subtitle_translation_service import SubtitleTranslationService
    _PHASE2_AVAILABLE = True
except ImportError:
    WhisperService = None
    WhisperXService = None
    SpeakerDiarizationService = None
    MusicDetectionService = None
    GeminiSpeakerCountService = None
    GeminiTranscriptionRefinementService = None
    LLMServiceFactory = None
    VideoCompressionService = None
    SubtitleTranslationService = None
    _PHASE2_AVAILABLE = False


class Container:
    """Dependency injection container for CantoCap application."""
    
    def __init__(self, ffmpeg_path: Optional[str] = None):
        """Initialize container with lazy-loaded singletons.
        
        Args:
            ffmpeg_path: Optional custom path to FFmpeg executable
        """
        self._custom_ffmpeg_path = ffmpeg_path
        self._ffmpeg_service: Optional[FFmpegService] = None
        self._whisper_service: Optional[WhisperService] = None
        self._whisperx_service: Optional[WhisperXService] = None
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
        self._subtitle_validation_service = None
        self._video_compression_service = None
        self._terminology_config_service = None
        
        # New separate services
        self._speaker_count_service = None
        self._transcription_refinement_service = None
        self._llm_service = None
        
        # Translation services
        self._subtitle_translation_service = None
        self._dual_language_subtitle_service: Optional[DualLanguageSubtitleService] = None
        
        # Enhancement services
        self._speaker_diarization_service: Optional[SpeakerDiarizationService] = None
        self._music_detection_service: Optional[MusicDetectionService] = None
        self._charset_conversion_service: Optional[CharsetConversionService] = None
        
        # Performance services
        self._parallel_audio_service: Optional[ParallelAudioService] = None
        
        # Cache keys for dynamic service creation
        self._transcription_repo_cache_key: Optional[str] = None
        self._use_case_cache_key: Optional[str] = None
    
    def get_ffmpeg_service(self) -> FFmpegService:
        """Get FFmpeg service instance."""
        if self._ffmpeg_service is None:
            # Use custom path if provided, otherwise look for local ffmpeg
            if self._custom_ffmpeg_path:
                ffmpeg_path = self._custom_ffmpeg_path
            else:
                ffmpeg_path = self._find_local_ffmpeg()
            
            self._ffmpeg_service = FFmpegService(ffmpeg_path=ffmpeg_path)
        return self._ffmpeg_service
    
    def _find_local_ffmpeg(self) -> Optional[str]:
        """Find local ffmpeg executable in project lib directory."""
        # Get project root directory (assuming container.py is in src/cantocap/presentation/di)
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
    
    def get_whisper_service(self, model_name: Optional[str] = None, priority: str = "balanced"):
        """
        Get Whisper service instance with intelligent model selection.
        Supports both standard Whisper and WhisperX models.
        
        Args:
            model_name: Specific model to use (e.g., "openai/whisper-large-v3", "whisperX/large-v3")
            priority: "speed", "quality", or "balanced" for auto-selection
            
        Returns:
            WhisperService or WhisperXService depending on model_name
        """
        # Determine if we should use WhisperX
        use_whisperx = model_name and model_name.startswith("whisperX/")
        
        if use_whisperx:
            # Extract the actual model name from whisperX/model-name format
            actual_model = model_name.replace("whisperX/", "")
            
            # Check if we need to create a new WhisperX service with different parameters
            if (self._whisperx_service is None or 
                getattr(self, '_whisperx_model_name', None) != actual_model):
                
                if not WhisperXService:
                    raise RuntimeError("WhisperX service not available. Install with: pip install whisperx")
                
                # Store parameters for comparison
                self._whisperx_model_name = actual_model
                
                self._whisperx_service = WhisperXService(
                    model_name=actual_model
                )
            return self._whisperx_service
        else:
            # Use standard Whisper service
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
    
    def get_transcription_repository(self, model_name: Optional[str] = None, priority: str = "balanced") -> WhisperTranscriptionRepository:
        """Get transcription repository instance."""
        # Create a unique key for caching based on model parameters
        cache_key = f"{model_name}_{priority}"
        
        if (self._transcription_repository is None or 
            getattr(self, '_transcription_repo_cache_key', None) != cache_key):
            
            self._transcription_repo_cache_key = cache_key
            self._transcription_repository = WhisperTranscriptionRepository(
                whisper_service=self.get_whisper_service(model_name=model_name, priority=priority)
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
    
    def get_generate_subtitles_use_case(self, model_name: Optional[str] = None, priority: str = "balanced") -> GenerateSubtitlesUseCase:
        """Get generate subtitles use case instance with enhanced services."""
        # Create a unique key for caching based on model parameters
        cache_key = f"{model_name}_{priority}"
        
        if (self._generate_subtitles_use_case is None or 
            getattr(self, '_use_case_cache_key', None) != cache_key):
            # Get enhanced services if available
            speaker_service = None
            music_service = None
            charset_service = None
            
            if _PHASE2_AVAILABLE:
                try:
                    speaker_service = self.get_speaker_diarization_service()
                    music_service = self.get_music_detection_service()
                except Exception:
                    # Enhanced services optional - continue without them
                    pass
            
            # Always try to get charset conversion service
            try:
                charset_service = self.get_charset_conversion_service()
            except Exception:
                # Charset service optional - continue without it
                pass
            
            self._use_case_cache_key = cache_key
            self._generate_subtitles_use_case = GenerateSubtitlesUseCase(
                audio_repository=self.get_audio_repository(),
                transcription_repository=self.get_transcription_repository(model_name=model_name, priority=priority),
                subtitle_repository=self.get_subtitle_repository(),
                media_file_validator=self.get_media_file_validator(),
                subtitle_formatting_service=self.get_subtitle_formatting_service(),
                # Enhanced services (optional)
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
    
    
    # Enhanced services
    
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
    
    
    def get_subtitle_validation_service(self) -> SubtitleValidationService:
        """Get subtitle validation service instance."""
        if self._subtitle_validation_service is None:
            self._subtitle_validation_service = SubtitleValidationService()
        return self._subtitle_validation_service
    
    def get_video_compression_service(self) -> VideoCompressionService:
        """Get video compression service instance."""
        if self._video_compression_service is None:
            if VideoCompressionService:
                self._video_compression_service = VideoCompressionService()
            else:
                raise RuntimeError("Video compression service not available")
        return self._video_compression_service
    
    def get_terminology_config_service(self, config_path: str) -> TerminologyConfigService:
        """Get terminology configuration service instance."""
        if self._terminology_config_service is None:
            from pathlib import Path
            config_file_path = Path(config_path)
            if not config_file_path.exists():
                raise FileNotFoundError(f"Terminology config file not found: {config_path}")
            
            self._terminology_config_service = TerminologyConfigService(config_file_path)
        return self._terminology_config_service
    
    def get_subtitle_translation_service(self, api_key: str):
        """Get subtitle translation service instance."""
        if self._subtitle_translation_service is None:
            if SubtitleTranslationService and SubtitleTranslationService.is_gemini_available():
                self._subtitle_translation_service = SubtitleTranslationService(api_key)
            else:
                raise ImportError("google-generativeai package not installed")
        return self._subtitle_translation_service
    
    def get_dual_language_subtitle_service(self) -> DualLanguageSubtitleService:
        """Get dual-language subtitle service instance."""
        if self._dual_language_subtitle_service is None:
            self._dual_language_subtitle_service = DualLanguageSubtitleService()
        return self._dual_language_subtitle_service
    
    def get_speaker_count_service(self, api_key: str):
        """Get speaker count service instance."""
        if self._speaker_count_service is None:
            if GeminiSpeakerCountService and GeminiSpeakerCountService.is_gemini_available():
                self._speaker_count_service = GeminiSpeakerCountService(api_key)
            else:
                raise ImportError("google-generativeai package not installed")
        return self._speaker_count_service
    
    def get_transcription_refinement_service(self, api_key: str, terminology_config_path: Optional[str] = None):
        """Get transcription refinement service instance."""
        if self._transcription_refinement_service is None:
            if GeminiTranscriptionRefinementService and GeminiTranscriptionRefinementService.is_gemini_available():
                # Get terminology service if config path provided
                terminology_service = None
                if terminology_config_path:
                    terminology_service = self.get_terminology_config_service(terminology_config_path)
                
                self._transcription_refinement_service = GeminiTranscriptionRefinementService(api_key, terminology_service)
            else:
                raise ImportError("google-generativeai package not installed")
        return self._transcription_refinement_service
    
    def get_llm_service(self, provider: str, api_key: str, config: Optional[dict] = None):
        """Get LLM service instance."""
        if self._llm_service is None:
            if LLMServiceFactory:
                from ...infrastructure.services.llm_service import LLMProvider, LLMConfig
                
                # Convert string provider to enum
                if provider.lower() == "gemini":
                    provider_enum = LLMProvider.GEMINI
                elif provider.lower() == "openai":
                    provider_enum = LLMProvider.OPENAI
                else:
                    raise ValueError(f"Unsupported LLM provider: {provider}")
                
                # Create config if provided
                llm_config = None
                if config:
                    llm_config = LLMConfig(**config)
                
                self._llm_service = LLMServiceFactory.create_service(provider_enum, api_key, llm_config)
            else:
                raise ImportError("LLM service dependencies not available")
        return self._llm_service
    
    def get_enhanced_generate_subtitles_use_case(self, model_name: Optional[str] = None, priority: str = "balanced", gemini_api_key: Optional[str] = None, terminology_config_path: Optional[str] = None):
        """Get enhanced generate subtitles use case with Gemini Flash integration."""
        # Get enhanced services
        video_preprocessing_service = None
        media_chunking_service = None
        speaker_count_service = None
        transcription_refinement_service = None
        subtitle_validation_service = None
        video_compression_service = None
        
        try:
            video_preprocessing_service = self.get_video_preprocessing_service()
            media_chunking_service = self.get_media_chunking_service()
            subtitle_validation_service = self.get_subtitle_validation_service()
            video_compression_service = self.get_video_compression_service()
            
            if gemini_api_key:
                speaker_count_service = self.get_speaker_count_service(gemini_api_key)
                transcription_refinement_service = self.get_transcription_refinement_service(gemini_api_key, terminology_config_path)
        except Exception as e:
            print(f"Warning: Enhanced services not available: {e}")
        
        # Get translation services  
        translation_service = None
        dual_language_service = None
        
        if _PHASE2_AVAILABLE and gemini_api_key:
            try:
                translation_service = self.get_subtitle_translation_service(gemini_api_key)
                dual_language_service = self.get_dual_language_subtitle_service()
            except Exception as e:
                print(f"Warning: Translation services not available: {e}")
        
        # Get existing enhanced services
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
            transcription_repository=self.get_transcription_repository(model_name=model_name, priority=priority),
            subtitle_repository=self.get_subtitle_repository(),
            media_file_validator=self.get_media_file_validator(),
            subtitle_formatting_service=self.get_subtitle_formatting_service(),
            # Enhanced services
            video_preprocessing_service=video_preprocessing_service,
            media_chunking_service=media_chunking_service,
            speaker_count_service=speaker_count_service,
            transcription_refinement_service=transcription_refinement_service,
            subtitle_validation_service=subtitle_validation_service,
            video_compression_service=video_compression_service,
            # Translation services
            subtitle_translation_service=translation_service,
            dual_language_subtitle_service=dual_language_service,
            # Enahnced services (optional)
            speaker_diarization_service=speaker_service,
            music_detection_service=music_service,
            charset_conversion_service=charset_service
        )
    
    def cleanup(self) -> None:
        """Clean up resources."""
        if self._whisper_service is not None:
            self._whisper_service.cleanup()
        
        if self._whisperx_service is not None:
            self._whisperx_service.cleanup()
        
        # Cleanup enhanced services
        if self._video_preprocessing_service is not None:
            self._video_preprocessing_service.cleanup_temp_files()
        
        if self._media_chunking_service is not None:
            self._media_chunking_service.cleanup_chunks()
        
        # Note: Configuration service doesn't need cleanup
        
        # Cleanup enhanced services
        if self._speaker_diarization_service is not None:
            self._speaker_diarization_service.cleanup()
        # Note: Music detection service doesn't need cleanup (no model loading)
        if self._charset_conversion_service is not None:
            self._charset_conversion_service.cleanup()