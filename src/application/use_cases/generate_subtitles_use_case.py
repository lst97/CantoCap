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
from ...domain.value_objects import Timestamp
from ...domain.entities import Subtitle
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
        # Enhanced dependencies
        video_preprocessing_service=None,
        media_chunking_service=None,
        gemini_flash_service=None,
        # Phase 2 dependencies (optional)
        speaker_diarization_service=None,
        music_detection_service=None,
        charset_conversion_service=None
    ):
        """Initialize use case with dependencies."""
        self.audio_repository = audio_repository
        self.transcription_repository = transcription_repository
        self.subtitle_repository = subtitle_repository
        self.media_file_validator = media_file_validator
        self.subtitle_formatting_service = subtitle_formatting_service
        
        # Enhanced services
        self.video_preprocessing_service = video_preprocessing_service
        self.media_chunking_service = media_chunking_service
        self.gemini_flash_service = gemini_flash_service
        
        # Phase 2 services (optional)
        self.speaker_diarization_service = speaker_diarization_service
        self.music_detection_service = music_detection_service
        self.charset_conversion_service = charset_conversion_service
    
    def execute(self, command: GenerateSubtitlesCommand) -> SubtitleGenerationResult:
        """
        Execute enhanced subtitle generation with Gemini Flash integration.
        
        Args:
            command: The generation command with parameters
            
        Returns:
            SubtitleGenerationResult: The result of the operation
        """
        start_time = time.time()
        temp_audio: Optional[AudioStream] = None
        compressed_video = None
        
        try:
            # Step 1: Validate input
            self._validate_command(command)
            
            # Step 2: Load and validate media file
            media_file = self._load_media_file(command)
            
            # Step 3: Gemini Flash Phase 1 - Speaker Identification (if enabled)
            detected_speaker_count = None
            if command.enable_speakers and self.gemini_flash_service:
                compressed_video, detected_speaker_count = self._gemini_speaker_identification(
                    media_file, command
                )
            
            # Step 4: Extract audio (existing logic)
            temp_audio = self._extract_audio(media_file)
            
            # Step 5: Load transcription model (existing logic)
            self._load_transcription_model(command.model_name)
            
            # Step 6: Transcribe audio (existing logic)
            transcription = self._transcribe_audio(temp_audio, command.language)
            
            # Step 7: Speaker diarization with auto-detected count
            speaker_diarization = None
            if command.enable_speakers and self.speaker_diarization_service:
                speaker_diarization = self._perform_enhanced_speaker_diarization(
                    temp_audio, detected_speaker_count
                )
            
            # Step 8: Music detection (existing logic)
            music_detection = None
            if command.enable_music_detection and self.music_detection_service:
                music_detection = self._perform_music_detection(transcription, temp_audio)
            
            # Step 9: Generate initial subtitle document
            subtitle_document = self._generate_subtitle_document(
                transcription,
                command.input_file_path,
                speaker_diarization=speaker_diarization,
                music_detection=music_detection
            )
            
            # Step 10: Gemini Flash Phase 2 - Transcription Refinement
            if command.enable_gemini_refinement and self.gemini_flash_service:
                subtitle_document = self._gemini_transcription_refinement(
                    subtitle_document, media_file, command
                )
            
            # Step 11: Apply charset conversion (existing logic)
            subtitle_document = self._apply_charset_conversion(subtitle_document, command)
            
            # Step 12: Save subtitle file (existing logic)
            output_path = self._save_subtitle_file(subtitle_document, command)
            
            # Step 13: Generate statistics (existing logic)
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
            # Cleanup
            if temp_audio:
                self.audio_repository.cleanup_temp_audio(temp_audio)
            if compressed_video and self.video_preprocessing_service:
                self.video_preprocessing_service.cleanup_temp_files()
            if self.media_chunking_service:
                self.media_chunking_service.cleanup_chunks()
    
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
    
    def _perform_speaker_diarization(self, audio_stream, command: GenerateSubtitlesCommand) -> Optional[any]:
        """Perform speaker diarization on audio stream (legacy method)."""
        # Redirect to enhanced method with None for speaker count (auto-detection)
        return self._perform_enhanced_speaker_diarization(audio_stream, None)
    
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
        
        enhanced_subtitles = []
        
        for subtitle in subtitle_document.get_subtitles():
            enhanced_content = subtitle.get_content()
            
            # Add speaker labels if diarization available
            if speaker_diarization:
                try:
                    speaker_id = self._get_dominant_speaker_for_subtitle(
                        speaker_diarization, 
                        subtitle.get_start_time(), 
                        subtitle.get_end_time()
                    )
                    if speaker_id:
                        enhanced_content = f"[{speaker_id}] {enhanced_content}"
                except Exception as e:
                    print(f"Warning: Failed to apply speaker label for subtitle {subtitle.get_index()}: {e}")
            
            # Add music labels if music detection available
            if music_detection:
                try:
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
                except Exception as e:
                    print(f"Warning: Failed to apply music labels for subtitle {subtitle.get_index()}: {e}")
            
            # Create enhanced subtitle
            enhanced_subtitle = Subtitle(
                index=subtitle.get_index(),
                start_time=subtitle.get_start_time(),
                end_time=subtitle.get_end_time(),
                content=enhanced_content
            )
            enhanced_subtitles.append(enhanced_subtitle)
        
        # Create new document with enhanced subtitles
        return SubtitleDocument.create(
            subtitles=enhanced_subtitles,
            source_file=subtitle_document.get_source_file(),
            language=subtitle_document.get_language()
        )
    
    def _get_dominant_speaker_for_subtitle(self, speaker_diarization, start_time, end_time):
        """Get the dominant speaker for a subtitle timespan."""
        try:
            # Get all speaker segments that overlap with this subtitle
            overlapping_segments = []
            
            for segment in speaker_diarization.segments:
                segment_start = segment.start_time.seconds
                segment_end = segment.end_time.seconds
                subtitle_start = start_time.seconds
                subtitle_end = end_time.seconds
                
                # Check for overlap
                if (segment_start < subtitle_end and segment_end > subtitle_start):
                    # Calculate overlap duration
                    overlap_start = max(segment_start, subtitle_start)
                    overlap_end = min(segment_end, subtitle_end)
                    overlap_duration = overlap_end - overlap_start
                    
                    overlapping_segments.append({
                        'speaker_id': segment.speaker_id,
                        'overlap_duration': overlap_duration
                    })
            
            if not overlapping_segments:
                return None
            
            # Find the speaker with the longest overlap
            dominant_speaker = max(overlapping_segments, key=lambda x: x['overlap_duration'])
            return dominant_speaker['speaker_id']
            
        except Exception as e:
            print(f"Warning: Error finding dominant speaker: {e}")
            return None
    
    def _apply_charset_conversion(
        self, 
        subtitle_document: SubtitleDocument, 
        command: GenerateSubtitlesCommand
    ) -> SubtitleDocument:
        """Apply charset conversion to subtitle document if needed."""
        
        try:
            # Check if charset conversion is needed
            target_charset = command.get_charset()
            
            # Skip conversion if target is traditional (default)
            if target_charset.is_traditional():
                return subtitle_document
            
            # Check if service is available
            if not self.charset_conversion_service:
                print(f"Warning: Charset conversion service not available, skipping conversion to {str(target_charset)}")
                return subtitle_document
            
            if not self.charset_conversion_service.is_available():
                print(f"Warning: OpenCC not installed, cannot convert to {str(target_charset)}. Install with: pip install opencc-python-reimplemented")
                return subtitle_document
            
            print(f"Converting subtitles to {str(target_charset)} Chinese...")
            
            # Apply charset conversion to all subtitles
            converted_subtitles = []
            conversion_count = 0
            
            for subtitle in subtitle_document.get_subtitles():
                original_content = subtitle.get_content()
                converted_content = self._convert_subtitle_content(
                    original_content, 
                    target_charset
                )
                
                # Track if conversion actually changed the content
                if converted_content != original_content:
                    conversion_count += 1
                
                converted_subtitle = Subtitle(
                    index=subtitle.get_index(),
                    start_time=subtitle.get_start_time(),
                    end_time=subtitle.get_end_time(),
                    content=converted_content
                )
                converted_subtitles.append(converted_subtitle)
            
            print(f"Charset conversion completed: {conversion_count} subtitles converted to {str(target_charset)}")
            
            # Create new document with converted subtitles
            return SubtitleDocument.create(
                subtitles=converted_subtitles,
                source_file=subtitle_document.get_source_file(),
                language=subtitle_document.get_language()
            )
            
        except Exception as e:
            # Log warning but don't fail the entire process
            print(f"Warning: Charset conversion failed: {e}")
            return subtitle_document
    
    def _convert_subtitle_content(self, content: str, target_charset) -> str:
        """Convert subtitle content while preserving speaker labels."""
        if not content.strip():
            return content
        
        # Extract speaker label if present
        speaker_label = ""
        text_to_convert = content
        
        if content.startswith('[SPEAKER_'):
            # Find the end of the speaker label
            end_bracket = content.find(']')
            if end_bracket != -1:
                speaker_label = content[:end_bracket + 1] + " "
                text_to_convert = content[end_bracket + 1:].strip()
        
        # Convert the text content (not the speaker label)
        try:
            if self.charset_conversion_service.needs_conversion(text_to_convert, target_charset):
                converted_text = self.charset_conversion_service.convert_text(text_to_convert, target_charset)
            else:
                converted_text = text_to_convert
        except Exception as e:
            print(f"Warning: Failed to convert text '{text_to_convert[:50]}...': {e}")
            converted_text = text_to_convert
        
        # Recombine speaker label with converted content
        return speaker_label + converted_text
    
    def _gemini_speaker_identification(
        self, 
        media_file: MediaFile, 
        command: GenerateSubtitlesCommand
    ) -> tuple:
        """Phase 1: Use Gemini Flash to identify speaker count."""
        if not self.gemini_flash_service:
            raise RuntimeError("Gemini Flash service not available")
        
        if not self.video_preprocessing_service:
            raise RuntimeError("Video preprocessing service not available")
        
        # Compress video for LLM analysis
        from ...infrastructure.services.video_preprocessing_service import CompressionSettings
        compression_settings = CompressionSettings(
            target_resolution=command.video_compression_quality
        )
        
        compressed_video = self.video_preprocessing_service.compress_for_llm_analysis(
            media_file.get_file_path(),
            compression_settings
        )
        
        # Identify speakers using Gemini Flash
        speaker_result = self.gemini_flash_service.identify_speaker_count(compressed_video)
        
        print(f"Gemini Flash identified {speaker_result.speaker_count} speakers "
              f"(confidence: {speaker_result.confidence:.2%})")
        
        return compressed_video, speaker_result.speaker_count
    
    def _perform_enhanced_speaker_diarization(
        self, 
        audio_stream: AudioStream, 
        detected_speaker_count: Optional[int]
    ):
        """Enhanced speaker diarization with auto-detected speaker count."""
        if not self.speaker_diarization_service:
            return None
        
        try:
            # Use detected count or default to None for auto-detection
            num_speakers = detected_speaker_count
            
            print(f"Performing speaker diarization with {num_speakers or 'auto-detected'} speakers...")
            
            diarization_result = self.speaker_diarization_service.diarize_audio_file(
                audio_file_path=audio_stream.get_file_path().path,
                num_speakers=num_speakers
            )
            
            diarization_entity = self.speaker_diarization_service.create_diarization_entity(
                diarization_result
            )
            
            actual_speakers = diarization_result.get('num_speakers', 0)
            print(f"Speaker diarization completed: {actual_speakers} speakers detected")
            
            return diarization_entity
            
        except Exception as e:
            print(f"Warning: Enhanced speaker diarization failed: {e}")
            return None
    
    def _gemini_transcription_refinement(
        self,
        subtitle_document: SubtitleDocument,
        media_file: MediaFile,
        command: GenerateSubtitlesCommand
    ) -> SubtitleDocument:
        """Phase 2: Use Gemini Flash to refine transcription quality."""
        if not self.gemini_flash_service:
            return subtitle_document
        
        try:
            # Check if chunking is needed
            if self.media_chunking_service and self.media_chunking_service.should_chunk_file(media_file.get_file_path()):
                return self._gemini_transcription_refinement_chunked(
                    subtitle_document, media_file, command
                )
            
            # Convert subtitle document to SRT format
            original_srt = self._convert_subtitle_document_to_srt(subtitle_document)
            
            # Refine using Gemini Flash
            refinement_result = self.gemini_flash_service.refine_transcription(
                video_path=media_file.get_file_path(),
                whisper_srt=original_srt,
                language_style=command.get_language_style()
            )
            
            print(f"Gemini Flash refinement completed: {refinement_result.changes_made} changes made")
            
            # Convert refined SRT back to subtitle document
            refined_subtitle_document = self._convert_srt_to_subtitle_document(
                refinement_result.refined_srt,
                subtitle_document.get_source_file(),
                subtitle_document.get_language()
            )
            
            return refined_subtitle_document
            
        except Exception as e:
            print(f"Warning: Gemini Flash refinement failed: {e}")
            return subtitle_document
    
    def _gemini_transcription_refinement_chunked(
        self,
        subtitle_document: SubtitleDocument,
        media_file: MediaFile,
        command: GenerateSubtitlesCommand
    ) -> SubtitleDocument:
        """Handle chunked transcription refinement for large files."""
        try:
            # Create chunks
            chunks = self.media_chunking_service.create_chunks(media_file.get_file_path())
            
            # Convert subtitle document to SRT
            original_srt = self._convert_subtitle_document_to_srt(subtitle_document)
            
            # Split SRT content by chunks (simplified approach)
            chunk_srt_contents = self._split_srt_by_chunks(original_srt, chunks)
            
            # Process each chunk
            chunk_results = []
            for i, (chunk_info, chunk_srt) in enumerate(zip(chunks, chunk_srt_contents)):
                try:
                    refinement_result = self.gemini_flash_service.refine_transcription(
                        video_path=chunk_info.file_path,
                        whisper_srt=chunk_srt,
                        language_style=command.get_language_style()
                    )
                    chunk_results.append((chunk_info, refinement_result.refined_srt))
                except Exception as e:
                    print(f"Warning: Chunk {i} refinement failed: {e}")
                    chunk_results.append((chunk_info, chunk_srt))  # Use original
            
            # Merge results
            original_duration = self.media_chunking_service._get_media_duration(media_file.get_file_path())
            merged_srt = self.media_chunking_service.merge_chunk_results(
                chunk_results, original_duration
            )
            
            # Convert back to subtitle document
            return self._convert_srt_to_subtitle_document(
                merged_srt,
                subtitle_document.get_source_file(),
                subtitle_document.get_language()
            )
            
        except Exception as e:
            print(f"Warning: Chunked Gemini refinement failed: {e}")
            return subtitle_document
    
    def _split_srt_by_chunks(self, srt_content: str, chunks) -> list:
        """Split SRT content by time chunks (simplified implementation)."""
        # For now, return equal splits - this could be enhanced with proper timing
        lines = srt_content.split('\n')
        chunk_count = len(chunks)
        lines_per_chunk = len(lines) // chunk_count
        
        chunk_contents = []
        for i in range(chunk_count):
            start_idx = i * lines_per_chunk
            end_idx = (i + 1) * lines_per_chunk if i < chunk_count - 1 else len(lines)
            chunk_content = '\n'.join(lines[start_idx:end_idx])
            chunk_contents.append(chunk_content)
        
        return chunk_contents
    
    def _convert_subtitle_document_to_srt(self, subtitle_document: SubtitleDocument) -> str:
        """Convert subtitle document to SRT format string."""
        srt_lines = []
        
        for subtitle in subtitle_document.get_subtitles():
            srt_lines.append(str(subtitle.get_index()))
            
            start_time = subtitle.get_start_time()
            end_time = subtitle.get_end_time()
            
            srt_lines.append(f"{self._format_timestamp(start_time)} --> {self._format_timestamp(end_time)}")
            srt_lines.append(subtitle.get_content())
            srt_lines.append("")  # Empty line separator
        
        return "\n".join(srt_lines)
    
    def _format_timestamp(self, timestamp) -> str:
        """Format timestamp for SRT format."""
        total_seconds = timestamp.seconds
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        milliseconds = int((total_seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    
    def _convert_srt_to_subtitle_document(
        self, 
        srt_content: str, 
        source_file: str, 
        language: str
    ) -> SubtitleDocument:
        """Convert SRT string back to subtitle document."""
        
        subtitles = []
        lines = srt_content.strip().split('\n')
        
        i = 0
        while i < len(lines):
            if lines[i].strip().isdigit():
                index = int(lines[i].strip())
                
                if i + 1 < len(lines) and '-->' in lines[i + 1]:
                    # Parse timestamp line
                    timestamp_line = lines[i + 1]
                    start_str, end_str = timestamp_line.split(' --> ')
                    
                    start_time = self._parse_timestamp(start_str.strip())
                    end_time = self._parse_timestamp(end_str.strip())
                    
                    # Collect content lines
                    content_lines = []
                    j = i + 2
                    while j < len(lines) and lines[j].strip():
                        content_lines.append(lines[j])
                        j += 1
                    
                    content = '\n'.join(content_lines)
                    
                    subtitle = Subtitle(
                        index=index,
                        start_time=start_time,
                        end_time=end_time,
                        content=content
                    )
                    subtitles.append(subtitle)
                    
                    i = j + 1  # Move past the empty line
                else:
                    i += 1
            else:
                i += 1
        
        return SubtitleDocument.create(
            subtitles=subtitles,
            source_file=source_file,
            language=language
        )
    
    def _parse_timestamp(self, timestamp_str: str) -> Timestamp:
        """Parse SRT timestamp string to Timestamp object."""
        # Format: HH:MM:SS,mmm
        time_part, ms_part = timestamp_str.split(',')
        hours, minutes, seconds = map(int, time_part.split(':'))
        milliseconds = int(ms_part)
        
        total_seconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
        return Timestamp.from_seconds(total_seconds)
    
