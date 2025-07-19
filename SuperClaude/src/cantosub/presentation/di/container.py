"""Dependency injection container for CantoSub."""

import os
from pathlib import Path
from typing import Optional

from ...domain import SubtitleFormattingService
from ...application import GenerateSubtitlesUseCase, MediaFileValidator
from ...infrastructure import (
    FFmpegAudioRepository,
    WhisperTranscriptionRepository,
    FileSubtitleRepository,
    FFmpegService,
    WhisperService,
    SpeakerDiarizationService,
    LLMServiceFactory,
    MusicDetectionService,
    CharsetConversionService
)


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
    
    def get_ffmpeg_service(self) -> FFmpegService:
        """Get FFmpeg service instance."""
        if self._ffmpeg_service is None:
            # Look for local ffmpeg.exe first
            ffmpeg_path = self._find_local_ffmpeg()
            self._ffmpeg_service = FFmpegService(ffmpeg_path=ffmpeg_path)
        return self._ffmpeg_service
    
    def _find_local_ffmpeg(self) -> Optional[str]:
        """Find local ffmpeg executable in project lib directory."""
        # Get current working directory
        current_dir = Path.cwd()
        
        # Check for local ffmpeg.exe in lib directory
        local_ffmpeg = current_dir / "lib" / "ffmpeg.exe"
        
        if local_ffmpeg.exists():
            return str(local_ffmpeg.absolute())
        
        # Fallback to system PATH
        return None
    
    def get_whisper_service(self) -> WhisperService:
        """Get Whisper service instance."""
        if self._whisper_service is None:
            self._whisper_service = WhisperService()
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
        """Get generate subtitles use case instance."""
        if self._generate_subtitles_use_case is None:
            self._generate_subtitles_use_case = GenerateSubtitlesUseCase(
                audio_repository=self.get_audio_repository(),
                transcription_repository=self.get_transcription_repository(),
                subtitle_repository=self.get_subtitle_repository(),
                media_file_validator=self.get_media_file_validator(),
                subtitle_formatting_service=self.get_subtitle_formatting_service()
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
    
    def cleanup(self) -> None:
        """Clean up resources."""
        if self._whisper_service is not None:
            self._whisper_service.cleanup()
        
        # Cleanup Phase 2 services
        if self._speaker_diarization_service is not None:
            self._speaker_diarization_service.cleanup()
        if self._music_detection_service is not None:
            self._music_detection_service.cleanup()
        if self._charset_conversion_service is not None:
            self._charset_conversion_service.cleanup()