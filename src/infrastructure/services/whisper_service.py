"""Whisper service for speech-to-text transcription."""

import torch
from transformers import pipeline, Pipeline
from typing import Optional, Dict, Any, List
import warnings
import os
import platform
from pathlib import Path

try:
    from rich.console import Console
    _console = Console()
    def _print(message: str, style: Optional[str] = None) -> None:
        """Print using Rich if available, fallback to standard print."""
        if style:
            _console.print(message, style=style)
        else:
            _console.print(message)
except ImportError:
    def _print(message: str, style: Optional[str] = None) -> None:
        """Fallback to standard print if Rich not available."""
        print(message)

from ...domain.value_objects import FilePath
from ...domain.entities import Transcription


class WhisperService:
    """Service for Whisper speech-to-text operations."""
    
    def __init__(self, model_name: str = "openai/whisper-base"):
        """
        Initialize Whisper service.
        
        Args:
            model_name: Hugging Face model name/path (default: base model for compatibility)
        """
        self.model_name = model_name
        self.pipeline: Optional[Pipeline] = None
        self._device = self._get_optimal_device()
        
        # Available model sizes in order of resource requirements
        self._model_hierarchy = [
            "openai/whisper-tiny",
            "openai/whisper-base", 
            "openai/whisper-small",
            "openai/whisper-medium",
            "openai/whisper-large-v2",
            "openai/whisper-large-v3"
        ]
    
    def _get_optimal_device(self) -> str:
        """Determine optimal device for inference with comprehensive GPU detection."""
        # Check for CUDA (NVIDIA GPUs) - Enhanced detection for RTX series
        if torch.cuda.is_available():
            gpu_count = torch.cuda.device_count()
            _print(f"CUDA available with {gpu_count} GPU(s)", "cyan")
            
            for i in range(gpu_count):
                try:
                    props = torch.cuda.get_device_properties(i)
                    gpu_memory = props.total_memory / 1024**3
                    _print(f"GPU {i}: {props.name} ({gpu_memory:.1f}GB)", "blue")
                    
                    # Test GPU functionality with a simple operation
                    device = f"cuda:{i}"
                    test_tensor = torch.tensor([1.0], device=device)
 
                    if gpu_memory >= 2.0:  # Minimum 2GB for Whisper models
                        _print(f"✅ Using CUDA GPU {i}: {props.name} with {gpu_memory:.1f}GB memory", "green")
                        return device
                    else:
                        _print(f"⚠️ GPU {i} memory ({gpu_memory:.1f}GB) insufficient, checking next GPU", "yellow")
                        
                except Exception as e:
                    _print(f"⚠️ GPU {i} test failed: {e}, checking next GPU", "yellow")
                    continue
        
        # Check for Apple Metal Performance Shaders (Apple Silicon)
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            try:
                # Test MPS availability
                _print("✅ Using Apple Metal Performance Shaders (MPS)", "green")
                return "mps"
            except Exception as e:
                _print(f"⚠️ MPS test failed: {e}, falling back to CPU", "yellow")
        
        # Check for Intel OpenVINO
        try:
            import intel_extension_for_pytorch as ipex
            if ipex.xpu.is_available():
                _print("✅ Using Intel XPU acceleration", "green")
                return "xpu"
        except ImportError:
            pass
        except Exception as e:
            _print(f"⚠️ Intel XPU test failed: {e}", "yellow")
        
        _print("ℹ️ Using CPU for inference", "blue")
        return "cpu"
    
    def get_device_info(self) -> Dict[str, Any]:
        """Get detailed device information."""
        info = {
            "device": self._device,
            "available_devices": []
        }
        
        # CUDA info
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                info["available_devices"].append({
                    "type": "cuda",
                    "index": i,
                    "name": props.name,
                    "memory_gb": props.total_memory / 1024**3,
                    "compute_capability": f"{props.major}.{props.minor}"
                })
        
        # MPS info
        if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            info["available_devices"].append({
                "type": "mps",
                "name": "Apple Metal Performance Shaders"
            })
        
        # CPU info
        info["available_devices"].append({
            "type": "cpu",
            "name": "CPU",
            "cores": os.cpu_count()
        })
        
        return info
    
    def check_compatibility(self) -> Dict[str, Any]:
        """Check system compatibility for Whisper models."""
        compatibility = {
            "torch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "device": self._device,
            "transformers_version": None,
            "whisper_classes_available": False,
            "recommended_action": None
        }
        
        try:
            import transformers
            compatibility["transformers_version"] = transformers.__version__
            
            # Check if Whisper classes are available
            from transformers import WhisperForConditionalGeneration, WhisperProcessor
            compatibility["whisper_classes_available"] = True
            
        except ImportError as e:
            compatibility["recommended_action"] = f"Install transformers: pip install transformers>=4.21.0"
            
        return compatibility
    
    def _configure_tokenizer_for_whisper(self, tokenizer):
        """Configure tokenizer to avoid attention mask warnings."""
        try:
            # Ensure pad token is different from eos token
            if not hasattr(tokenizer, 'pad_token') or tokenizer.pad_token is None or tokenizer.pad_token == tokenizer.eos_token:
                # Add a unique pad token
                tokenizer.add_special_tokens({'pad_token': '[PAD]'})
                # Resize model embeddings if needed
                if hasattr(self.pipeline, 'model'):
                    try:
                        self.pipeline.model.resize_token_embeddings(len(tokenizer))
                    except Exception:
                        pass  # Model may not support resizing
            
            # Set explicit attention mask configuration
            tokenizer.padding_side = "left"
            tokenizer.truncation_side = "left"
            
            return True
        except Exception as e:
            _print(f"⚠️ Tokenizer configuration warning: {e}", "yellow")
            return False
    
    def get_recommended_model(self) -> str:
        """
        Get recommended model based on available hardware.
        
        Returns:
            str: Recommended model name
        """
        if self._device.startswith("cuda"):
            # For GPU, check memory
            try:
                memory_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
                if memory_gb >= 10:
                    return "openai/whisper-large-v3"
                elif memory_gb >= 6:
                    return "openai/whisper-medium" 
                else:
                    return "openai/whisper-base"
            except:
                return "openai/whisper-base"
        elif self._device == "mps":
            # Apple Silicon - medium models work well
            return "openai/whisper-medium"
        else:
            # CPU - use smaller models
            return "openai/whisper-base"
    
    def load_model(self, model_name: Optional[str] = None, force_gpu: bool = False) -> bool:
        """
        Load Whisper model for transcription.
        
        Args:
            model_name: Optional model name to override default
            force_gpu: Force GPU usage if available
            
        Returns:
            bool: True if model loaded successfully
        """
        try:
            model_to_load = model_name or self.model_name
            
            # Re-detect device if forcing GPU
            if force_gpu and torch.cuda.is_available():
                self._device = self._get_optimal_device()
            
            _print(f"Loading model '{model_to_load}' on device: {self._device}", "blue")
            
            # Suppress deprecation warnings for cleaner output
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=FutureWarning)
                warnings.filterwarnings("ignore", category=UserWarning)
                warnings.filterwarnings("ignore", category=DeprecationWarning)
                
                # Configure device and dtype based on capability
                device_config = self._device
                if self._device.startswith("cuda"):
                    torch_dtype = torch.float16  # Use FP16 for GPU efficiency
                else:
                    torch_dtype = torch.float32  # Use FP32 for CPU/MPS
                
                _print(f"Using dtype: {torch_dtype}", "blue")
                
                # Load Whisper model with explicit model class specification
                from transformers import WhisperForConditionalGeneration, WhisperProcessor
                
                # Try direct pipeline loading with minimal parameters for best compatibility
                try:
                    # Simple pipeline creation - let transformers handle the details
                    self.pipeline = pipeline(
                        "automatic-speech-recognition",
                        model=model_to_load,
                        device=device_config,
                        torch_dtype=torch_dtype,
                        return_timestamps=True
                    )
                    _print("✅ Standard pipeline loading successful", "green")
                    
                except Exception as pipeline_error:
                    _print(f"⚠️ Standard pipeline failed: {pipeline_error}", "yellow")
                    _print("🔄 Trying explicit model loading...", "blue")
                    
                    # Fallback: Load model and processor separately with minimal parameters
                    try:
                        from transformers import WhisperForConditionalGeneration, WhisperProcessor
                        
                        # Load with minimal parameters to avoid compatibility issues
                        model = WhisperForConditionalGeneration.from_pretrained(
                            model_to_load,
                            torch_dtype=torch_dtype
                        )
                        
                        processor = WhisperProcessor.from_pretrained(model_to_load)
                        
                        # Configure tokenizer to avoid attention mask warnings
                        self._configure_tokenizer_for_whisper(processor.tokenizer)
                        
                        # Move to device manually
                        model = model.to(device_config)
                        
                        # Create pipeline with loaded components
                        self.pipeline = pipeline(
                            "automatic-speech-recognition",
                            model=model,
                            tokenizer=processor.tokenizer,
                            feature_extractor=processor.feature_extractor,
                            device=device_config,
                            return_timestamps=True
                        )
                        _print("✅ Explicit model loading successful", "green")
                        
                    except Exception as explicit_error:
                        _print(f"⚠️ Explicit loading failed: {explicit_error}", "yellow")
                        _print("🔄 Trying CPU-only fallback...", "blue")
                        
                        # Last resort: CPU-only with minimal configuration
                        self.pipeline = pipeline(
                            "automatic-speech-recognition",
                            model=model_to_load,
                            device="cpu",
                            return_timestamps=True
                        )
            
            self.model_name = model_to_load
            
            # Post-loading: Configure tokenizer to avoid attention mask warnings
            self._post_load_configuration()
            
            _print(f"✅ Model loaded successfully on {self._device}", "green")
            return True
            
        except Exception as e:
            _print(f"❌ Failed to load Whisper model: {e}", "red")
            
            # Try fallback strategies with more aggressive model downsizing
            if self._device != "cpu" and not force_gpu:
                _print("🔄 GPU failed, retrying with CPU...", "blue")
                self._device = "cpu"
                return self.load_model(model_name, force_gpu=False)
            elif model_to_load == "openai/whisper-large-v3":
                _print("🔄 Large-v3 failed, trying base model...", "blue")
                return self.load_model("openai/whisper-base", force_gpu=force_gpu)
            elif model_to_load == "openai/whisper-medium":
                _print("🔄 Medium model failed, trying base model...", "blue")
                return self.load_model("openai/whisper-base", force_gpu=force_gpu)
            elif model_to_load == "openai/whisper-base":
                _print("🔄 Base model failed, trying small model...", "blue")
                return self.load_model("openai/whisper-small", force_gpu=force_gpu)
            elif model_to_load == "openai/whisper-small":
                _print("🔄 Small model failed, trying tiny model...", "blue")
                return self.load_model("openai/whisper-tiny", force_gpu=force_gpu)
            
            self.pipeline = None
            return False
    
    def _post_load_configuration(self):
        """Configure pipeline after loading to avoid common issues."""
        if self.pipeline is None:
            return
        
        try:
            # Configure tokenizer if accessible
            if hasattr(self.pipeline, 'tokenizer') and self.pipeline.tokenizer:
                self._configure_tokenizer_for_whisper(self.pipeline.tokenizer)
            
            # Set pipeline to not require attention masks for inference
            if hasattr(self.pipeline, 'model') and hasattr(self.pipeline.model, 'config'):
                config = self.pipeline.model.config
                if hasattr(config, 'use_cache'):
                    config.use_cache = True  # Enable KV cache for efficiency
                    
        except Exception as e:
            _print(f"⚠️ Post-load configuration warning: {e}", "yellow")
    
    def _get_valid_generate_kwargs(self, language: str = "zh") -> Dict[str, Any]:
        """Get valid generate_kwargs for Whisper transcription."""
        # Start with basic, universally supported parameters
        kwargs = {
            "language": language,
            "task": "transcribe"
        }
        
        # Add optional parameters that are commonly supported
        try:
            # These parameters are usually safe to include
            optional_kwargs = {
                "do_sample": False,  # Deterministic decoding
                "num_beams": 1,      # Greedy search
                "temperature": 0.0,  # No randomness
            }
            
            # Only add if they seem to be valid (basic validation)
            for key, value in optional_kwargs.items():
                kwargs[key] = value
                
        except Exception as e:
            _print(f"⚠️ Some generate_kwargs may not be supported: {e}", "yellow")
        
        return kwargs
    
    def is_model_loaded(self) -> bool:
        """
        Check if model is loaded and ready.
        
        Returns:
            bool: True if model is ready
        """
        return self.pipeline is not None
    
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
            language: Language code (default: "zh" for Chinese)
            return_timestamps: Whether to return word-level timestamps
            
        Returns:
            dict: Transcription result with text and timestamps
        """
        return self.transcribe_audio_file(audio_file_path, language, return_timestamps)
    
    def transcribe_audio_file(
        self,
        audio_file_path: str,
        language: str = "zh",
        return_timestamps: bool = True
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text with timestamps.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code (default: "zh" for Chinese)
            return_timestamps: Whether to return word-level timestamps
            
        Returns:
            dict: Transcription result with text and timestamps
            
        Raises:
            RuntimeError: If model not loaded
            FileNotFoundError: If audio file doesn't exist
        """
        if not self.is_model_loaded():
            raise RuntimeError("Whisper model not loaded. Call load_model() first.")
        
        # Validate file exists
        file_path = FilePath.from_string(audio_file_path)
        file_path.validate_exists()
        
        # Temporarily add local ffmpeg to PATH for Whisper
        original_path = os.environ.get("PATH", "")
        ffmpeg_dir = self._get_local_ffmpeg_dir()
        
        if ffmpeg_dir and str(ffmpeg_dir) not in original_path:
            os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{original_path}"
        
        try:
            # Get valid generation parameters for this model
            generate_kwargs = self._get_valid_generate_kwargs(language)
            
            # Suppress attention mask warnings during transcription
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*attention mask.*")
                warnings.filterwarnings("ignore", message=".*pad token.*")
                
                # Try transcription with generate_kwargs, fallback to minimal params if needed
                try:
                    inputs = self.pipeline.preprocess(audio_file_path)
                    
                    # Create attention_mask
                    attention_mask = torch.ones(inputs["input_features"].shape).to(self._device)

                    result = self.pipeline(
                        audio_file_path,
                        return_timestamps=return_timestamps,
                        generate_kwargs=generate_kwargs,
                        chunk_length_s=30,
                        stride_length_s=5,  # Overlap between chunks for better continuity
                        max_new_tokens=448,  # Ensure complete generation
                        attention_mask=attention_mask.unsqueeze(0),
                    )
                except Exception as kwargs_error:
                    _print(f"⚠️ Generate kwargs failed: {kwargs_error}", "yellow")
                    _print("🔄 Retrying with minimal parameters...", "blue")
                    
                    # Fallback: Use only essential parameters with improved timestamp handling
                    minimal_kwargs = {
                        "language": language,
                        "task": "transcribe",
                        "return_timestamps": True
                    }
                    
                    result = self.pipeline(
                        audio_file_path,
                        return_timestamps=return_timestamps,
                        generate_kwargs=minimal_kwargs,
                        chunk_length_s=15,  # Shorter chunks for better timestamp accuracy
                        stride_length_s=3   # Overlap for continuity
                    )
            
            # Validate and process result
            validated_result = self._validate_whisper_result(result)
            return self._process_whisper_result(validated_result, audio_file_path)
            
        except Exception as e:
            raise RuntimeError(f"Transcription failed: {e}")
        finally:
            # Restore original PATH
            os.environ["PATH"] = original_path
    
    def _validate_whisper_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and fix Whisper result timestamps.
        
        Args:
            result: Raw Whisper result
            
        Returns:
            dict: Validated result with fixed timestamps
        """
        if not isinstance(result, dict):
            return result
        
        # Fix chunks with None timestamps
        if "chunks" in result and isinstance(result["chunks"], list):
            fixed_chunks = []
            current_time = 0.0
            
            for chunk in result["chunks"]:
                if isinstance(chunk, dict):
                    # Fix timestamp if it's None or invalid
                    if "timestamp" in chunk:
                        timestamp = chunk.get("timestamp", [0, 0])
                        
                        # Ensure timestamp is a list and has at least two elements
                        if isinstance(timestamp, tuple):
                            timestamp = list(timestamp)
                        
                        if not isinstance(timestamp, list) or len(timestamp) < 2:
                            timestamp = [0.0, 0.0] # Default to [0.0, 0.0] if malformed
                        
                        # Fix None values and ensure non-negative
                        start_time = max(0.0, timestamp[0] if timestamp[0] is not None else 0.0)
                        end_time = max(0.0, timestamp[1] if timestamp[1] is not None else start_time + 0.1)
                        
                        # Ensure valid time progression
                        if end_time <= start_time:
                            end_time = start_time + 0.1
                        
                        chunk["timestamp"] = [float(start_time), float(end_time)]
                    
                    fixed_chunks.append(chunk)
            
            result["chunks"] = fixed_chunks
        
        return result
    
    def _process_whisper_result(
        self, 
        result: Dict[str, Any], 
        audio_file_path: str
    ) -> Dict[str, Any]:
        """
        Process raw Whisper result into standardized format.
        
        Args:
            result: Raw result from Whisper pipeline
            audio_file_path: Original audio file path
            
        Returns:
            dict: Processed result with standardized format
        """
        processed = {
            "text": result.get("text", ""),
            "language": "zh",  # Default for our use case
            "chunks": [],
            "source_file": audio_file_path
        }
        
        # Process chunks with timestamps
        if "chunks" in result:
            for chunk in result["chunks"]:
                processed_chunk = {
                    "text": chunk.get("text", "").strip(),
                    "timestamp": chunk.get("timestamp", [0.0, 0.0])
                }
                
                # Only add non-empty chunks
                if processed_chunk["text"]:
                    processed["chunks"].append(processed_chunk)
        
        # If no chunks but we have text, create a single chunk
        elif processed["text"].strip():
            processed["chunks"] = [{
                "text": processed["text"].strip(),
                "timestamp": [0.0, 0.0]  # Will need duration from audio file
            }]
        
        return processed
    
    def _get_local_ffmpeg_dir(self) -> Optional[Path]:
        """Find local ffmpeg directory."""
        # This logic should mirror the one in the DI container
        # Corrected project_root to point to the actual project root
        project_root = Path(__file__).resolve().parent.parent.parent.parent
        
        ffmpeg_dir = None
        if platform.system() == "Windows":
            # Path for Windows as specified by user
            ffmpeg_dir = project_root / "lib" / "ffmpeg" / "bin" / "win"
        else:
            # Fallback for other systems (e.g., expecting ffmpeg executable in lib)
            # This assumes the executable is directly in 'lib' on non-Windows
            ffmpeg_dir = project_root / "lib"

        if ffmpeg_dir and ffmpeg_dir.exists() and ffmpeg_dir.is_dir():
            return ffmpeg_dir
            
        return None
    
    def create_transcription_entity(
        self, 
        whisper_result: Dict[str, Any]
    ) -> Transcription:
        """
        Create Transcription entity from Whisper result.
        
        Args:
            whisper_result: Processed Whisper result
            
        Returns:
            Transcription: Domain entity
        """
        return Transcription.from_whisper_result(whisper_result)
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded model.
        
        Returns:
            dict: Model information
        """
        return {
            "model_name": self.model_name,
            "device": self._device,
            "is_loaded": self.is_model_loaded(),
            "torch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "mps_available": hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
        }
    
    def estimate_processing_time(self, duration_seconds: float) -> float:
        """
        Estimate transcription processing time.
        
        Args:
            duration_seconds: Audio duration in seconds
            
        Returns:
            float: Estimated processing time in seconds
        """
        # Rough estimates based on typical performance
        if self._device == "cuda":
            # GPU: roughly 0.2-0.5x realtime
            return duration_seconds * 0.3
        elif self._device == "mps":
            # Apple Silicon: roughly 0.5-1x realtime  
            return duration_seconds * 0.7
        else:
            # CPU: roughly 2-5x realtime
            return duration_seconds * 3.0
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.
        
        Returns:
            list: Supported language codes
        """
        # Whisper supports many languages - returning most common ones
        return [
            "zh",   # Chinese
            "en",   # English
            "es",   # Spanish
            "fr",   # French
            "de",   # German
            "ja",   # Japanese
            "ko",   # Korean
            "pt",   # Portuguese
            "ru",   # Russian
            "ar",   # Arabic
        ]
    
    def cleanup(self) -> None:
        """Clean up model resources."""
        if self.pipeline is not None:
            del self.pipeline
            self.pipeline = None
            
        # Clear CUDA cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()