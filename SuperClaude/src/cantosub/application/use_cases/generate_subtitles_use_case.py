"""Use case for generating subtitles from media files."""

from dataclasses import dataclass
from typing import Optional
import time

from ...domain import (
    MediaFile,
    AudioStream,
    AudioFormat,
    SubtitleDocument,
    SubtitleFormattingService,
    IAudioRepository,
    ITranscriptionRepository,
    ISubtitleRepository
)
from ..commands import GenerateSubtitlesCommand
from ..services import MediaFileValidator


@dataclass
class SubtitleGenerationResult:
    """Result of subtitle generation operation."""
    
    success: bool
    output_file_path: Optional[str] = None
    subtitle_count: int = 0
    processing_time_seconds: float = 0.0
    error_message: Optional[str] = None
    statistics: Optional[dict] = None
    
    @classmethod
    def success_result(
        cls,
        output_file_path: str,
        subtitle_count: int,
        processing_time: float,
        statistics: Optional[dict] = None
    ) -> "SubtitleGenerationResult":
        """Create success result."""
        return cls(
            success=True,
            output_file_path=output_file_path,
            subtitle_count=subtitle_count,
            processing_time_seconds=processing_time,
            statistics=statistics
        )
    
    @classmethod
    def failure_result(
        cls,
        error_message: str,
        processing_time: float = 0.0
    ) -> "SubtitleGenerationResult":
        """Create failure result."""
        return cls(
            success=False,
            error_message=error_message,
            processing_time_seconds=processing_time
        )


class GenerateSubtitlesUseCase:
    """Use case for generating subtitles from media files."""
    
    def __init__(
        self,
        audio_repository: IAudioRepository,
        transcription_repository: ITranscriptionRepository,
        subtitle_repository: ISubtitleRepository,
        media_file_validator: MediaFileValidator,
        subtitle_formatting_service: SubtitleFormattingService
    ):
        """Initialize use case with dependencies."""
        self.audio_repository = audio_repository
        self.transcription_repository = transcription_repository
        self.subtitle_repository = subtitle_repository
        self.media_file_validator = media_file_validator
        self.subtitle_formatting_service = subtitle_formatting_service
    
    def execute(self, command: GenerateSubtitlesCommand) -> SubtitleGenerationResult:
        """
        Execute subtitle generation use case.
        
        Args:
            command: The generation command with parameters
            
        Returns:
            SubtitleGenerationResult: The result of the operation
        """
        start_time = time.time()
        temp_audio: Optional[AudioStream] = None
        
        try:
            # Step 1: Validate input
            self._validate_command(command)
            
            # Step 2: Load and validate media file
            media_file = self._load_media_file(command)
            
            # Step 3: Extract audio
            temp_audio = self._extract_audio(media_file)
            
            # Step 4: Load transcription model
            self._load_transcription_model(command.model_name)
            
            # Step 5: Transcribe audio
            transcription = self._transcribe_audio(temp_audio, command.language)
            
            # Step 6: Generate subtitle document
            subtitle_document = self._generate_subtitle_document(
                transcription, 
                command.input_file_path
            )
            
            # Step 7: Save subtitle file
            output_path = self._save_subtitle_file(subtitle_document, command)
            
            # Step 8: Generate statistics
            statistics = self._generate_statistics(subtitle_document)
            
            processing_time = time.time() - start_time
            
            return SubtitleGenerationResult.success_result(
                output_file_path=output_path.path,
                subtitle_count=subtitle_document.get_subtitle_count(),
                processing_time=processing_time,
                statistics=statistics
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            return SubtitleGenerationResult.failure_result(
                error_message=str(e),
                processing_time=processing_time
            )
        
        finally:
            # Cleanup temporary audio file
            if temp_audio:
                self.audio_repository.cleanup_temp_audio(temp_audio)
    
    def _validate_command(self, command: GenerateSubtitlesCommand) -> None:
        """Validate the command parameters."""
        command.validate_paths()
    
    def _load_media_file(self, command: GenerateSubtitlesCommand) -> MediaFile:
        """Load and validate the media file."""
        media_file = MediaFile.from_path(command.input_file_path)
        
        # Use validator for comprehensive validation
        validation_result = self.media_file_validator.validate(media_file)
        if not validation_result.is_valid:
            raise ValueError(f"Media file validation failed: {validation_result.error_message}")
        
        return media_file
    
    def _extract_audio(self, media_file: MediaFile) -> AudioStream:
        """Extract audio from media file."""
        # Use Whisper-compatible format for Phase 1
        target_format = AudioFormat.WHISPER_FORMAT
        
        audio_stream = self.audio_repository.extract_audio_from_media(
            media_file=media_file,
            target_format=target_format
        )
        
        # Validate extracted audio
        if not self.audio_repository.validate_audio_format(audio_stream):
            raise ValueError("Extracted audio format validation failed")
        
        # Get and set duration
        duration = self.audio_repository.get_audio_duration(audio_stream)
        audio_stream.set_duration_seconds(duration)
        
        return audio_stream
    
    def _load_transcription_model(self, model_name: str) -> None:
        """Load the transcription model."""
        if not self.transcription_repository.is_model_loaded():
            success = self.transcription_repository.load_model(model_name)
            if not success:
                raise RuntimeError(f"Failed to load transcription model: {model_name}")
    
    def _transcribe_audio(self, audio_stream: AudioStream, language: str):
        """Transcribe audio to text with timestamps."""
        transcription = self.transcription_repository.transcribe_audio(
            audio_stream=audio_stream,
            language=language,
            return_timestamps=True
        )
        
        if not transcription.chunks:
            raise ValueError("Transcription produced no results")
        
        return transcription
    
    def _generate_subtitle_document(
        self, 
        transcription, 
        source_file_path: str
    ) -> SubtitleDocument:
        """Generate optimized subtitle document."""
        subtitle_document = self.subtitle_formatting_service.create_subtitle_document_from_transcription(
            transcription=transcription,
            source_file_path=source_file_path
        )
        
        # Validate generated document
        quality_issues = subtitle_document.get_quality_issues()
        if quality_issues:
            # Log warnings but don't fail - these are recommendations
            pass
        
        return subtitle_document
    
    def _save_subtitle_file(
        self, 
        subtitle_document: SubtitleDocument, 
        command: GenerateSubtitlesCommand
    ):
        """Save subtitle document to SRT file."""
        output_path = command.get_effective_output_path()
        
        # Create backup if file exists
        if output_path.exists():
            backup_path = self.subtitle_repository.backup_existing_file(output_path)
            if backup_path:
                # Log backup creation
                pass
        
        # Save the subtitle file
        success = self.subtitle_repository.save_subtitle_document(
            subtitle_document=subtitle_document,
            output_path=output_path
        )
        
        if not success:
            raise RuntimeError(f"Failed to save subtitle file: {output_path.path}")
        
        return output_path
    
    def _generate_statistics(self, subtitle_document: SubtitleDocument) -> dict:
        """Generate processing statistics."""
        basic_stats = subtitle_document.get_statistics()
        formatting_stats = self.subtitle_formatting_service.get_formatting_statistics(subtitle_document)
        
        return {
            **basic_stats,
            "formatting": formatting_stats
        }