"""Whisper-based transcription repository implementation."""

from typing import Optional, Dict, Any, Union, List

from ...domain.repositories import ITranscriptionRepository
from ...domain.entities import AudioStream, Transcription, TranscriptionChunk
from ..services import WhisperService

# Import WhisperXService conditionally
try:
    from ..services.whisperx_service import WhisperXService
    WhisperServiceType = Union[WhisperService, WhisperXService]
except ImportError:
    WhisperXService = None
    WhisperServiceType = WhisperService


class WhisperTranscriptionRepository(ITranscriptionRepository):
    """Transcription repository implementation using Whisper or WhisperX."""
    
    def __init__(self, whisper_service: WhisperServiceType):
        """
        Initialize with Whisper service.
        
        Args:
            whisper_service: Whisper or WhisperX service instance
        """
        self.whisper_service = whisper_service
    
    def load_model(self, model_name: Optional[str] = None, language: str = "zh") -> bool:
        """
        Load Whisper model.
        
        Args:
            model_name: Model name/path to load (e.g., "openai/whisper-large-v3", "whisperX/large-v3", or short names like "small")
            language: Language code for WhisperX (eliminates auto-detection warning)
            
        Returns:
            bool: True if model loaded successfully
        """
        # Handle different service types with different load_model signatures
        if hasattr(self.whisper_service, '__class__') and self.whisper_service.__class__.__name__ == 'WhisperXService':
            # WhisperXService: load_model() takes language parameter to avoid auto-detection
            # The model name was already set during service initialization
            return self.whisper_service.load_model(language=language)
        else:
            # Standard WhisperService: load_model() takes optional model_name parameter
            # Model name should already be in full format (validation enforces this)
            return self.whisper_service.load_model(model_name)
    
    def transcribe_audio_chunked(
        self,
        audio_chunks: List[AudioStream],
        language: str = "zh",
        return_timestamps: bool = True,
        chunk_offsets: Optional[List[float]] = None
    ) -> Transcription:
        """
        Transcribe multiple audio chunks and merge results.
        
        Args:
            audio_chunks: List of audio stream chunks
            language: Language code for transcription
            return_timestamps: Whether to return timestamps
            chunk_offsets: List of time offsets for each chunk (seconds)
            
        Returns:
            Merged transcription from all chunks
        """
        if not audio_chunks:
            raise ValueError("No audio chunks provided")
        
        chunk_results = []
        for i, audio_chunk in enumerate(audio_chunks):
            try:
                # Transcribe individual chunk
                chunk_transcription = self.transcribe_audio(
                    audio_stream=audio_chunk,
                    language=language,
                    return_timestamps=return_timestamps
                )
                
                # Adjust timestamps if offsets are provided
                if chunk_offsets and i < len(chunk_offsets):
                    offset = chunk_offsets[i]
                    adjusted_transcription = self._adjust_transcription_timestamps(
                        chunk_transcription, offset
                    )
                    chunk_results.append(adjusted_transcription)
                else:
                    chunk_results.append(chunk_transcription)
                    
            except Exception as e:
                print(f"Warning: Chunk {i} transcription failed: {e}")
                # Continue with remaining chunks
                continue
        
        if not chunk_results:
            raise RuntimeError("All audio chunk transcriptions failed")
        
        # Merge chunk transcriptions
        return self._merge_transcriptions(chunk_results)
    
    def _adjust_transcription_timestamps(self, transcription: Transcription, offset: float) -> Transcription:
        """
        Adjust all timestamps in a transcription by adding an offset.
        
        This method is used to position audio chunks correctly when merging
        multiple transcribed chunks into a single timeline.
        
        Args:
            transcription: Original transcription to adjust
            offset: Time offset in seconds to add to all timestamps
            
        Returns:
            New Transcription instance with adjusted timestamps
            
        Raises:
            ValueError: If offset is invalid or would create invalid timestamps
        """
        if not isinstance(transcription, Transcription):
            raise ValueError("transcription must be a Transcription instance")
        
        if not isinstance(offset, (int, float)):
            raise ValueError("offset must be a number")
        
        # Handle zero offset case - no adjustment needed
        if offset == 0.0:
            return transcription
        
        # Handle empty chunks case
        if not transcription.chunks:
            # Still need to create new instance for immutability
            return Transcription.create(
                chunks=[],
                full_text=transcription.full_text,
                language=transcription.language,
                total_duration=transcription.total_duration
            )
        
        try:
            # Create new chunks with adjusted timestamps
            adjusted_chunks = []
            for chunk in transcription.chunks:
                # Add offset to both start and end times
                # Timestamp.__add__ handles validation automatically
                new_start_time = chunk.start_time + offset
                new_end_time = chunk.end_time + offset
                
                # Create new TranscriptionChunk with adjusted timestamps
                adjusted_chunk = TranscriptionChunk(
                    text=chunk.text,
                    start_time=new_start_time,
                    end_time=new_end_time,
                    confidence=chunk.confidence
                )
                adjusted_chunks.append(adjusted_chunk)
            
            # Calculate adjusted total duration if present
            adjusted_total_duration = transcription.total_duration
            if adjusted_total_duration is not None and offset != 0.0:
                # Total duration doesn't change with offset, only positioning does
                # Keep the original duration
                pass
            
            # Create new Transcription instance with adjusted chunks
            return Transcription.create(
                chunks=adjusted_chunks,
                full_text=transcription.full_text,  # Text content unchanged
                language=transcription.language,    # Language unchanged
                total_duration=adjusted_total_duration
            )
            
        except ValueError as e:
            # Re-raise with more context
            raise ValueError(f"Failed to adjust timestamps with offset {offset}s: {e}")
    
    def _merge_transcriptions(self, transcriptions: List[Transcription]) -> Transcription:
        """
        Merge multiple transcriptions into a single chronologically ordered transcription.
        
        This method combines multiple transcription results (typically from audio chunks)
        into a single coherent transcription with proper temporal ordering.
        
        Args:
            transcriptions: List of transcriptions to merge
            
        Returns:
            New Transcription instance containing all chunks in chronological order
            
        Raises:
            ValueError: If transcriptions list is empty or contains invalid data
        """
        if not transcriptions:
            raise ValueError("No transcriptions to merge")
        
        if not isinstance(transcriptions, list):
            raise ValueError("transcriptions must be a list")
        
        # Validate all items are Transcription instances
        for i, transcription in enumerate(transcriptions):
            if not isinstance(transcription, Transcription):
                raise ValueError(f"Item at index {i} is not a Transcription instance")
        
        # Handle single transcription case - return as-is for efficiency
        if len(transcriptions) == 1:
            return transcriptions[0]
        
        # Collect all chunks from all transcriptions
        all_chunks = []
        for transcription in transcriptions:
            all_chunks.extend(transcription.chunks)
        
        # Handle case where no chunks exist across all transcriptions
        if not all_chunks:
            # Use first transcription's metadata as base
            first_transcription = transcriptions[0]
            return Transcription.create(
                chunks=[],
                full_text="",
                language=first_transcription.language,
                total_duration=0.0
            )
        
        # Sort chunks chronologically by start_time
        # This ensures the merged transcription maintains chronological order
        try:
            sorted_chunks = sorted(all_chunks, key=lambda chunk: chunk.start_time.seconds)
        except Exception as e:
            raise ValueError(f"Failed to sort chunks chronologically: {e}")
        
        # Combine full_text from all transcriptions
        combined_texts = []
        for transcription in transcriptions:
            text = transcription.full_text.strip()
            if text:  # Only add non-empty text
                combined_texts.append(text)
        
        # Join texts with appropriate separator
        if combined_texts:
            merged_full_text = " ".join(combined_texts)
        else:
            # Fallback: generate from chunks if no full text available
            merged_full_text = " ".join(chunk.text.strip() for chunk in sorted_chunks if chunk.text.strip())
        
        # Calculate merged total duration
        merged_total_duration = None
        
        # Method 1: Sum of individual durations (if all are available)
        individual_durations = [
            t.total_duration for t in transcriptions 
            if t.total_duration is not None
        ]
        if len(individual_durations) == len(transcriptions):
            # All transcriptions have duration info
            merged_total_duration = sum(individual_durations)
        else:
            # Method 2: Calculate from first and last chunk timestamps
            if sorted_chunks:
                first_chunk = sorted_chunks[0]
                last_chunk = sorted_chunks[-1]
                merged_total_duration = last_chunk.end_time.seconds - first_chunk.start_time.seconds
        
        # Use first transcription's language as the merged language
        # This assumes all chunks are in the same language, which is typical
        merged_language = transcriptions[0].language
        
        # Create and return the merged transcription
        try:
            merged_transcription = Transcription.create(
                chunks=sorted_chunks,
                full_text=merged_full_text,
                language=merged_language,
                total_duration=merged_total_duration
            )
            return merged_transcription
            
        except ValueError as e:
            # Re-raise with more context
            raise ValueError(f"Failed to create merged transcription: {e}")
    
    def transcribe_audio(
        self,
        audio_stream: AudioStream,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Transcription:
        """
        Transcribe audio stream using Whisper.
        
        Args:
            audio_stream: Audio to transcribe
            language: Target language code
            return_timestamps: Whether to include timestamps
            
        Returns:
            Transcription: Transcription result
            
        Raises:
            RuntimeError: If transcription fails
        """
        # Ensure audio stream is validated
        if not audio_stream.is_validated():
            audio_stream.validate()
        
        # Check Whisper compatibility
        if not audio_stream.is_whisper_compatible():
            raise ValueError(
                f"Audio format not compatible with Whisper: {audio_stream.get_format()}"
            )
        
        try:
            # Transcribe using Whisper service
            whisper_result = self.whisper_service.transcribe_audio_file(
                audio_file_path=audio_stream.get_file_path().path,
                language=language,
                return_timestamps=return_timestamps
            )
            
            # Add duration to result if available
            if audio_stream.get_duration_seconds() is not None:
                whisper_result["duration"] = audio_stream.get_duration_seconds()
            
            # Create and return Transcription entity
            transcription = self.whisper_service.create_transcription_entity(whisper_result)
            
            # Validate transcription has content
            if not transcription.chunks:
                raise ValueError("Transcription produced no results")
            
            return transcription
            
        except Exception as e:
            raise RuntimeError(f"Audio transcription failed: {e}")
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded.
        
        Returns:
            bool: True if model is ready
        """
        return self.whisper_service.is_model_loaded()
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information.
        
        Returns:
            dict: Model information
        """
        return self.whisper_service.get_model_info()
    
    def estimate_transcription_time(self, audio_stream: AudioStream) -> Optional[float]:
        """
        Estimate transcription processing time.
        
        Args:
            audio_stream: Audio to estimate for
            
        Returns:
            float: Estimated time in seconds, None if unknown
        """
        duration = audio_stream.get_duration_seconds()
        if duration is None:
            return None
        
        return self.whisper_service.estimate_processing_time(duration)
    
    def get_supported_languages(self) -> list[str]:
        """
        Get supported language codes.
        
        Returns:
            list: Supported language codes
        """
        return self.whisper_service.get_supported_languages()