"""Tests for HardwareDetector."""

import unittest
from unittest.mock import Mock, patch, MagicMock
import platform

from src.infrastructure.services.hardware_detector import (
    HardwareDetector, HardwareProfile, ModelSize, ModelRequirements
)


class TestHardwareDetector(unittest.TestCase):
    """Test cases for HardwareDetector."""

    def setUp(self):
        """Set up test fixtures."""
        self.detector = HardwareDetector()

    def test_init(self):
        """Test detector initialization."""
        self.assertIsNone(self.detector._hardware_profile)
        self.assertIsNone(self.detector._device_capabilities)
        self.assertIsInstance(self.detector.MODEL_REQUIREMENTS, dict)

    @patch('torch.cuda.is_available')
    @patch('torch.cuda.get_device_properties')
    @patch('torch.tensor')
    @patch('psutil.virtual_memory')
    @patch('psutil.cpu_count')
    @patch('platform.system')
    @patch('platform.release')
    def test_detect_hardware_cuda(self, mock_release, mock_system, mock_cpu_count,
                                 mock_memory, mock_tensor, mock_get_props, mock_cuda_available):
        """Test hardware detection with CUDA GPU."""
        # Mock CUDA availability
        mock_cuda_available.return_value = True
        
        # Mock GPU properties
        mock_props = Mock()
        mock_props.name = "NVIDIA GeForce RTX 4090"
        mock_props.total_memory = 24 * 1024**3  # 24GB
        mock_get_props.return_value = mock_props
        
        # Mock tensor creation (to test CUDA functionality)
        mock_tensor.return_value = Mock()
        
        # Mock system info
        mock_memory.return_value = Mock(total=32 * 1024**3)  # 32GB RAM
        mock_cpu_count.return_value = 16
        mock_system.return_value = "Linux"
        mock_release.return_value = "5.15.0"
        
        with patch.object(self.detector, '_get_cpu_frequency', return_value=3.5):
            profile = self.detector.detect_hardware()
        
        self.assertEqual(profile.device_type, "cuda")
        self.assertEqual(profile.device_name, "NVIDIA GeForce RTX 4090")
        self.assertEqual(profile.vram_gb, 24.0)
        self.assertEqual(profile.ram_gb, 32.0)
        self.assertEqual(profile.cpu_cores, 16)
        self.assertEqual(profile.cpu_frequency_ghz, 3.5)
        self.assertEqual(profile.platform_name, "Linux 5.15.0")
        self.assertGreater(profile.gpu_performance_score, 0.8)
        self.assertGreater(profile.overall_performance_score, 0.7)

    @patch('torch.cuda.is_available')
    @patch('torch.backends.mps.is_available')
    @patch('torch.tensor')
    @patch('psutil.virtual_memory')
    @patch('psutil.cpu_count')
    @patch('platform.system')
    @patch('platform.release')
    def test_detect_hardware_mps(self, mock_release, mock_system, mock_cpu_count,
                                mock_memory, mock_tensor, mock_mps_available, mock_cuda_available):
        """Test hardware detection with Apple MPS."""
        # Mock availability
        mock_cuda_available.return_value = False
        mock_mps_available.return_value = True
        
        # Mock tensor creation
        mock_tensor.return_value = Mock()
        
        # Mock system info
        mock_memory.return_value = Mock(total=64 * 1024**3)  # 64GB unified memory
        mock_cpu_count.return_value = 12
        mock_system.return_value = "Darwin"
        mock_release.return_value = "22.1.0"
        
        with patch.object(self.detector, '_get_cpu_frequency', return_value=3.2):
            profile = self.detector.detect_hardware()
        
        self.assertEqual(profile.device_type, "mps")
        self.assertEqual(profile.device_name, "Apple Metal Performance Shaders")
        self.assertEqual(profile.vram_gb, 48.0)  # 75% of 64GB
        self.assertEqual(profile.ram_gb, 64.0)
        self.assertEqual(profile.cpu_cores, 12)

    @patch('torch.cuda.is_available')
    @patch('torch.backends.mps.is_available')
    @patch('psutil.virtual_memory')
    @patch('psutil.cpu_count')
    @patch('platform.processor')
    @patch('platform.system')
    @patch('platform.release')
    def test_detect_hardware_cpu_fallback(self, mock_release, mock_system, mock_processor,
                                         mock_cpu_count, mock_memory, mock_mps_available, mock_cuda_available):
        """Test hardware detection fallback to CPU."""
        # Mock no GPU availability
        mock_cuda_available.return_value = False
        mock_mps_available.return_value = False
        
        # Mock system info
        mock_memory.return_value = Mock(total=16 * 1024**3)  # 16GB RAM
        mock_cpu_count.return_value = 8
        mock_processor.return_value = "Intel(R) Core(TM) i7-9700K"
        mock_system.return_value = "Windows"
        mock_release.return_value = "10"
        
        with patch.object(self.detector, '_get_cpu_frequency', return_value=3.6):
            profile = self.detector.detect_hardware()
        
        self.assertEqual(profile.device_type, "cpu")
        self.assertEqual(profile.device_name, "Intel(R) Core(TM) i7-9700K")
        self.assertEqual(profile.vram_gb, 16.0)  # Uses RAM as "VRAM"
        self.assertEqual(profile.ram_gb, 16.0)

    @patch('psutil.cpu_freq')
    def test_get_cpu_frequency_success(self, mock_cpu_freq):
        """Test CPU frequency detection."""
        mock_freq = Mock()
        mock_freq.current = 3500.0  # 3.5 GHz in MHz
        mock_cpu_freq.return_value = mock_freq
        
        frequency = self.detector._get_cpu_frequency()
        
        self.assertEqual(frequency, 3.5)

    @patch('psutil.cpu_freq')
    @patch('platform.system')
    @patch('builtins.open', new_callable=unittest.mock.mock_open, 
           read_data="processor\t: 0\ncpu MHz\t\t: 2800.000\n")
    def test_get_cpu_frequency_linux_fallback(self, mock_open, mock_system, mock_cpu_freq):
        """Test CPU frequency detection with Linux fallback."""
        mock_cpu_freq.return_value = None
        mock_system.return_value = "Linux"
        
        frequency = self.detector._get_cpu_frequency()
        
        self.assertEqual(frequency, 2.8)

    @patch('psutil.cpu_freq')
    def test_get_cpu_frequency_default(self, mock_cpu_freq):
        """Test CPU frequency detection fallback to default."""
        mock_cpu_freq.return_value = None
        
        frequency = self.detector._get_cpu_frequency()
        
        self.assertEqual(frequency, 2.0)

    def test_calculate_gpu_performance_score_cuda_high_end(self):
        """Test GPU performance score calculation for high-end CUDA GPU."""
        score = self.detector._calculate_gpu_performance_score(
            "cuda", 24.0, "NVIDIA GeForce RTX 4090"
        )
        
        self.assertGreater(score, 0.9)

    def test_calculate_gpu_performance_score_cuda_mid_range(self):
        """Test GPU performance score calculation for mid-range CUDA GPU."""
        score = self.detector._calculate_gpu_performance_score(
            "cuda", 8.0, "NVIDIA GeForce GTX 1660"
        )
        
        self.assertGreater(score, 0.3)
        self.assertLess(score, 0.7)

    def test_calculate_gpu_performance_score_mps_high_memory(self):
        """Test GPU performance score calculation for high-memory Apple Silicon."""
        score = self.detector._calculate_gpu_performance_score(
            "mps", 32.0, "Apple Metal Performance Shaders"
        )
        
        self.assertEqual(score, 0.9)

    def test_calculate_gpu_performance_score_cpu(self):
        """Test GPU performance score calculation for CPU."""
        score = self.detector._calculate_gpu_performance_score(
            "cpu", 16.0, "Intel Core i7"
        )
        
        self.assertEqual(score, 0.1)

    def test_calculate_cpu_performance_score(self):
        """Test CPU performance score calculation."""
        score = self.detector._calculate_cpu_performance_score(
            cpu_cores=16, cpu_frequency_ghz=4.0, ram_gb=32.0
        )
        
        self.assertEqual(score, 1.0)  # Perfect score

    def test_calculate_cpu_performance_score_low_end(self):
        """Test CPU performance score calculation for low-end system."""
        score = self.detector._calculate_cpu_performance_score(
            cpu_cores=4, cpu_frequency_ghz=2.0, ram_gb=8.0
        )
        
        expected = (0.25 * 0.4 + 0.5 * 0.3 + 0.25 * 0.3)  # Normalized scores
        self.assertAlmostEqual(score, expected)

    def test_get_compatible_models_high_end_system(self):
        """Test compatible models for high-end system."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 4090",
            vram_gb=24.0,
            ram_gb=32.0,
            cpu_cores=16,
            cpu_frequency_ghz=4.0,
            platform_name="Linux",
            gpu_performance_score=1.0,
            cpu_performance_score=1.0,
            overall_performance_score=1.0
        )
        
        compatible = self.detector._get_compatible_models(hardware)
        
        # All models should be compatible
        self.assertEqual(len(compatible), len(self.detector.MODEL_REQUIREMENTS))
        self.assertIn(ModelSize.WHISPERX_LARGE_V3, compatible)
        self.assertIn(ModelSize.LARGE_V3, compatible)

    def test_get_compatible_models_low_end_system(self):
        """Test compatible models for low-end system."""
        hardware = HardwareProfile(
            device_type="cpu",
            device_name="CPU",
            vram_gb=4.0,
            ram_gb=4.0,
            cpu_cores=2,
            cpu_frequency_ghz=2.0,
            platform_name="Linux",
            gpu_performance_score=0.1,
            cpu_performance_score=0.3,
            overall_performance_score=0.2
        )
        
        compatible = self.detector._get_compatible_models(hardware)
        
        # Only small model should be compatible
        self.assertEqual(len(compatible), 1)
        self.assertIn(ModelSize.SMALL, compatible)

    def test_calculate_model_score_speed_priority(self):
        """Test model score calculation with speed priority."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 3080",
            vram_gb=10.0,
            ram_gb=16.0,
            cpu_cores=8,
            cpu_frequency_ghz=3.5,
            platform_name="Linux",
            gpu_performance_score=0.8,
            cpu_performance_score=0.7,
            overall_performance_score=0.75
        )
        
        score = self.detector._calculate_model_score(
            ModelSize.WHISPERX_LARGE_V3, hardware, "speed", None
        )
        
        # WhisperX should score high for speed priority
        self.assertGreater(score, 0.7)

    def test_calculate_model_score_quality_priority(self):
        """Test model score calculation with quality priority."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 4090",
            vram_gb=24.0,
            ram_gb=32.0,
            cpu_cores=16,
            cpu_frequency_ghz=4.0,
            platform_name="Linux",
            gpu_performance_score=1.0,
            cpu_performance_score=1.0,
            overall_performance_score=1.0
        )
        
        score_large_v3 = self.detector._calculate_model_score(
            ModelSize.LARGE_V3, hardware, "quality", None
        )
        score_small = self.detector._calculate_model_score(
            ModelSize.SMALL, hardware, "quality", None
        )
        
        # Large-v3 should score higher for quality priority
        self.assertGreater(score_large_v3, score_small)

    @patch.object(HardwareDetector, 'detect_hardware')
    @patch.object(HardwareDetector, '_get_compatible_models')
    def test_recommend_model_no_compatible(self, mock_get_compatible, mock_detect_hardware):
        """Test model recommendation when no models are compatible."""
        mock_detect_hardware.return_value = Mock()
        mock_get_compatible.return_value = []
        
        model, details = self.detector.recommend_model()
        
        self.assertEqual(model, ModelSize.SMALL)
        self.assertEqual(details["reason"], "emergency_fallback")
        self.assertIn("warning", details)

    @patch.object(HardwareDetector, 'detect_hardware')
    @patch.object(HardwareDetector, '_get_compatible_models')
    @patch.object(HardwareDetector, '_calculate_model_score')
    def test_recommend_model_success(self, mock_calculate_score, mock_get_compatible, mock_detect_hardware):
        """Test successful model recommendation."""
        # Mock hardware
        mock_hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 3080",
            vram_gb=10.0,
            ram_gb=16.0,
            cpu_cores=8,
            cpu_frequency_ghz=3.5,
            platform_name="Linux",
            gpu_performance_score=0.8,
            cpu_performance_score=0.7,
            overall_performance_score=0.75
        )
        mock_detect_hardware.return_value = mock_hardware
        
        # Mock compatible models
        compatible_models = [ModelSize.SMALL, ModelSize.MEDIUM, ModelSize.WHISPERX_LARGE_V3]
        mock_get_compatible.return_value = compatible_models
        
        # Mock scores (WhisperX should score highest)
        def score_side_effect(model, hardware, priority, duration):
            if model == ModelSize.WHISPERX_LARGE_V3:
                return 0.9
            elif model == ModelSize.MEDIUM:
                return 0.7
            else:
                return 0.5
        
        mock_calculate_score.side_effect = score_side_effect
        
        model, details = self.detector.recommend_model(priority="speed")
        
        self.assertEqual(model, ModelSize.WHISPERX_LARGE_V3)
        self.assertIn("model", details)
        self.assertIn("hardware_profile", details)
        self.assertIn("model_info", details)

    def test_get_optimal_whisperx_config_cuda_high_vram(self):
        """Test optimal WhisperX config for CUDA with high VRAM."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 4090",
            vram_gb=12.0,
            ram_gb=32.0,
            cpu_cores=16,
            cpu_frequency_ghz=4.0,
            platform_name="Linux",
            gpu_performance_score=1.0,
            cpu_performance_score=1.0,
            overall_performance_score=1.0
        )
        
        config = self.detector.get_optimal_whisperx_config(hardware)
        
        self.assertEqual(config["precision"], "fp16")
        self.assertEqual(config["batch_size"], 8)
        self.assertTrue(config["use_batch_processing"])

    def test_get_optimal_whisperx_config_cuda_low_vram(self):
        """Test optimal WhisperX config for CUDA with low VRAM."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="GTX 1660",
            vram_gb=4.0,
            ram_gb=16.0,
            cpu_cores=8,
            cpu_frequency_ghz=3.0,
            platform_name="Linux",
            gpu_performance_score=0.5,
            cpu_performance_score=0.6,
            overall_performance_score=0.55
        )
        
        config = self.detector.get_optimal_whisperx_config(hardware)
        
        self.assertEqual(config["precision"], "int8")
        self.assertEqual(config["quantization"], "8bit")
        self.assertEqual(config["batch_size"], 4)

    def test_get_optimal_whisperx_config_cpu(self):
        """Test optimal WhisperX config for CPU."""
        hardware = HardwareProfile(
            device_type="cpu",
            device_name="Intel i7",
            vram_gb=16.0,
            ram_gb=16.0,
            cpu_cores=8,
            cpu_frequency_ghz=3.5,
            platform_name="Linux",
            gpu_performance_score=0.1,
            cpu_performance_score=0.7,
            overall_performance_score=0.3
        )
        
        config = self.detector.get_optimal_whisperx_config(hardware)
        
        self.assertEqual(config["precision"], "int8")
        self.assertEqual(config["quantization"], "8bit")
        self.assertEqual(config["batch_size"], 8)
        self.assertTrue(config["use_batch_processing"])

    def test_estimate_whisperx_performance_cuda_fp16_batch8(self):
        """Test WhisperX performance estimation for CUDA fp16 batch8."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 4090",
            vram_gb=12.0,
            ram_gb=32.0,
            cpu_cores=16,
            cpu_frequency_ghz=4.0,
            platform_name="Linux",
            gpu_performance_score=1.0,
            cpu_performance_score=1.0,
            overall_performance_score=1.0
        )
        
        config = {
            "precision": "fp16",
            "batch_size": 8
        }
        
        performance = self.detector._estimate_whisperx_performance(hardware, config)
        
        self.assertIn("estimated_time_seconds", performance)
        self.assertIn("speedup_vs_openai_whisper", performance)
        self.assertGreater(performance["speedup_vs_openai_whisper"], 4.0)

    @patch.object(HardwareDetector, 'detect_hardware')
    def test_get_hardware_summary(self, mock_detect_hardware):
        """Test hardware summary generation."""
        mock_hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 3080",
            vram_gb=10.0,
            ram_gb=16.0,
            cpu_cores=8,
            cpu_frequency_ghz=3.5,
            platform_name="Linux",
            gpu_performance_score=0.8,
            cpu_performance_score=0.7,
            overall_performance_score=0.75
        )
        mock_detect_hardware.return_value = mock_hardware
        
        with patch.object(self.detector, '_get_compatible_models', 
                         return_value=[ModelSize.SMALL, ModelSize.MEDIUM]):
            summary = self.detector.get_hardware_summary()
        
        self.assertIn("device", summary)
        self.assertIn("system", summary)
        self.assertIn("performance", summary)
        self.assertIn("compatible_models", summary)
        self.assertEqual(summary["device"]["type"], "cuda")
        self.assertEqual(summary["device"]["name"], "RTX 3080")

    def test_generate_performance_tips_cuda_high_vram(self):
        """Test performance tips generation for high-VRAM CUDA system."""
        hardware = HardwareProfile(
            device_type="cuda",
            device_name="RTX 4090",
            vram_gb=24.0,
            ram_gb=32.0,
            cpu_cores=16,
            cpu_frequency_ghz=4.0,
            platform_name="Linux",
            gpu_performance_score=1.0,
            cpu_performance_score=1.0,
            overall_performance_score=1.0
        )
        
        tips = self.detector._generate_performance_tips(hardware, ModelSize.MEDIUM)
        
        self.assertIsInstance(tips, list)
        # Should suggest larger models for better quality
        larger_model_tip = any("larger models" in tip for tip in tips)
        self.assertTrue(larger_model_tip)

    def test_model_requirements_completeness(self):
        """Test that all models have complete requirements."""
        for model, requirements in self.detector.MODEL_REQUIREMENTS.items():
            self.assertIsInstance(requirements, ModelRequirements)
            self.assertGreater(requirements.min_vram_gb, 0)
            self.assertGreater(requirements.min_ram_gb, 0)
            self.assertGreater(requirements.min_cpu_cores, 0)
            self.assertGreater(requirements.estimated_speed_multiplier, 0)
            self.assertGreaterEqual(requirements.quality_score, 0.0)
            self.assertLessEqual(requirements.quality_score, 1.0)

    def test_hardware_profile_caching(self):
        """Test that hardware profile is cached after first detection."""
        with patch.object(self.detector, '_detect_compute_device', 
                         return_value=("cuda", "RTX 3080", 10.0)) as mock_detect:
            with patch('psutil.virtual_memory', Mock(return_value=Mock(total=16*1024**3))):
                with patch('psutil.cpu_count', Mock(return_value=8)):
                    with patch.object(self.detector, '_get_cpu_frequency', return_value=3.5):
                        # First call
                        profile1 = self.detector.detect_hardware()
                        # Second call
                        profile2 = self.detector.detect_hardware()
        
        # Should be the same object (cached)
        self.assertIs(profile1, profile2)
        # _detect_compute_device should only be called once
        mock_detect.assert_called_once()


if __name__ == '__main__':
    unittest.main()