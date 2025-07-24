"""WhisperX service for enhanced speech-to-text transcription with speaker diarization."""

import torch
import os
import gc
import platform
from pathlib import Path
from typing import Optional, Dict, Any, List, Callable
import warnings

try:
    from rich.console import Console
    _console = Console()
    def _print(message: str, style: Optional[str] = None, quiet: bool = False) -> None:
        """Print using Rich if available, fallback to standard print."""
        if quiet:
            return  # Suppress output in quiet mode
        if style:
            _console.print(message, style=style)
        else:
            _console.print(message)
except ImportError:
    def _print(message: str, style: Optional[str] = None, quiet: bool = False) -> None:
        """Fallback to standard print if Rich not available."""
        if not quiet:
            print(message)

from ...domain.value_objects import FilePath
from ...domain.entities import Transcription


class WhisperXService:
    """Service for WhisperX speech-to-text operations with enhanced features."""
    
    def __init__(self, model_name: str = "large-v3", device: Optional[str] = None):
        """
        Initialize WhisperX service.
        
        Args:
            model_name: Whisper model name (WhisperX only supports "large-v3")
            device: Device to use ("cuda", "cpu", "mps", or None for auto-detection)
        """
        # WhisperX only supports large-v3
        if model_name != "large-v3":
            _print(f"⚠️ WhisperX only supports 'large-v3' model, got '{model_name}'. Using 'large-v3' instead.", "yellow")
            model_name = "large-v3"
            
        self.model_name = model_name
        self._device = device or self._get_optimal_device()
        self._quiet_mode = False
        self._progress_callback: Optional[Callable[[int, int, str], None]] = None
        
        # WhisperX components
        self.model = None
        self.model_a = None  # Alignment model
        self.metadata = None
        self.diarize_model = None
    
    def _get_optimal_device(self) -> str:
        """Determine optimal device for inference."""
        # Check for CUDA (NVIDIA GPUs)
        if torch.cuda.is_available():
            gpu_count = torch.cuda.device_count()
            _print(f"CUDA available with {gpu_count} GPU(s)", "cyan")
            
            for i in range(gpu_count):
                try:
                    props = torch.cuda.get_device_properties(i)
                    gpu_memory = props.total_memory / 1024**3
                    _print(f"GPU {i}: {props.name} ({gpu_memory:.1f}GB)", "blue")
                    
                    if gpu_memory >= 4.0:  # WhisperX requires more VRAM
                        _print(f"✅ Using CUDA GPU {i}: {props.name} with {gpu_memory:.1f}GB memory", "green")
                        return "cuda"  # WhisperX expects just "cuda", not "cuda:0"
                    else:
                        _print(f"⚠️ GPU {i} memory ({gpu_memory:.1f}GB) insufficient for WhisperX", "yellow")
                        
                except Exception as e:
                    _print(f"⚠️ GPU {i} test failed: {e}", "yellow")
                    continue
        
        # Check for Apple Metal Performance Shaders (WhisperX historically doesn't support MPS)
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            # Try to detect if WhisperX now supports MPS in newer versions
            try:
                import whisperx
                # Test MPS compatibility by attempting to create a model with MPS device
                _print("🧪 Testing WhisperX MPS compatibility...", "blue")
                test_model = whisperx.load_model("base", "mps", compute_type="float32")
                if test_model is not None:
                    _print("✅ WhisperX MPS support detected! Using MPS acceleration", "green")
                    return "mps"
            except Exception as e:
                _print(f"⚠️ WhisperX MPS test failed: {e}", "yellow")
                _print("ℹ️ WhisperX does not support MPS, falling back to CPU", "blue")
        
        _print("ℹ️ Using CPU for inference", "blue")
        return "cpu"
    
    def load_model(self, compute_type: Optional[str] = None, language: str = "zh") -> bool:
        """
        Load WhisperX model with specified language to avoid auto-detection.
        
        Args:
            compute_type: Computation type ("float16", "int8", "float32"). Auto-selected if None.
            language: Language code for transcription (avoids auto-detection warning)
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            import whisperx
            import os
            
            # Auto-select compute type based on device with CPU optimization
            if compute_type is None:
                if self._device == "cpu":
                    compute_type = "float32"  # CPU doesn't support efficient float16
                else:
                    compute_type = "float16"  # GPU can use float16
            
            # Optimize CPU performance by setting thread counts
            if self._device == "cpu":
                # Set optimal thread counts for CPU inference
                cpu_cores = os.cpu_count() or 4
                # Use all available cores but cap at 16 for optimal performance
                optimal_threads = min(cpu_cores, 16)
                
                # Set PyTorch thread counts for better CPU utilization
                import torch
                torch.set_num_threads(optimal_threads)
                torch.set_num_interop_threads(optimal_threads)
                
                _print(f"🚀 CPU optimization: Using {optimal_threads} threads for inference", "blue")
            
            _print(f"Loading WhisperX model '{self.model_name}' on device: {self._device} with language: {language}, compute_type: {compute_type}", "blue")
            
            # Load Whisper model with language parameter (this eliminates the warning)
            self.model = whisperx.load_model(
                self.model_name, 
                self._device, 
                compute_type=compute_type,
                language=language  # Pass language to load_model, not transcribe
            )
            
            # Note: Alignment model will be loaded after transcription when language is detected
            self.model_a = None
            self.metadata = None
            
            _print(f"✅ WhisperX model loaded successfully on {self._device}", "green")
            return True
            
        except ImportError:
            _print("❌ WhisperX not installed. Install with: pip install whisperx", "red")
            return False
        except Exception as e:
            _print(f"❌ Failed to load WhisperX model: {e}", "red")
            return False
    
    def load_diarization_model(self, hf_token: Optional[str] = None) -> bool:
        """
        Load speaker diarization model.
        
        Args:
            hf_token: Hugging Face token for accessing gated models
            
        Returns:
            bool: True if diarization model loaded successfully
        """
        try:
            import whisperx
            
            if hf_token is None:
                hf_token = os.getenv('HF_TOKEN')
            
            if not hf_token:
                _print("⚠️ No HF_TOKEN provided, speaker diarization will be unavailable", "yellow")
                return False
            
            _print("Loading speaker diarization model...", "blue")
            self.diarize_model = whisperx.DiarizationPipeline(
                use_auth_token=hf_token, 
                device=self._device
            )
            
            _print("✅ Speaker diarization model loaded", "green")
            return True
            
        except Exception as e:
            _print(f"⚠️ Could not load diarization model: {e}", "yellow")
            return False
    
    def set_progress_callback(self, callback: Optional[Callable[[int, int, str], None]]) -> None:
        """
        Set progress callback for transcription progress tracking.
        
        Args:
            callback: Function that receives (current_step, total_steps, status)
        """
        self._progress_callback = callback
    
    def is_model_loaded(self) -> bool:
        """Check if model is loaded and ready."""
        return self.model is not None
    
    def transcribe_audio_file(
        self,
        audio_file_path: str,
        language: str = "zh",
        return_timestamps: bool = True,
        batch_size: int = None,
        enable_diarization: bool = False,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio file using WhisperX.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code
            return_timestamps: Whether to return timestamps
            batch_size: Batch size for processing
            enable_diarization: Whether to enable speaker diarization
            min_speakers: Minimum number of speakers for diarization
            max_speakers: Maximum number of speakers for diarization
            
        Returns:
            dict: Transcription result with text and timestamps
            
        Raises:
            RuntimeError: If model not loaded
            FileNotFoundError: If audio file doesn't exist
        """
        if not self.is_model_loaded():
            raise RuntimeError("WhisperX model not loaded. Call load_model() first.")
        
        # Validate file exists
        file_path = FilePath.from_string(audio_file_path)
        file_path.validate_exists()
        
        try:
            import whisperx
            import os
            
            # Optimize batch size for CPU performance if not specified
            if batch_size is None:
                if self._device == "cpu":
                    # For CPU, smaller batch sizes often perform better
                    cpu_cores = os.cpu_count() or 4
                    # Use 1-4 batch size based on CPU cores for optimal memory usage
                    batch_size = min(max(1, cpu_cores // 4), 4)
                    _print(f"🚀 CPU-optimized batch size: {batch_size}", "blue")
                else:
                    # Default for GPU
                    batch_size = 16
            
            # Step 1: Load audio
            if self._progress_callback:
                self._progress_callback(1, 4, "Loading audio...")
            _print("Loading audio...", "blue")
            audio = whisperx.load_audio(audio_file_path)
            
            # Step 2: Transcribe with Whisper (language was specified in load_model)
            if self._progress_callback:
                self._progress_callback(2, 4, "Transcribing audio...")
            _print(f"Transcribing with WhisperX (batch_size={batch_size})...", "blue")
            result = self.model.transcribe(audio, batch_size=batch_size)
            
            # Step 3: Load alignment model and align whisper output for better timestamps
            if return_timestamps:
                if self._progress_callback:
                    self._progress_callback(3, 4, "Aligning timestamps...")
                try:
                    # Detect language from transcription result
                    detected_language = result.get("language", language)
                    _print(f"Detected language: {detected_language}", "blue")
                    
                    # Load alignment model for detected language
                    if self.model_a is None:
                        _print("Loading alignment model...", "blue")
                        self.model_a, self.metadata = whisperx.load_align_model(
                            language_code=detected_language, 
                            device=self._device
                        )
                    
                    # Align segments for better timestamps
                    _print("Aligning timestamps...", "blue")
                    result = whisperx.align(
                        result["segments"], 
                        self.model_a, 
                        self.metadata, 
                        audio, 
                        self._device, 
                        return_char_alignments=False
                    )
                except Exception as e:
                    _print(f"⚠️ Could not align timestamps: {e}", "yellow")
                    # Continue without alignment
            else:
                if self._progress_callback:
                    self._progress_callback(3, 4, "Skipping timestamp alignment...")
            
            # Step 4: Speaker diarization (if enabled)
            if enable_diarization and self.diarize_model is not None:
                if self._progress_callback:
                    self._progress_callback(4, 4, "Performing speaker diarization...")
                _print("Performing speaker diarization...", "blue")
                
                # Create diarization segments
                diarize_segments = self.diarize_model(
                    audio,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers
                )
                
                # Assign speaker labels to segments
                result = whisperx.assign_word_speakers(diarize_segments, result)
            else:
                if self._progress_callback:
                    self._progress_callback(4, 4, "Processing results...")
                
            # Final progress update
            if self._progress_callback:
                self._progress_callback(4, 4, "Transcription complete!")
                
            # Process result into standard format
            return self._process_whisperx_result(result, audio_file_path, enable_diarization)
            
        except Exception as e:
            raise RuntimeError(f"WhisperX transcription failed: {e}")
        finally:
            # Clean up GPU memory
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
    
    def transcribe_audio(
        self,
        audio_file_path: str,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Dict[str, Any]:
        """
        Transcribe audio (alias for transcribe_audio_file).
        
        Args:
            audio_file_path: Path to audio file
            language: Language code
            return_timestamps: Whether to return timestamps
            
        Returns:
            dict: Transcription result
        """
        return self.transcribe_audio_file(audio_file_path, language, return_timestamps)
    
    def _process_whisperx_result(
        self, 
        result: Dict[str, Any], 
        audio_file_path: str,
        has_diarization: bool = False
    ) -> Dict[str, Any]:
        """
        Process raw WhisperX result into standardized format.
        
        Args:
            result: Raw result from WhisperX
            audio_file_path: Original audio file path
            has_diarization: Whether result includes speaker information
            
        Returns:
            dict: Processed result with standardized format
        """
        processed = {
            "text": "",
            "language": "zh",
            "chunks": [],
            "source_file": audio_file_path,
            "whisperx_segments": result.get("segments", []),
            "has_speaker_labels": has_diarization
        }
        
        # Extract segments
        segments = result.get("segments", [])
        full_text = []
        
        for segment in segments:
            text = segment.get("text", "").strip()
            if not text:
                continue
                
            # Extract timing information
            start_time = segment.get("start", 0.0)
            end_time = segment.get("end", start_time + 0.1)
            
            # Create chunk
            chunk = {
                "text": text,
                "timestamp": [float(start_time), float(end_time)]
            }
            
            # Add speaker information if available
            if has_diarization and "speaker" in segment:
                chunk["speaker"] = segment["speaker"]
            
            processed["chunks"].append(chunk)
            full_text.append(text)
        
        processed["text"] = " ".join(full_text)
        return processed
    
    def create_transcription_entity(
        self, 
        whisperx_result: Dict[str, Any]
    ) -> Transcription:
        """
        Create Transcription entity from WhisperX result.
        
        Args:
            whisperx_result: Processed WhisperX result
            
        Returns:
            Transcription: Domain entity
        """
        return Transcription.from_whisper_result(whisperx_result)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded model."""
        return {
            "model_name": f"whisperX/{self.model_name}",
            "device": self._device,
            "is_loaded": self.is_model_loaded(),
            "has_alignment": self.model_a is not None,
            "has_diarization": self.diarize_model is not None,
            "torch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available()
        }
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes."""
        return [
            "zh", "en", "es", "fr", "de", "ja", "ko", "pt", "ru", "ar",
            "hi", "it", "nl", "pl", "tr", "uk", "vi", "th", "sv", "no"
        ]
    
    def cleanup(self) -> None:
        """Clean up model resources."""
        if self.model is not None:
            del self.model
            self.model = None
            
        if self.model_a is not None:
            del self.model_a
            self.model_a = None
            
        if self.diarize_model is not None:
            del self.diarize_model
            self.diarize_model = None
            
        # Clear GPU cache
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        gc.collect()