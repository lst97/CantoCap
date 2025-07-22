# GPU Setup Guide

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
pip install accelerate>=1.9.0
```

## Detailed Setup Steps

### Step 1: Check CUDA Compatibility

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