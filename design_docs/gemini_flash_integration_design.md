# Gemini Flash Integration Design Document

## Overview
Enhanced Cantonese subtitle generation with Gemini Flash integration for automatic speaker identification and transcription refinement.

## Architecture Components

### 1. Video Preprocessing Service

**Purpose**: Compress video files to optimize for LLM processing while preserving quality
**Location**: `src/infrastructure/services/video_preprocessing_service.py`

```python
from dataclasses import dataclass
from typing import Optional
import subprocess
from pathlib import Path

from ...domain.value_objects import FilePath
from ...domain.repositories import IVideoRepository

@dataclass
class CompressionSettings:
    target_resolution: str = "360p"
    target_bitrate: str = "500k"
    audio_quality: str = "128k"
    format: str = "mp4"

class VideoPreprocessingService:
    """Service for preprocessing video files for LLM analysis."""
    
    def __init__(self):
        self.temp_dir = Path.cwd() / "temp"
        self.temp_dir.mkdir(exist_ok=True)
    
    def compress_for_llm_analysis(
        self, 
        input_path: FilePath,
        settings: Optional[CompressionSettings] = None
    ) -> FilePath:
        """
        Compress video to reduce token usage for LLM analysis.
        
        Args:
            input_path: Original video file path
            settings: Compression settings
            
        Returns:
            Path to compressed video file
        """
        if settings is None:
            settings = CompressionSettings()
        
        # Generate output filename
        input_file = Path(input_path.path)
        output_file = self.temp_dir / f"{input_file.stem}_compressed.{settings.format}"
        
        # FFmpeg compression command
        cmd = [
            "ffmpeg", "-i", str(input_file),
            "-vf", f"scale=-2:{self._get_height_from_resolution(settings.target_resolution)}",
            "-b:v", settings.target_bitrate,
            "-b:a", settings.audio_quality,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "28",
            "-y",  # Overwrite output file
            str(output_file)
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return FilePath.from_string(str(output_file))
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Video compression failed: {e.stderr.decode()}")
    
    def _get_height_from_resolution(self, resolution: str) -> str:
        """Convert resolution string to height."""
        resolution_map = {
            "360p": "360",
            "480p": "480", 
            "720p": "720"
        }
        return resolution_map.get(resolution, "360")
    
    def cleanup_temp_files(self):
        """Clean up temporary compressed files."""
        for file in self.temp_dir.glob("*_compressed.*"):
            file.unlink(missing_ok=True)
```

### 2. Gemini Flash Service

**Purpose**: Google Gemini Flash integration for speaker analysis and transcription refinement
**Location**: `src/infrastructure/services/gemini_flash_service.py`

