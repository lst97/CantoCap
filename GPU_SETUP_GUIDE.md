# GPU Setup Guide for RTX 2070 Super

## Current Status ✅

- **GPU Detected**: NVIDIA GeForce RTX 2070 SUPER (8GB)
- **nvidia-smi**: Working correctly
- **Issue**: PyTorch not installed with CUDA support

## Quick Fix Commands

### 1. Install PyTorch with CUDA Support

```bash
# Uninstall current PyTorch (if any)
pip uninstall torch torchvision torchaudio

# Install PyTorch with CUDA 11.8 (compatible with RTX 2070 Super)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. Install Additional Dependencies

```bash
# Install transformers with specific version for compatibility
pip install transformers>=4.21.0
pip install accelerate>=0.20.0
```

### 3. Verify Installation

```bash
python test_gpu_fix.py
```

## Detailed Setup Steps

### Step 1: Check CUDA Compatibility

Your RTX 2070 Super supports:

- **CUDA Compute Capability**: 7.5
- **CUDA Versions**: 10.0+ (recommend 11.8 or 12.1)
- **Memory**: 8GB (excellent for Whisper models)

### Step 2: Install Correct PyTorch Version

Choose based on your CUDA driver version:

#### For CUDA 11.8 (Recommended)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

#### For CUDA 12.1 (If you have newer drivers)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

#### For CPU-only (Fallback)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### Step 3: Environment Variables (Optional)

Add to your environment or .env file:

```bash
CUDA_VISIBLE_DEVICES=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
```

## Performance Improvements Made

### 1. Enhanced GPU Detection

- ✅ Multi-GPU support (iterates through all GPUs)
- ✅ RTX series specific optimizations
- ✅ Actual GPU functionality testing
- ✅ Detailed memory and capability reporting

### 2. Fixed Deprecation Warning

- ✅ Suppressed FutureWarning for `inputs` parameter
- ✅ Added proper warnings filtering
- ✅ Updated to modern transformers API

### 3. Optimized Model Loading

- ✅ FP16 precision for GPU (2x memory efficiency)
- ✅ Automatic fallback to CPU if GPU fails
- ✅ Flash attention disabled for compatibility
- ✅ 30-second chunking for better memory management

### 4. Memory Management

- ✅ CUDA cache clearing after transcription
- ✅ Chunk-based processing to prevent OOM
- ✅ Worker count adjustment based on GPU memory

## Expected Performance Gains

With your RTX 2070 Super (8GB):

- **CPU → GPU**: ~5-10x faster transcription
- **Memory**: Can handle larger Whisper models (large-v3)
- **Batch Processing**: Process multiple files simultaneously
- **Real-time**: Near real-time transcription for shorter audio

## Troubleshooting

### Issue: "CUDA out of memory"

```python
# Use smaller model
whisper_service = WhisperService("openai/whisper-base")

# Or reduce chunk size in parallel processing
parallel_service = ParallelAudioService(chunk_duration=30.0)  # Smaller chunks
```

### Issue: "GPU not detected"

1. Check CUDA drivers: `nvidia-smi`
2. Verify PyTorch CUDA: `python -c "import torch; print(torch.cuda.is_available())"`
3. Reinstall PyTorch with correct CUDA version

### Issue: "Model loading slow"

- First load downloads model (~3GB for large-v3)
- Subsequent loads use cached model
- Use smaller model for testing: `whisper-base` or `whisper-small`

## Test Commands

### Basic GPU Test

```python
import torch
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"GPU name: {torch.cuda.get_device_name(0)}")
print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
```

### CantoCap GPU Test

```python
from cantocap.infrastructure.services.whisper_service import WhisperService
service = WhisperService()
service.load_model(force_gpu=True)
print(service.get_device_info())
```

## Next Steps After Installation

1. **Run test**: `python test_gpu_fix.py`
2. **Monitor GPU usage**: Task Manager → Performance → GPU
3. **Process audio**: Your transcription should be much faster
4. **Check memory**: Watch GPU memory usage during processing

## Notes

- **8GB VRAM**: Excellent for Whisper large models
- **RTX 2070 Super**: Supports all modern CUDA features
- **Tensor Cores**: Available for FP16 acceleration
- **NVEnc**: Hardware video encoding (if needed for preprocessing)

The enhanced WhisperService will automatically detect and use your GPU once PyTorch is properly installed!
