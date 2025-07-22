"""Speaker count identification service for video analysis."""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import json
import re
import time
from abc import ABC, abstractmethod

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from ...domain.value_objects import FilePath


@dataclass
class SpeakerIdentificationResult:
    """Result of speaker identification analysis."""
    speaker_count: int
    confidence: float
    analysis_notes: Optional[str] = None


class ISpeakerCountService(ABC):
    """Interface for speaker count identification services."""
    
    @abstractmethod
    def identify_speaker_count(self, video_path: FilePath) -> SpeakerIdentificationResult:
        """Identify the number of speakers in a video."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the service is available."""
        pass


class GeminiSpeakerCountService(ISpeakerCountService):
    """Google Gemini-based speaker count identification service."""
    
    # File upload and processing constants
    FILE_UPLOAD_TIMEOUT = 300  # Maximum seconds to wait for file processing
    FILE_CHECK_INTERVAL = 5    # Seconds between file state checks
    MAX_UPLOAD_RETRIES = 3     # Maximum upload attempts
    
    # System instruction for speaker identification model
    SPEAKER_IDENTIFICATION_SYSTEM = '''You are a specialized video analysis expert focused exclusively on speaker identification.

Your ONLY task is to analyze video content and determine the exact number of unique speakers present in the audio.

Core Requirements:
1. Count distinct voices/speakers based on audio analysis
2. Ignore background noise, music, or environmental sounds
3. Focus exclusively on spoken dialogue
4. Provide confidence level based on audio clarity and distinctiveness
5. Return structured JSON response only

Analysis Guidelines:
- Voice characteristics: pitch, tone, accent, speech patterns
- Temporal separation: speakers at different times vs. overlapping speech  
- Audio quality considerations: clear vs. distorted audio affects confidence
- Background noise impact on speaker detection accuracy'''

    SPEAKER_IDENTIFICATION_PROMPT = '''Analyze this video to determine the exact number of unique speakers.

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
    
    def __init__(self, api_key: str):
        """Initialize Gemini speaker count service."""
        if not _GEMINI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
        
        genai.configure(api_key=api_key)
        
        # Configure safety settings (permissive for content analysis)
        safety_settings = [
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        
        # Speaker identification model - optimized for focused analysis
        speaker_config = genai.types.GenerationConfig(
            temperature=0.1,   # Low temperature for consistent JSON output
            top_p=0.8,         # Focused sampling
            top_k=20,          # Limited vocabulary for structured output
            max_output_tokens=200,  # Short JSON response
        )
        
        self.speaker_model = genai.GenerativeModel(
            model_name='models/gemini-2.0-flash-exp',
            generation_config=speaker_config,
            system_instruction=self.SPEAKER_IDENTIFICATION_SYSTEM,
            safety_settings=safety_settings
        )
        
        self.api_key = api_key
    
    def _upload_and_wait_for_active(self, file_path: str, file_description: str = "video file") -> Any:
        """
        Upload file to Gemini and wait for it to become ACTIVE.
        
        Args:
            file_path: Path to the file to upload
            file_description: Description for logging purposes
            
        Returns:
            Active Gemini file object
            
        Raises:
            RuntimeError: If upload fails or timeout occurs
        """
        upload_attempt = 0
        
        while upload_attempt < self.MAX_UPLOAD_RETRIES:
            try:
                print(f"Uploading {file_description} (attempt {upload_attempt + 1}/{self.MAX_UPLOAD_RETRIES})...")
                
                # Upload the file
                uploaded_file = genai.upload_file(path=file_path)
                print(f"File uploaded with ID: {uploaded_file.name}")
                
                # Wait for the file to become active
                start_time = time.time()
                check_count = 0
                
                while True:
                    # Refresh file state
                    current_file = genai.get_file(uploaded_file.name)
                    check_count += 1
                    elapsed_time = time.time() - start_time
                    
                    print(f"File state check #{check_count}: {current_file.state.name} (elapsed: {elapsed_time:.1f}s)")
                    
                    if current_file.state.name == "ACTIVE":
                        print(f"✅ {file_description.title()} is ready for processing!")
                        return current_file
                    
                    elif current_file.state.name == "FAILED":
                        print(f"❌ {file_description.title()} upload failed")
                        # Try to clean up the failed file
                        try:
                            genai.delete_file(uploaded_file.name)
                        except Exception:
                            pass
                        raise RuntimeError(f"{file_description.title()} upload failed - file processing error")
                    
                    elif current_file.state.name == "PROCESSING":
                        # Check for timeout
                        if elapsed_time >= self.FILE_UPLOAD_TIMEOUT:
                            print(f"⏰ {file_description.title()} processing timeout after {self.FILE_UPLOAD_TIMEOUT}s")
                            # Clean up the timed-out file
                            try:
                                genai.delete_file(uploaded_file.name)
                            except Exception:
                                pass
                            break  # Try next upload attempt
                        
                        # Continue waiting
                        print(f"⏳ Waiting for {file_description} to process...", end='')
                        for i in range(self.FILE_CHECK_INTERVAL):
                            print('.', end='', flush=True)
                            time.sleep(1)
                        print()  # New line
                    
                    else:
                        # Unknown state
                        print(f"❓ Unknown file state: {current_file.state.name}")
                        # Clean up and retry
                        try:
                            genai.delete_file(uploaded_file.name)
                        except Exception:
                            pass
                        break  # Try next upload attempt
                
            except Exception as e:
                print(f"❌ Upload attempt {upload_attempt + 1} failed: {str(e)}")
                upload_attempt += 1
                
                if upload_attempt < self.MAX_UPLOAD_RETRIES:
                    wait_time = 2 ** upload_attempt  # Exponential backoff: 2s, 4s, 8s
                    print(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    break
        
        # All attempts failed
        raise RuntimeError(
            f"Failed to upload {file_description} after {self.MAX_UPLOAD_RETRIES} attempts. "
            "Please check your file format, size, and network connection."
        )
    
    def identify_speaker_count(self, video_path: FilePath) -> SpeakerIdentificationResult:
        """
        Analyze video to determine number of unique speakers.
        
        Args:
            video_path: Path to video file (preferably compressed)
            
        Returns:
            SpeakerIdentificationResult with speaker count and confidence
        """
        try:
            # Upload video file and wait for it to become active
            video_file = self._upload_and_wait_for_active(
                str(video_path.path),
                "video file for speaker identification"
            )
            
            # Generate response using specialized speaker identification model
            response = self.speaker_model.generate_content([
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
            if 'video_file' in locals() and hasattr(video_file, 'name'):
                try:
                    print(f"Cleaning up uploaded file: {video_file.name}")
                    genai.delete_file(video_file.name)
                    print("✅ File cleanup completed")
                except Exception as e:
                    print(f"⚠️ File cleanup failed: {e}")
                    # File cleanup failure shouldn't break the flow
    
    def is_available(self) -> bool:
        """Check if Gemini speaker count service is available and configured."""
        if not _GEMINI_AVAILABLE:
            return False
        
        try:
            # Test with a simple request using the speaker model
            response = self.speaker_model.generate_content("Test connectivity")
            return True
        except Exception:
            return False
    
    @staticmethod
    def is_gemini_available() -> bool:
        """Check if Gemini dependencies are available."""
        return _GEMINI_AVAILABLE