```python
import google.generativeai as genai
from dataclasses import dataclass
from typing import Optional, Dict, Any
import json
import re

from ...domain.value_objects import FilePath

@dataclass
class SpeakerIdentificationResult:
    speaker_count: int
    confidence: float
    analysis_notes: Optional[str] = None

@dataclass 
class TranscriptionRefinementResult:
    refined_srt: str
    changes_made: int
    quality_score: float
    processing_notes: Optional[str] = None

class GeminiFlashService:
    """Google Gemini Flash integration for video analysis and transcription refinement."""
    
    # System prompts as class constants
    SPEAKER_IDENTIFICATION_PROMPT = '''
You are a video analysis expert. Analyze this video to determine the exact number of unique speakers.

Instructions:
1. Watch the entire video carefully
2. Count distinct voices/speakers (not just people visible)
3. Ignore background noise, music, or other audio
4. Focus only on spoken dialogue
5. Return ONLY a JSON response with the exact format below

Required JSON Response Format:
{
    "speaker_count": <number>,
    "confidence": <0.0-1.0>,
    "analysis_notes": "<brief explanation>"
}

Example: {"speaker_count": 2, "confidence": 0.95, "analysis_notes": "Two distinct speakers - one male, one female"}
'''

    TRANSCRIPTION_REFINEMENT_PROMPT = '''
1. Role and Ultimate Authority

You are an expert AI agent specializing in Cantonese linguistics and transcription. You are the final judge of the output's accuracy. Your primary objective is to analyze a media file (video or audio) and its provided text, then produce a perfectly accurate, contextually appropriate, and precisely synchronized Cantonese subtitle file.

2. Phase 1: Contextual Analysis (Mandatory First Step)

Before any transcription, you must first analyze the entire video to create a brief internal summary. This summary should include:

    Overall Situation: What is happening in the scene? (e.g., a family argument, a dramatic confession, a comedic misunderstanding).

    Emotional Tone: What are the dominant emotions? (e.g., anger, grief, sarcasm, joy).

    Character Dynamics: What is the relationship between the speakers? (e.g., mother and daughter in conflict, lovers arguing).

This contextual understanding is critical and must inform all subsequent transcription decisions to ensure the final text reflects the true meaning and intent of the speakers.

3. Phase 2: Core Principles

    The Audio is the Single Source of Truth: The provided audio is the definitive source. The initial text is only a rough guide. If there is any discrepancy, you must prioritize the spoken words in the audio.

    Strictly {language_style} Cantonese: The final output must be in written {language_style} Cantonese, reflecting natural speech. Use the context from your summary to interpret slang, tone, and intent correctly.

    Meaning Over Literal Interpretation: Use your contextual summary to resolve ambiguities. If a word sounds like it could be multiple things, choose the one that makes the most sense in the emotional and narrative context of the scene.

4. Phase 3: Execution and Correction

    Character Usage:
        You must use Cantonese-specific characters.
        Examples: 係 (hai6), 嘅 (ge3), 喺 (hai2), 佢 (keoi5), 冇 (mou5), 啲 (di1), 唔 (m4), 咗 (zo2).
        Identify and replace phonetic approximations with the correct characters based on the audio and context.

    Handling Errors in the Original Document:
        Invalid Content: Delete any words or sentences from the original text that are not spoken in the audio.
        Grammatical and Phrasing Mistakes: Correct grammar to align with natural Cantonese sentence structure and common expressions.
        Mismatched Dialogue: If the audio and text differ, transcribe exactly what is said in the audio.
        Excessively Long Text: Break down long lines into shorter, correctly timed segments that align with the speaker's natural pauses and cadence.

    Speaker Tag Handling:
        If [SPEAKER_XX] tags ARE present in the original document, you must verify and correct them. Listen carefully to assign the correct speaker to each line. If a speaker changes mid-segment, split the line accordingly.
        If [SPEAKER_XX] tags ARE NOT present in the original document, do not add them. Simply provide the corrected transcription without speaker identification.

    Timing and Synchronization:
        Adjust timestamps (HH:MM:SS,ms --> HH:MM:SS,ms) to be precise.
        The start time must match the exact moment a phrase begins, and the end time must match the exact moment it finishes.
        Ensure each subtitle block represents a natural clause or a complete thought.

5. Phase 4: Required Output Format

The final output must strictly follow the standard SRT file format. You are responsible for ensuring every detail—timing, numbering, and text—is perfect.

Example Structure:
      
[Line Number]
[Start Time] --> [End Time]
[Corrected and Contextually Accurate Cantonese Text]

Return the complete corrected SRT file content.
'''

    def __init__(self, api_key: str):
        """Initialize Gemini Flash service with API key."""
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def identify_speaker_count(self, video_path: FilePath) -> SpeakerIdentificationResult:
        """
        Analyze video to determine number of unique speakers.
        
        Args:
            video_path: Path to video file (preferably compressed)
            
        Returns:
            SpeakerIdentificationResult with speaker count and confidence
        """
        try:
            # Upload video file
            video_file = genai.upload_file(str(video_path.path))
            
            # Generate response
            response = self.model.generate_content([
                self.SPEAKER_IDENTIFICATION_PROMPT,
                video_file
            ])
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Extract JSON from response (handle potential markdown formatting)
            json_match = re.search(r'\{[^{}]*\}', response_text)
            if json_match:
                json_text = json_match.group()
            else:
                json_text = response_text
            
            result_data = json.loads(json_text)
            
            return SpeakerIdentificationResult(
                speaker_count=result_data["speaker_count"],
                confidence=result_data["confidence"],
                analysis_notes=result_data.get("analysis_notes")
            )
            
        except Exception as e:
            raise RuntimeError(f"Speaker identification failed: {str(e)}")
        finally:
            # Clean up uploaded file
            if 'video_file' in locals():
                genai.delete_file(video_file.name)
    
    def refine_transcription(
        self,
        video_path: FilePath,
        whisper_srt: str,
        language_style: str = "colloquial"
    ) -> TranscriptionRefinementResult:
        """
        Refine transcription using Gemini Flash analysis.
        
        Args:
            video_path: Path to original video file
            whisper_srt: Original SRT content from Whisper + diarization
            language_style: "colloquial" or "written" style preference
            
        Returns:
            TranscriptionRefinementResult with refined SRT content
        """
        try:
            # Upload video file
            video_file = genai.upload_file(str(video_path.path))
            
            # Prepare prompt with language style
            prompt = self.TRANSCRIPTION_REFINEMENT_PROMPT.format(
                language_style=language_style
            )
            
            # Prepare content for analysis
            content = [
                prompt,
                f"\n\nOriginal SRT content to refine:\n\n{whisper_srt}",
                video_file
            ]
            
            # Generate refined transcription
            response = self.model.generate_content(content)
            refined_srt = response.text.strip()
            
            # Calculate changes made (simple heuristic)
            original_lines = len(whisper_srt.split('\n'))
            refined_lines = len(refined_srt.split('\n'))
            changes_made = abs(original_lines - refined_lines)
            
            # Calculate quality score (placeholder - could be enhanced)
            quality_score = min(1.0, len(refined_srt) / max(len(whisper_srt), 1))
            
            return TranscriptionRefinementResult(
                refined_srt=refined_srt,
                changes_made=changes_made,
                quality_score=quality_score,
                processing_notes="Gemini Flash refinement completed"
            )
            
        except Exception as e:
            raise RuntimeError(f"Transcription refinement failed: {str(e)}")
        finally:
            # Clean up uploaded file
            if 'video_file' in locals():
                genai.delete_file(video_file.name)
    
    def is_available(self) -> bool:
        """Check if Gemini Flash service is available and configured."""
        try:
            # Test with a simple request
            response = self.model.generate_content("Test")
            return True
        except Exception:
            return False
```

