"""Audio format specification for consistent processing."""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any


class AudioCodec(Enum):
    """Supported audio codecs."""
    PCM_16 = "pcm_s16le"
    PCM_24 = "pcm_s24le" 
    PCM_32 = "pcm_s32le"
    FLAC = "flac"
    MP3 = "mp3"


class SampleRate(Enum):
    """Standard sample rates for audio processing."""
    RATE_8K = 8000
    RATE_16K = 16000
    RATE_22K = 22050
    RATE_44K = 44100
    RATE_48K = 48000


@dataclass(frozen=True)
class AudioFormat:
    """Immutable audio format specification for consistent processing."""
    
    sample_rate: int
    channels: int
    codec: AudioCodec
    bit_depth: int = 16
    
    # Standard format for Whisper processing
    WHISPER_FORMAT = None  # Will be set after class definition
    
    def __post_init__(self) -> None:
        """Validate audio format constraints."""
        if self.sample_rate <= 0:
            raise ValueError("Sample rate must be positive")
        
        if self.channels not in (1, 2):
            raise ValueError("Channels must be 1 (mono) or 2 (stereo)")
        
        if self.bit_depth not in (16, 24, 32):
            raise ValueError("Bit depth must be 16, 24, or 32")
        
        # Validate codec and bit depth compatibility
        if self.codec in (AudioCodec.PCM_16, AudioCodec.PCM_24, AudioCodec.PCM_32):
            expected_depth = int(self.codec.name.split('_')[1])
            if self.bit_depth != expected_depth:
                raise ValueError(
                    f"Bit depth {self.bit_depth} incompatible with codec {self.codec.name}"
                )
    
    @classmethod
    def create_whisper_format(cls) -> "AudioFormat":
        """Create the standard format for Whisper processing."""
        return cls(
            sample_rate=SampleRate.RATE_16K.value,
            channels=1,  # Mono
            codec=AudioCodec.PCM_16,
            bit_depth=16
        )
    
    @classmethod
    def from_sample_rate(cls, sample_rate: int, mono: bool = True) -> "AudioFormat":
        """Create format with specified sample rate."""
        return cls(
            sample_rate=sample_rate,
            channels=1 if mono else 2,
            codec=AudioCodec.PCM_16,
            bit_depth=16
        )
    
    def to_ffmpeg_params(self) -> Dict[str, Any]:
        """Convert to FFmpeg parameters dictionary."""
        return {
            'ar': self.sample_rate,     # Audio sample rate
            'ac': self.channels,        # Audio channels
            'acodec': self.codec.value, # Audio codec
            'f': 'wav'                  # Output format
        }
    
    def is_compatible_with_whisper(self) -> bool:
        """Check if format is compatible with Whisper model."""
        whisper_format = self.create_whisper_format()
        return (
            self.sample_rate == whisper_format.sample_rate and
            self.channels == whisper_format.channels and
            self.codec == whisper_format.codec
        )
    
    def get_file_extension(self) -> str:
        """Get appropriate file extension for this format."""
        if self.codec in (AudioCodec.PCM_16, AudioCodec.PCM_24, AudioCodec.PCM_32):
            return '.wav'
        elif self.codec == AudioCodec.FLAC:
            return '.flac'
        elif self.codec == AudioCodec.MP3:
            return '.mp3'
        else:
            return '.wav'  # Default fallback
    
    def get_estimated_bitrate(self) -> int:
        """Estimate bitrate in kbps."""
        if self.codec in (AudioCodec.PCM_16, AudioCodec.PCM_24, AudioCodec.PCM_32):
            # Uncompressed PCM
            return (self.sample_rate * self.channels * self.bit_depth) // 1000
        elif self.codec == AudioCodec.MP3:
            # Typical MP3 bitrate
            return 128 if self.channels == 1 else 256
        elif self.codec == AudioCodec.FLAC:
            # FLAC compression ratio roughly 50-70% of PCM
            pcm_bitrate = (self.sample_rate * self.channels * self.bit_depth) // 1000
            return int(pcm_bitrate * 0.6)
        else:
            return 128  # Conservative estimate
    
    def __str__(self) -> str:
        """String representation for logging."""
        channel_str = "mono" if self.channels == 1 else "stereo"
        return f"{self.sample_rate}Hz {channel_str} {self.bit_depth}-bit {self.codec.name}"


# Set the standard Whisper format
AudioFormat.WHISPER_FORMAT = AudioFormat.create_whisper_format()