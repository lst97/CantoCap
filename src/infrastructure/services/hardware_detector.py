"""Hardware detection and model recommendation service."""

import torch
import psutil
import platform
import os
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum


class ModelSize(Enum):
    """Whisper model sizes."""
    TINY = "openai/whisper-tiny"
    BASE = "openai/whisper-base"
    SMALL = "openai/whisper-small"
    MEDIUM = "openai/whisper-medium"
    LARGE_V2 = "openai/whisper-large-v2"
    LARGE_V3 = "openai/whisper-large-v3"
    TURBO = "openai/whisper-large-v3-turbo"


@dataclass
class ModelRequirements:
    """Hardware requirements for each model."""
    min_vram_gb: float
    min_ram_gb: float
    min_cpu_cores: int
    estimated_speed_multiplier: float  # Relative to base model
    quality_score: float  # 0.0 to 1.0
    
    
@dataclass
class HardwareProfile:
    """System hardware profile."""
    device_type: str  # "cuda", "mps", "cpu"
    device_name: str
    vram_gb: float
    ram_gb: float
    cpu_cores: int
    cpu_frequency_ghz: float
    platform_name: str
    
    # Computed performance scores
    gpu_performance_score: float
    cpu_performance_score: float
    overall_performance_score: float


class HardwareDetector:
    """Detects hardware capabilities and recommends optimal Whisper models."""
    
    # Model requirements matrix (conservative estimates)
    # Note: Tiny and Base models removed due to poor accuracy for Cantonese
    MODEL_REQUIREMENTS = {
        ModelSize.SMALL: ModelRequirements(
            min_vram_gb=2.0, min_ram_gb=3.0, min_cpu_cores=2, 
            estimated_speed_multiplier=0.7, quality_score=0.8
        ),
        ModelSize.MEDIUM: ModelRequirements(
            min_vram_gb=4.0, min_ram_gb=6.0, min_cpu_cores=4, 
            estimated_speed_multiplier=0.5, quality_score=0.9
        ),
        ModelSize.LARGE_V2: ModelRequirements(
            min_vram_gb=8.0, min_ram_gb=12.0, min_cpu_cores=6, 
            estimated_speed_multiplier=0.3, quality_score=0.95
        ),
        ModelSize.LARGE_V3: ModelRequirements(
            min_vram_gb=10.0, min_ram_gb=16.0, min_cpu_cores=8, 
            estimated_speed_multiplier=0.25, quality_score=1.0
        ),
        ModelSize.TURBO: ModelRequirements(
            min_vram_gb=6.0, min_ram_gb=8.0, min_cpu_cores=4,
            estimated_speed_multiplier=8.0, quality_score=0.9
        )
    }
    
    def __init__(self):
        """Initialize hardware detector."""
        self._hardware_profile: Optional[HardwareProfile] = None
        self._device_capabilities: Optional[Dict[str, Any]] = None
    
    def detect_hardware(self) -> HardwareProfile:
        """
        Detect and analyze system hardware capabilities.
        
        Returns:
            HardwareProfile: Comprehensive hardware analysis
        """
        if self._hardware_profile is not None:
            return self._hardware_profile
        
        # Detect primary compute device
        device_type, device_name, vram_gb = self._detect_compute_device()
        
        # System memory and CPU
        ram_gb = psutil.virtual_memory().total / (1024**3)
        cpu_cores = psutil.cpu_count(logical=False) or psutil.cpu_count()
        cpu_frequency_ghz = self._get_cpu_frequency()
        platform_name = f"{platform.system()} {platform.release()}"
        
        # Calculate performance scores
        gpu_performance_score = self._calculate_gpu_performance_score(device_type, vram_gb, device_name)
        cpu_performance_score = self._calculate_cpu_performance_score(cpu_cores, cpu_frequency_ghz, ram_gb)
        overall_performance_score = (gpu_performance_score * 0.7 + cpu_performance_score * 0.3)
        
        self._hardware_profile = HardwareProfile(
            device_type=device_type,
            device_name=device_name,
            vram_gb=vram_gb,
            ram_gb=ram_gb,
            cpu_cores=cpu_cores,
            cpu_frequency_ghz=cpu_frequency_ghz,
            platform_name=platform_name,
            gpu_performance_score=gpu_performance_score,
            cpu_performance_score=cpu_performance_score,
            overall_performance_score=overall_performance_score
        )
        
        return self._hardware_profile
    
    def _detect_compute_device(self) -> Tuple[str, str, float]:
        """Detect the primary compute device and its capabilities."""
        # Check for CUDA (NVIDIA GPUs)
        if torch.cuda.is_available():
            try:
                props = torch.cuda.get_device_properties(0)
                vram_gb = props.total_memory / (1024**3)
                
                # Test actual GPU functionality
                test_tensor = torch.tensor([1.0], device="cuda:0")
                device_name = props.name
                
                return "cuda", device_name, vram_gb
            except Exception:
                pass
        
        # Check for Apple Metal Performance Shaders (Apple Silicon)
        if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            try:
                # Test MPS functionality
                test_tensor = torch.tensor([1.0], device="mps")
                
                # Estimate unified memory for Apple Silicon
                total_ram = psutil.virtual_memory().total / (1024**3)
                # Apple Silicon typically allocates up to 75% of system RAM for GPU
                estimated_vram = min(total_ram * 0.75, 64.0)  # Cap at 64GB
                
                return "mps", "Apple Metal Performance Shaders", estimated_vram
            except Exception:
                pass
        
        # Check for Intel XPU (future support)
        try:
            import intel_extension_for_pytorch as ipex
            if ipex.xpu.is_available():
                return "xpu", "Intel XPU", 8.0  # Conservative estimate
        except ImportError:
            pass
        
        # Fallback to CPU
        total_ram = psutil.virtual_memory().total / (1024**3)
        cpu_name = platform.processor() or "CPU"
        return "cpu", cpu_name, total_ram  # Use system RAM as "VRAM" for CPU
    
    def _get_cpu_frequency(self) -> float:
        """Get CPU frequency in GHz."""
        try:
            # Try to get current frequency
            cpu_freq = psutil.cpu_freq()
            if cpu_freq and cpu_freq.current:
                return cpu_freq.current / 1000.0  # Convert MHz to GHz
            
            # Fallback: try to get from /proc/cpuinfo on Linux
            if platform.system() == "Linux":
                try:
                    with open("/proc/cpuinfo", "r") as f:
                        for line in f:
                            if "cpu MHz" in line:
                                return float(line.split(":")[1].strip()) / 1000.0
                except:
                    pass
            
            # Default conservative estimate
            return 2.0
        except:
            return 2.0
    
    def _calculate_gpu_performance_score(self, device_type: str, vram_gb: float, device_name: str) -> float:
        """Calculate GPU performance score (0.0 to 1.0)."""
        if device_type == "cuda":
            # Score based on VRAM and known GPU families
            vram_score = min(vram_gb / 24.0, 1.0)  # Normalize to RTX 4090 level
            
            # Bonus for known high-performance GPUs
            gpu_bonus = 0.0
            device_lower = device_name.lower()
            if any(x in device_lower for x in ["rtx 40", "rtx 30", "tesla", "a100", "h100"]):
                gpu_bonus = 0.2
            elif any(x in device_lower for x in ["rtx 20", "gtx 16", "rtx"]):
                gpu_bonus = 0.1
            
            return min(vram_score + gpu_bonus, 1.0)
            
        elif device_type == "mps":
            # Apple Silicon scoring based on estimated unified memory
            if vram_gb >= 32:
                return 0.9  # M1 Ultra / M2 Ultra
            elif vram_gb >= 16:
                return 0.8  # M1 Pro / M2 Pro
            elif vram_gb >= 8:
                return 0.7  # M1 / M2
            else:
                return 0.6  # Entry-level Apple Silicon
                
        elif device_type == "xpu":
            return 0.7  # Conservative estimate for Intel XPU
        else:
            return 0.1  # CPU fallback
    
    def _calculate_cpu_performance_score(self, cpu_cores: int, cpu_frequency_ghz: float, ram_gb: float) -> float:
        """Calculate CPU performance score (0.0 to 1.0)."""
        # Normalize components
        cores_score = min(cpu_cores / 16.0, 1.0)  # Normalize to 16 cores
        freq_score = min(cpu_frequency_ghz / 4.0, 1.0)  # Normalize to 4 GHz
        ram_score = min(ram_gb / 32.0, 1.0)  # Normalize to 32GB
        
        # Weighted combination
        return (cores_score * 0.4 + freq_score * 0.3 + ram_score * 0.3)
    
    def recommend_model(
        self, 
        priority: str = "balanced",
        audio_duration_minutes: Optional[float] = None
    ) -> Tuple[ModelSize, Dict[str, Any]]:
        """
        Recommend optimal Whisper model based on hardware and preferences.
        
        Args:
            priority: "speed", "quality", or "balanced"
            audio_duration_minutes: Expected audio duration for processing time estimation
            
        Returns:
            Tuple of (recommended_model, recommendation_details)
        """
        hardware = self.detect_hardware()
        
        # Get compatible models based on hardware constraints
        compatible_models = self._get_compatible_models(hardware)
        
        if not compatible_models:
            # Emergency fallback to smallest available model
            return ModelSize.SMALL, {
                "reason": "emergency_fallback",
                "warning": "Hardware does not meet minimum requirements for larger models",
                "recommendation": "Using smallest available model (small) - consider upgrading system memory or using a more powerful device for better performance"
            }
        
        # Score models based on priority
        scored_models = []
        for model in compatible_models:
            score = self._calculate_model_score(model, hardware, priority, audio_duration_minutes)
            scored_models.append((model, score))
        
        # Sort by score (highest first)
        scored_models.sort(key=lambda x: x[1], reverse=True)
        recommended_model = scored_models[0][0]
        
        # Generate recommendation details
        details = self._generate_recommendation_details(
            recommended_model, hardware, compatible_models, priority, audio_duration_minutes
        )
        
        return recommended_model, details
    
    def _get_compatible_models(self, hardware: HardwareProfile) -> List[ModelSize]:
        """Get list of models compatible with current hardware."""
        compatible = []
        
        for model, requirements in self.MODEL_REQUIREMENTS.items():
            # Check VRAM/memory requirement
            memory_ok = hardware.vram_gb >= requirements.min_vram_gb
            
            # For CPU, be more lenient with memory requirements
            if hardware.device_type == "cpu":
                memory_ok = hardware.ram_gb >= requirements.min_ram_gb
            
            # Check CPU cores
            cpu_ok = hardware.cpu_cores >= requirements.min_cpu_cores
            
            if memory_ok and cpu_ok:
                compatible.append(model)
        
        return compatible
    
    def _calculate_model_score(
        self, 
        model: ModelSize, 
        hardware: HardwareProfile,
        priority: str,
        audio_duration_minutes: Optional[float]
    ) -> float:
        """Calculate score for a model based on priority and hardware."""
        requirements = self.MODEL_REQUIREMENTS[model]
        
        # Base compatibility score
        vram_ratio = hardware.vram_gb / requirements.min_vram_gb
        compatibility_score = min(vram_ratio / 2.0, 1.0)  # Prefer models with 2x headroom
        
        # Priority-based scoring
        if priority == "speed":
            # Prioritize faster models
            speed_score = requirements.estimated_speed_multiplier / 4.0  # Normalize to tiny model
            priority_score = min(speed_score, 1.0)
        elif priority == "quality":
            # Prioritize higher quality models
            priority_score = requirements.quality_score
        else:  # balanced
            # Balance speed and quality
            speed_score = requirements.estimated_speed_multiplier / 4.0
            quality_score = requirements.quality_score
            priority_score = (speed_score * 0.4 + quality_score * 0.6)
        
        # Duration penalty for large models on slow hardware
        duration_penalty = 0.0
        if audio_duration_minutes and audio_duration_minutes > 10:
            if hardware.overall_performance_score < 0.5 and model in [ModelSize.LARGE_V2, ModelSize.LARGE_V3]:
                duration_penalty = 0.3
        
        # Combine scores
        final_score = (compatibility_score * 0.4 + priority_score * 0.6) - duration_penalty
        return max(final_score, 0.0)
    
    def _generate_recommendation_details(
        self,
        recommended_model: ModelSize,
        hardware: HardwareProfile,
        compatible_models: List[ModelSize],
        priority: str,
        audio_duration_minutes: Optional[float]
    ) -> Dict[str, Any]:
        """Generate detailed recommendation information."""
        requirements = self.MODEL_REQUIREMENTS[recommended_model]
        
        # Estimate processing time
        estimated_time = None
        if audio_duration_minutes:
            base_multiplier = 1.0 / requirements.estimated_speed_multiplier
            if hardware.device_type == "cuda":
                device_multiplier = 0.3  # GPU is fast
            elif hardware.device_type == "mps":
                device_multiplier = 0.5  # MPS is moderately fast
            else:
                device_multiplier = 2.0  # CPU is slow
            
            estimated_time = audio_duration_minutes * base_multiplier * device_multiplier
        
        return {
            "model": recommended_model.value,
            "reason": f"Optimal for {priority} priority on {hardware.device_type.upper()}",
            "hardware_profile": {
                "device": f"{hardware.device_name} ({hardware.device_type.upper()})",
                "vram_gb": hardware.vram_gb,
                "ram_gb": hardware.ram_gb,
                "cpu_cores": hardware.cpu_cores,
                "performance_score": hardware.overall_performance_score
            },
            "model_info": {
                "quality_score": requirements.quality_score,
                "speed_multiplier": requirements.estimated_speed_multiplier,
                "vram_usage_gb": requirements.min_vram_gb,
                "ram_usage_gb": requirements.min_ram_gb
            },
            "alternatives": [model.value for model in compatible_models if model != recommended_model],
            "estimated_processing_time_minutes": estimated_time,
            "performance_tips": self._generate_performance_tips(hardware, recommended_model)
        }
    
    def _generate_performance_tips(self, hardware: HardwareProfile, model: ModelSize) -> List[str]:
        """Generate performance optimization tips."""
        tips = []
        
        requirements = self.MODEL_REQUIREMENTS[model]
        
        # VRAM/Memory tips
        if hardware.vram_gb < requirements.min_vram_gb * 1.5:
            tips.append("Consider closing other GPU-intensive applications to free up VRAM")
        
        if hardware.ram_gb < requirements.min_ram_gb * 1.5:
            tips.append("Close unnecessary applications to free up system memory")
        
        # Device-specific tips
        if hardware.device_type == "cpu":
            tips.append("Consider upgrading to a GPU for significantly faster processing")
            if hardware.cpu_cores < 8:
                tips.append("Multi-core CPU would improve processing speed")
        
        elif hardware.device_type == "cuda":
            if hardware.vram_gb >= 12:
                tips.append("Your GPU can handle larger models for better quality")
        
        elif hardware.device_type == "mps":
            tips.append("Ensure sufficient free memory for optimal Apple Silicon performance")
        
        # Model-specific tips
        if model in [ModelSize.LARGE_V2, ModelSize.LARGE_V3]:
            tips.append("Large models provide best quality but take longer to process")
        elif model == ModelSize.SMALL:
            tips.append("Small model is the minimum recommended for Cantonese transcription")
        
        return tips
    
    def get_hardware_summary(self) -> Dict[str, Any]:
        """Get a summary of detected hardware capabilities."""
        hardware = self.detect_hardware()
        
        return {
            "device": {
                "type": hardware.device_type,
                "name": hardware.device_name,
                "vram_gb": hardware.vram_gb
            },
            "system": {
                "ram_gb": hardware.ram_gb,
                "cpu_cores": hardware.cpu_cores,
                "cpu_frequency_ghz": hardware.cpu_frequency_ghz,
                "platform": hardware.platform_name
            },
            "performance": {
                "gpu_score": hardware.gpu_performance_score,
                "cpu_score": hardware.cpu_performance_score,
                "overall_score": hardware.overall_performance_score
            },
            "compatible_models": [model.value for model in self._get_compatible_models(hardware)]
        }