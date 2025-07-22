"""Parallel audio processing service for enhanced performance."""

import os
import tempfile
import asyncio
import concurrent.futures
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import subprocess

# Import WhisperService conditionally
try:
    from .whisper_service import WhisperService
    _WHISPER_AVAILABLE = True
except ImportError:
    WhisperService = None
    _WHISPER_AVAILABLE = False
from ...domain.entities import Transcription
from ...domain.value_objects import Timestamp


@dataclass
class AudioChunk:
    """Represents a chunk of audio for parallel processing."""
    file_path: str
    start_time: float
    end_time: float
    duration: float
    chunk_index: int


@dataclass
class ProcessingResult:
    """Result from processing an audio chunk."""
    chunk_index: int
    transcription: Dict[str, Any]
    start_time: float
    end_time: float
    processing_time: float
    error: Optional[str] = None


class ParallelAudioService:
    """Service for parallel audio processing with chunking."""
    
    def __init__(
        self,
        whisper_service: Optional['WhisperService'] = None,
        chunk_duration: float = 60.0,  # 1 minute chunks
        max_workers: Optional[int] = None,
        overlap_duration: float = 2.0  # 2 seconds overlap for continuity
    ):
        """
        Initialize parallel audio service.
        
        Args:
            whisper_service: Whisper service instance
            chunk_duration: Duration of each chunk in seconds
            max_workers: Maximum number of parallel workers
            overlap_duration: Overlap between chunks for continuity
        """
        if not _WHISPER_AVAILABLE:
            raise RuntimeError("WhisperService not available. Install torch and transformers.")
        
        self.whisper_service = whisper_service
        self.chunk_duration = chunk_duration
        self.overlap_duration = overlap_duration
        self.max_workers = max_workers or min(4, os.cpu_count())
        
        # Adjust workers based on GPU availability if whisper service is available
        if self.whisper_service:
            try:
                device_info = self.whisper_service.get_device_info()
                if device_info["device"] == "cuda":
                    # For GPU, limit workers to avoid memory issues
                    self.max_workers = min(2, self.max_workers)
                elif device_info["device"] == "mps":
                    # Apple Silicon - single worker for now
                    self.max_workers = 1
            except:
                # Fallback if device info not available
                pass
    
    def process_audio_file(
        self,
        audio_file_path: str,
        language: str = "zh",
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Process audio file using parallel chunking.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code for transcription
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict containing merged transcription results
        """
        # Get audio duration first
        duration = self._get_audio_duration(audio_file_path)
        
        # Create chunks
        chunks = self._create_audio_chunks(audio_file_path, duration)
        
        if progress_callback:
            progress_callback(f"Processing {len(chunks)} chunks in parallel")
        
        # Process chunks in parallel
        results = self._process_chunks_parallel(chunks, language, progress_callback)
        
        # Merge results
        merged_result = self._merge_transcription_results(results, duration)
        
        if progress_callback:
            progress_callback("Parallel processing complete")
        
        return merged_result
    
    def _get_audio_duration(self, audio_file_path: str) -> float:
        """Get audio file duration using FFmpeg."""
        try:
            cmd = [
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "csv=p=0", audio_file_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return float(result.stdout.strip())
        except:
            # Fallback: estimate from file size (very rough)
            file_size = os.path.getsize(audio_file_path)
            # Assume ~1MB per minute for compressed audio
            return file_size / (1024 * 1024) * 60
    
    def _create_audio_chunks(self, audio_file_path: str, duration: float) -> List[AudioChunk]:
        """Create audio chunks for parallel processing."""
        chunks = []
        chunk_index = 0
        current_time = 0.0
        
        while current_time < duration:
            end_time = min(current_time + self.chunk_duration, duration)
            
            # Add overlap except for the first chunk
            start_with_overlap = max(0, current_time - self.overlap_duration) if chunk_index > 0 else current_time
            
            # Create chunk file path
            chunk_path = self._extract_audio_chunk(
                audio_file_path, 
                start_with_overlap, 
                end_time, 
                chunk_index
            )
            
            if chunk_path:
                chunks.append(AudioChunk(
                    file_path=chunk_path,
                    start_time=current_time,  # Logical start time (without overlap)
                    end_time=end_time,
                    duration=end_time - current_time,
                    chunk_index=chunk_index
                ))
            
            current_time = end_time
            chunk_index += 1
        
        return chunks
    
    def _extract_audio_chunk(
        self, 
        source_file: str, 
        start_time: float, 
        end_time: float, 
        chunk_index: int
    ) -> Optional[str]:
        """Extract audio chunk using FFmpeg."""
        try:
            # Create temporary file for chunk
            temp_dir = tempfile.gettempdir()
            chunk_filename = f"chunk_{chunk_index}_{start_time:.2f}_{end_time:.2f}.wav"
            chunk_path = os.path.join(temp_dir, chunk_filename)
            
            # Use FFmpeg to extract chunk
            cmd = [
                "ffmpeg", "-y", "-i", source_file,
                "-ss", str(start_time),
                "-t", str(end_time - start_time),
                "-ac", "1",  # Mono
                "-ar", "16000",  # 16kHz sample rate for Whisper
                chunk_path
            ]
            
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=60
            )
            
            if result.returncode == 0 and os.path.exists(chunk_path):
                return chunk_path
            else:
                print(f"Failed to extract chunk {chunk_index}: {result.stderr}")
                return None
                
        except Exception as e:
            print(f"Error extracting chunk {chunk_index}: {e}")
            return None
    
    def _process_chunks_parallel(
        self,
        chunks: List[AudioChunk],
        language: str,
        progress_callback: Optional[callable] = None
    ) -> List[ProcessingResult]:
        """Process audio chunks in parallel."""
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all chunks for processing
            future_to_chunk = {
                executor.submit(self._process_single_chunk, chunk, language): chunk
                for chunk in chunks
            }
            
            # Collect results as they complete
            completed = 0
            for future in concurrent.futures.as_completed(future_to_chunk):
                chunk = future_to_chunk[future]
                try:
                    result = future.result()
                    results.append(result)
                    completed += 1
                    
                    if progress_callback:
                        progress = (completed / len(chunks)) * 100
                        progress_callback(f"Processed chunk {completed}/{len(chunks)} ({progress:.1f}%)")
                        
                except Exception as e:
                    error_result = ProcessingResult(
                        chunk_index=chunk.chunk_index,
                        transcription={},
                        start_time=chunk.start_time,
                        end_time=chunk.end_time,
                        processing_time=0.0,
                        error=str(e)
                    )
                    results.append(error_result)
                finally:
                    # Clean up chunk file
                    if os.path.exists(chunk.file_path):
                        try:
                            os.remove(chunk.file_path)
                        except:
                            pass
        
        # Sort results by chunk index
        results.sort(key=lambda r: r.chunk_index)
        return results
    
    def _process_single_chunk(self, chunk: AudioChunk, language: str) -> ProcessingResult:
        """Process a single audio chunk."""
        import time
        start_time = time.time()
        
        try:
            # Process with Whisper
            result = self.whisper_service.transcribe_audio(chunk.file_path, language)
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                chunk_index=chunk.chunk_index,
                transcription=result,
                start_time=chunk.start_time,
                end_time=chunk.end_time,
                processing_time=processing_time
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            return ProcessingResult(
                chunk_index=chunk.chunk_index,
                transcription={},
                start_time=chunk.start_time,
                end_time=chunk.end_time,
                processing_time=processing_time,
                error=str(e)
            )
    
    def _merge_transcription_results(
        self, 
        results: List[ProcessingResult], 
        total_duration: float
    ) -> Dict[str, Any]:
        """Merge parallel transcription results."""
        merged_text = ""
        merged_chunks = []
        
        for result in results:
            if result.error:
                print(f"Chunk {result.chunk_index} failed: {result.error}")
                continue
            
            transcription = result.transcription
            
            # Handle overlap by trimming overlapping text from previous chunks
            chunk_text = transcription.get("text", "").strip()
            if chunk_text:
                # Remove overlap from beginning if not the first chunk
                if result.chunk_index > 0 and len(merged_text) > 0:
                    # Simple overlap handling - could be improved with better text matching
                    chunk_text = self._handle_text_overlap(merged_text, chunk_text)
                
                merged_text += " " + chunk_text if merged_text else chunk_text
            
            # Adjust timestamps for chunks
            if "chunks" in transcription:
                for chunk_data in transcription["chunks"]:
                    adjusted_chunk = chunk_data.copy()
                    if "timestamp" in adjusted_chunk:
                        timestamp = adjusted_chunk["timestamp"]
                        if isinstance(timestamp, list) and len(timestamp) >= 2:
                            # Validate timestamp values before arithmetic
                            start_val = timestamp[0] if timestamp[0] is not None else 0.0
                            end_val = timestamp[1] if timestamp[1] is not None else 0.0
                            
                            # Adjust timestamps by adding chunk start time
                            adjusted_chunk["timestamp"] = [
                                float(start_val) + result.start_time,
                                float(end_val) + result.start_time
                            ]
                    merged_chunks.append(adjusted_chunk)
        
        return {
            "text": merged_text.strip(),
            "chunks": merged_chunks,
            "language": results[0].transcription.get("language", "zh") if results else "zh",
            "total_duration": total_duration,
            "processing_stats": {
                "total_chunks": len(results),
                "successful_chunks": len([r for r in results if not r.error]),
                "failed_chunks": len([r for r in results if r.error]),
                "total_processing_time": sum(r.processing_time for r in results),
                "max_workers": self.max_workers
            }
        }
    
    def _handle_text_overlap(self, previous_text: str, current_text: str) -> str:
        """Handle overlapping text between chunks."""
        # Simple implementation - remove common endings/beginnings
        # This could be improved with more sophisticated text matching
        
        if not previous_text or not current_text:
            return current_text
        
        # Look for overlapping phrases (last few words of previous vs first few of current)
        prev_words = previous_text.split()
        curr_words = current_text.split()
        
        # Check for overlap in last 5 words
        for i in range(1, min(6, len(prev_words), len(curr_words))):
            if prev_words[-i:] == curr_words[:i]:
                # Found overlap, remove it from current text
                return " ".join(curr_words[i:])
        
        return current_text
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        stats = {
            "max_workers": self.max_workers,
            "chunk_duration": self.chunk_duration,
            "overlap_duration": self.overlap_duration,
            "whisper_available": _WHISPER_AVAILABLE
        }
        
        if self.whisper_service:
            try:
                device_info = self.whisper_service.get_device_info()
                stats.update({
                    "device": device_info["device"],
                    "available_devices": device_info["available_devices"]
                })
            except:
                stats["device"] = "unknown"
                stats["available_devices"] = []
        else:
            stats["device"] = "none"
            stats["available_devices"] = []
        
        return stats