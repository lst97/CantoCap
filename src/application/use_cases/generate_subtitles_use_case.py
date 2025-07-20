"""Use case for generating subtitles from media files."""

from dataclasses import dataclass
from typing import Optional, Dict, Any
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
        subtitle_formatting_service: SubtitleFormattingService,
        # Phase 2 dependencies (optional)
        speaker_diarization_service=None,
        music_detection_service=None
    ):
        """Initialize use case with dependencies."""
        self.audio_repository = audio_repository
        self.transcription_repository = transcription_repository
        self.subtitle_repository = subtitle_repository
        self.media_file_validator = media_file_validator
        self.subtitle_formatting_service = subtitle_formatting_service
        
        # Phase 2 services (optional)
        self.speaker_diarization_service = speaker_diarization_service
        self.music_detection_service = music_detection_service
    
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
            
            # Step 6: Phase 2 features (optional)
            speaker_diarization = None
            music_detection = None
            
            if command.has_phase2_features():
                # Speaker diarization if enabled
                if command.enable_speakers and self.speaker_diarization_service:
                    speaker_diarization = self._perform_speaker_diarization(temp_audio)
                
                # Music detection if enabled
                if command.enable_music_detection and self.music_detection_service:
                    music_detection = self._perform_music_detection(transcription, temp_audio)
            
            # Step 7: Generate subtitle document with Phase 2 enhancements
            subtitle_document = self._generate_subtitle_document(
                transcription, 
                command.input_file_path,
                speaker_diarization=speaker_diarization,
                music_detection=music_detection
            )
            
            # Step 8: Save subtitle file
            output_path = self._save_subtitle_file(subtitle_document, command)
            
            # Step 9: Generate statistics
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
    
    def _load_transcription_model(self, model_name: Optional[str]) -> None:
        """Load the transcription model."""
        if not self.transcription_repository.is_model_loaded():
            success = self.transcription_repository.load_model(model_name)
            if not success:
                model_desc = model_name if model_name else "auto-selected model"
                raise RuntimeError(f"Failed to load transcription model: {model_desc}")
    
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
        source_file_path: str,
        speaker_diarization=None,
        music_detection=None
    ) -> SubtitleDocument:
        """Generate optimized subtitle document with Phase 2 enhancements."""
        subtitle_document = self.subtitle_formatting_service.create_subtitle_document_from_transcription(
            transcription=transcription,
            source_file_path=source_file_path
        )
        
        # Apply Phase 2 enhancements if available
        if speaker_diarization or music_detection:
            subtitle_document = self._apply_phase2_enhancements(
                subtitle_document, 
                speaker_diarization, 
                music_detection
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
    
    def _perform_speaker_diarization(self, audio_stream) -> Optional[any]:
        """Perform speaker diarization on audio stream."""
        try:
            if not self.speaker_diarization_service:
                return None
            
            # Check if service is ready
            if not self.speaker_diarization_service.is_model_loaded():
                # Try to load the model
                success = self.speaker_diarization_service.load_model()
                if not success:
                    return None
            
            # Perform diarization
            diarization_result = self.speaker_diarization_service.diarize_audio_file(
                audio_file_path=audio_stream.get_file_path().path
            )
            
            # Create domain entity
            return self.speaker_diarization_service.create_diarization_entity(diarization_result)
            
        except Exception as e:
            # Log error but don't fail the entire process
            print(f"Warning: Speaker diarization failed: {e}")
            return None
    
    def _perform_music_detection(self, transcription, audio_stream) -> Optional[any]:
        """Perform music detection using Whisper transcription analysis."""
        try:
            if not self.music_detection_service:
                return None
            
            # Get raw whisper result from transcription
            # We'll need to get this from the transcription repository
            raw_whisper_result = self._get_raw_whisper_result(transcription)
            
            # Get audio duration
            audio_duration = audio_stream.get_duration_seconds() if audio_stream else None
            
            # Perform music detection
            detection_result = self.music_detection_service.detect_music_from_whisper_result(
                whisper_result=raw_whisper_result,
                audio_duration=audio_duration
            )
            
            # Create domain entity
            return self.music_detection_service.create_music_detection_entity(detection_result)
            
        except Exception as e:
            # Log error but don't fail the entire process
            print(f"Warning: Music detection failed: {e}")
            return None
    
    def _get_raw_whisper_result(self, transcription) -> Dict[str, Any]:
        """Extract raw Whisper result from transcription entity."""
        # Convert transcription back to whisper result format
        chunks = []
        for chunk in transcription.chunks:
            chunks.append({
                "text": chunk.text,
                "timestamp": [chunk.start_time.seconds, chunk.end_time.seconds]
            })
        
        return {
            "text": " ".join(chunk.text for chunk in transcription.chunks),
            "chunks": chunks,
            "language": transcription.language
        }
    
    def _apply_phase2_enhancements(
        self, 
        subtitle_document, 
        speaker_diarization=None, 
        music_detection=None
    ):
        """Apply Phase 2 enhancements to subtitle document."""
        from ...domain.entities import Subtitle
        
        enhanced_subtitles = []
        
        for subtitle in subtitle_document.get_subtitles():
            enhanced_content = subtitle.get_content()
            
            # Add speaker labels if diarization available
            if speaker_diarization:
                speaker_id = speaker_diarization.get_speaker_for_timespan(
                    subtitle.get_start_time(), 
                    subtitle.get_end_time()
                )
                if speaker_id:
                    enhanced_content = f"[{speaker_id}] {enhanced_content}"
            
            # Add music labels if music detection available
            if music_detection:
                music_segments = music_detection.get_music_for_timespan(
                    subtitle.get_start_time(), 
                    subtitle.get_end_time()
                )
                if music_segments:
                    # Add music labels for overlapping segments
                    music_labels = []
                    for segment in music_segments:
                        music_labels.append(segment.get_music_label())
                    
                    if music_labels:
                        # Add unique music labels
                        unique_labels = list(set(music_labels))
                        label_text = " ".join(unique_labels)
                        enhanced_content = f"{label_text} {enhanced_content}"
            
            # Create enhanced subtitle
            enhanced_subtitle = Subtitle(
                index=subtitle.get_index(),
                start_time=subtitle.get_start_time(),
                end_time=subtitle.get_end_time(),
                content=enhanced_content
            )
            enhanced_subtitles.append(enhanced_subtitle)
        
        # Create new document with enhanced subtitles
        from ...domain.entities import SubtitleDocument
        return SubtitleDocument.create(
            subtitles=enhanced_subtitles,
            source_file=subtitle_document.get_source_file(),
            language=subtitle_document.get_language()
        )