### 3. Enhanced Command Structure

**Modified**: `src/application/commands/generate_subtitles_command.py`

```python
@dataclass(frozen=True)
class GenerateSubtitlesCommand:
    """Command to generate subtitles with Gemini Flash integration."""
    
    # Existing fields...
    input_file_path: str
    output_file_path: Optional[str] = None
    language: str = "zh"
    model_name: Optional[str] = "openai/whisper-large-v3"
    
    # Modified Phase 2 features
    enable_speakers: bool = False
    # REMOVED: num_speakers - now auto-detected by Gemini Flash
    enable_written_style: bool = False  # colloquial vs written style
    enable_music_detection: bool = False
    charset: str = "traditional"
    
    # New Gemini Flash features
    enable_gemini_refinement: bool = True  # Default enabled
    gemini_api_key: Optional[str] = None
    video_compression_quality: str = "360p"  # For LLM processing
    
    def get_language_style(self) -> str:
        """Get language style preference for Gemini Flash."""
        return "written" if self.enable_written_style else "colloquial"
    
    def requires_gemini_flash(self) -> bool:
        """Check if Gemini Flash features are enabled."""
        return self.enable_speakers or self.enable_gemini_refinement
```

### 4. Enhanced Use Case Workflow

**Modified**: `src/application/use_cases/generate_subtitles_use_case.py`

```python
class GenerateSubtitlesUseCase:
    """Enhanced use case with Gemini Flash integration."""
    
    def __init__(
        self,
        # Existing dependencies...
        audio_repository: IAudioRepository,
        transcription_repository: ITranscriptionRepository,
        subtitle_repository: ISubtitleRepository,
        media_file_validator: MediaFileValidator,
        subtitle_formatting_service: SubtitleFormattingService,
        
        # Enhanced dependencies
        video_preprocessing_service: VideoPreprocessingService,
        gemini_flash_service: Optional[GeminiFlashService] = None,
        
        # Existing Phase 2 dependencies
        speaker_diarization_service=None,
        music_detection_service=None,
        charset_conversion_service=None
    ):
        # Initialize all services...
    
    def execute(self, command: GenerateSubtitlesCommand) -> SubtitleGenerationResult:
        """Execute enhanced subtitle generation with Gemini Flash integration."""
        start_time = time.time()
        temp_audio: Optional[AudioStream] = None
        compressed_video: Optional[FilePath] = None
        
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
            if compressed_video:
                self.video_preprocessing_service.cleanup_temp_files()
    
    def _gemini_speaker_identification(
        self, 
        media_file: MediaFile, 
        command: GenerateSubtitlesCommand
    ) -> tuple[FilePath, int]:
        """Phase 1: Use Gemini Flash to identify speaker count."""
        if not self.gemini_flash_service:
            raise RuntimeError("Gemini Flash service not available")
        
        # Compress video for LLM analysis
        compressed_video = self.video_preprocessing_service.compress_for_llm_analysis(
            media_file.get_file_path(),
            CompressionSettings(target_resolution=command.video_compression_quality)
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
        from ...domain.entities import Subtitle, SubtitleDocument
        from ...domain.value_objects import Timestamp
        
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
```

### 5. Enhanced CLI Integration

**Modified**: `src/presentation/cli/commands.py`

```python
def generate_command(
    input_file: Path = typer.Argument(...),
    output_file: Optional[Path] = typer.Option(None, "--output", "-o"),
    language: str = typer.Option("zh", "--language", "-l"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
    priority: str = typer.Option("balanced", "--priority", "-p"),
    
    # Modified speaker option - no longer takes count
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable automatic speaker identification and diarization"
    ),
    
    written: bool = typer.Option(False, "--written"),
    music: bool = typer.Option(False, "--music"),
    charset: str = typer.Option("traditional", "--charset"),
    
    # New Gemini Flash options
    gemini_api_key: Optional[str] = typer.Option(
        None,
        "--gemini-key",
        envvar="GEMINI_API_KEY",
        help="Google Gemini API key (can also use GEMINI_API_KEY env var)"
    ),
    
    disable_gemini_refinement: bool = typer.Option(
        False,
        "--no-gemini-refinement",
        help="Disable Gemini Flash transcription refinement"
    ),
    
    video_quality: str = typer.Option(
        "360p",
        "--video-quality",
        help="Video compression quality for LLM analysis (360p, 480p, 720p)"
    ),
    
    verbose: bool = typer.Option(False, "--verbose"),
    ipc_mode: bool = typer.Option(False, "--ipc-mode")
) -> None:
    """Generate Cantonese subtitles with Gemini Flash enhancement."""
    
    try:
        # Validate Gemini Flash requirements
        if speakers and not gemini_api_key:
            raise ValueError(
                "Gemini API key required for speaker identification. "
                "Use --gemini-key or set GEMINI_API_KEY environment variable."
            )
        
        # Create enhanced command
        command = GenerateSubtitlesCommand(
            input_file_path=str(input_file),
            output_file_path=str(output_file) if output_file else None,
            language=language,
            model_name=model,
            enable_speakers=speakers,  # Now boolean only
            enable_written_style=written,
            enable_music_detection=music,
            charset=charset,
            enable_gemini_refinement=not disable_gemini_refinement,
            gemini_api_key=gemini_api_key,
            video_compression_quality=video_quality
        )
        
        # Rest of execution logic...
        
    except Exception as e:
        # Error handling...
```

## Integration Workflow

### Three-Phase Processing Pipeline

1. **Phase 1: Gemini Speaker Analysis**
   - Compress video to 360p for token efficiency
   - Upload to Gemini Flash for speaker identification
   - Return speaker count with confidence score

2. **Phase 2: Enhanced Whisper + Diarization**
   - Extract audio using existing FFmpeg pipeline
   - Run Whisper transcription with auto-selected model
   - Perform speaker diarization with auto-detected speaker count
   - Generate initial subtitle document with speaker labels

3. **Phase 3: Gemini Transcription Refinement**
   - Upload original video to Gemini Flash
   - Send initial SRT content for comprehensive refinement
   - Apply contextual understanding and Cantonese language expertise
   - Return refined, publication-ready subtitle file

### Key Benefits

✅ **Automatic Speaker Detection**: No manual speaker counting required
✅ **Context-Aware Refinement**: Leverages video content for better transcription
✅ **Token Optimization**: Video compression reduces API costs
✅ **Quality Enhancement**: Two-stage validation ensures accuracy
✅ **Backward Compatibility**: Works with existing Whisper-only workflow

### Configuration

Environment variables:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

CLI usage:
```bash
# Basic usage with Gemini enhancement
cantocap video.mp4 --speakers --gemini-key YOUR_KEY

# Full feature set
cantocap video.mp4 --speakers --written --music --gemini-key YOUR_KEY

# Disable Gemini refinement but keep speaker identification
cantocap video.mp4 --speakers --no-gemini-refinement --gemini-key YOUR_KEY
```