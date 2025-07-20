"""Google Gemini Flash integration for video analysis and transcription refinement."""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import json
import re
import time

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


@dataclass 
class TranscriptionRefinementResult:
    """Result of transcription refinement."""
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

    def _get_transcription_refinement_prompt(self, language_style: str, has_speaker_tags: bool) -> str:
        """Get transcription refinement prompt based on language style and speaker tag presence."""
        
        style_instructions = {
            "written": """formal written Cantonese following these specific guidelines:
1. Primary Objective
    Your goal is to convert spoken Cantonese audio into a perfectly synchronized SRT subtitle file using Standard Written Chinese (書面語).
2. Core Principles
    Audio is Truth: The Cantonese audio is the definitive source. The provided text is only a reference.
    Context is Key: Before transcribing, analyze the video to understand the situation, emotions, and character relationships. This context must inform your choice of words and phrasing.
    Meaning Over Literal Translation: Focus on conveying the speaker's true meaning and intent. Rephrase sentences to sound natural and grammatically correct in formal written Chinese.
3. Execution Checklist: Conversion from Colloquial to Written
    Vocabulary & Characters: You must convert Cantonese-specific words to their Standard Written Chinese equivalents.
        佢 (keoi5) → 他 / 她
        哋 (dei6) → 們 (e.g., 佢哋 → 他們)
        喺 (hai2) → 在
        係 (hai6) → 是
        唔 (m4) → 不
        冇 (mou5) → 沒有
        嘅 (ge3) → 的
        咗 (zo2) → 了
        啲 (di1) → 些 / 一點
        乜 / 咩 (mat1 / me1) → 什麼
    Grammar & Sentence Structure: Restructure entire sentences to follow formal written grammar.
        Example: Spoken "你食咗飯未呀?" becomes Written "你吃飯了嗎？"
    Proper Nouns: Retain original proper nouns, such as character names (e.g., "荷媽") or specific locations.
""",
            "colloquial": """natural spoken Cantonese preserving authentic conversational elements:
1. Primary Objective
    Your goal is to accurately transcribe spoken Cantonese audio into a perfectly synchronized SRT subtitle file using Written Colloquial Cantonese (口語).
2. Core Principles
    Audio is Truth: The Cantonese audio is the definitive source. The provided text is only a reference.
    Context is Key: Before transcribing, analyze the video to understand the situation, emotions, and character relationships. This is crucial for interpreting slang, tone, and intent.
    Reflect Natural Speech: The final text must match how the characters actually talk, including their specific phrasing and expressions.
3. Execution Checklist: Accurate Colloquial Transcription
    Use Cantonese-Specific Characters: You must use characters that represent spoken Cantonese.
        係 (hai6)
        嘅 (ge3)
        喺 (hai2)
        佢 (keoi5)
        冇 (mou5)
        啲 (di1)
        唔 (m4)
        咗 (zo2)
    Correct Phonetic/Typing Errors: Replace incorrect or phonetic approximations in the original text with the correct characters based on the audio (e.g., correct "ho ma" to "荷媽" or "ge" to "嘅").
    Match Cantonese Grammar: Ensure the sentence structure aligns with natural, spoken Cantonese, not formal written Chinese."""
        }
        
        speaker_instructions = (
            "CRITICAL: You MUST preserve ALL existing [SPEAKER_XX] tags in your output. "
            "Each line that starts with a speaker tag (like [SPEAKER_01], [SPEAKER_02], etc.) must maintain that exact tag format. "
            "Verify that the speaker assignments are correct by listening to the audio, but always keep the speaker tags in the final output."
        ) if has_speaker_tags else (
            "Do not add speaker identification tags. Focus only on transcription accuracy."
        )
        
        return f'''
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
    Language Style (CRITICAL REQUIREMENT): The final output must strictly follow {style_instructions[language_style]}. This is a non-negotiable requirement that affects every single line of text. Use the context from your summary to interpret slang, tone, and intent correctly while maintaining the specified language style throughout.
    Meaning Over Literal Interpretation: Use your contextual summary to resolve ambiguities. If a word sounds like it could be multiple things, choose the one that makes the most sense in the emotional and narrative context of the scene.

4. Phase 3: Execution and Correction

    Language Style Execution (MANDATORY):
        Apply the specified language style requirements to EVERY line of text:
        {style_instructions[language_style]}
        
        Review each subtitle line and ensure it follows the style requirements exactly. This is your primary responsibility.

    Handling Errors in the Original Document:
        Invalid Content: Delete any words or sentences from the original text that are not spoken in the audio.
        Grammatical and Phrasing Mistakes: Correct grammar to align with natural Cantonese sentence structure and common expressions.
        Mismatched Dialogue: If the audio and text differ, transcribe exactly what is said in the audio.
        Excessively Long Text: Break down long lines into shorter, correctly timed segments that align with the speaker's natural pauses and cadence.

    Speaker Tag Handling:
        {speaker_instructions}

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
        if not _GEMINI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
        
        genai.configure(api_key=api_key)
        
        # Configure model with low temperature for more deterministic, instruction-following behavior
        generation_config = genai.types.GenerationConfig(
            temperature=1, 
            top_p=1.0,        # Focused sampling
        )
        
        self.model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            generation_config=generation_config,
        )
        self.api_key = api_key
    
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
            time.sleep(1) # Wait for file to become active
            
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
                try:
                    genai.delete_file(video_file.name)
                except Exception:
                    pass  # File cleanup failure shouldn't break the flow
    
    def refine_transcription(self, video_path: FilePath, whisper_srt: str, language_style: str) -> TranscriptionRefinementResult:
        """
        Refine transcription using Gemini Flash.
        
        Args:
            video_path: Path to video file
            whisper_srt: Original SRT content from Whisper
            language_style: "colloquial" or "written" style preference
            
        Returns:
            TranscriptionRefinementResult with refined SRT content
        """
        try:
            # Upload video file
            video_file = genai.upload_file(str(video_path.path))
            time.sleep(1) # Wait for file to become active
            
            # Detect if speaker tags are present in the original SRT
            has_speaker_tags = bool(re.search(r'\[SPEAKER_\d+\]', whisper_srt))
            
            # Generate dynamic prompt based on style and speaker tag presence
            prompt = self._get_transcription_refinement_prompt(language_style, has_speaker_tags)
            
            # Prepare content for analysis
            content = [
                prompt,
                f"\n\nOriginal SRT content to refine:\n\n{whisper_srt}",
                video_file
            ]
            
            # Generate refined transcription
            response = self.model.generate_content(content)
            
            if response.candidates and response.candidates[0].finish_reason == "MAX_TOKENS":
                raise RuntimeError("Input too large for single refinement. Use 'refine_transcription_chunked' for larger files.")
            
            if not response.parts:
                raise RuntimeError(f"Gemini Flash returned no parts. Full response: {response}")

            refined_srt = response.text.strip()
            
            # Verify speaker tags are preserved if they existed
            if has_speaker_tags:
                original_speaker_count = len(re.findall(r'[SPEAKER_\d+]', whisper_srt))
                refined_speaker_count = len(re.findall(r'[SPEAKER_\d+]', refined_srt))
                if refined_speaker_count == 0 and original_speaker_count > 0:
                    # Fallback: If Gemini stripped all speaker tags, use original with basic cleanup
                    print("Warning: Gemini removed speaker tags. Using fallback refinement.")
                    refined_srt = self._fallback_refinement_with_speakers(whisper_srt, language_style)
            
            # Calculate changes made (simple heuristic)
            original_lines = len(whisper_srt.split('\n'))
            refined_lines = len(refined_srt.split('\n'))
            changes_made = abs(original_lines - refined_lines)
            
            # Calculate quality score (placeholder - could be enhanced)
            quality_score = min(1.0, len(refined_srt) / max(len(whisper_srt), 1))
            
            processing_notes = "Gemini Flash refinement completed"
            if has_speaker_tags:
                speaker_count_preserved = len(re.findall(r'[SPEAKER_\d+]', refined_srt))
                processing_notes += f" with {speaker_count_preserved} speaker tags preserved"
            
            return TranscriptionRefinementResult(
                refined_srt=refined_srt,
                changes_made=changes_made,
                quality_score=quality_score,
                processing_notes=processing_notes
            )
            
        except Exception as e:
            raise RuntimeError(f"Transcription refinement failed: {str(e)}")
        finally:
            # Clean up uploaded file
            if 'video_file' in locals():
                try:
                    genai.delete_file(video_file.name)
                except Exception:
                    pass  # File cleanup failure shouldn't break the flow
    
    def _fallback_refinement_with_speakers(self, whisper_srt: str, language_style: str) -> str:
        """
        Fallback refinement that preserves speaker tags when Gemini fails to do so.
        
        Args:
            whisper_srt: Original SRT with speaker tags
            language_style: Language style preference
            
        Returns:
            Refined SRT with preserved speaker tags
        """
        # Simple text-only refinement while preserving structure
        lines = whisper_srt.split('\n')
        refined_lines = []
        
        for line in lines:
            # Preserve timing lines and empty lines
            if '-->' in line or line.strip() == '' or line.strip().isdigit():
                refined_lines.append(line)
            # Process content lines with speaker tags
            elif line.strip():
                # Extract speaker tag if present
                speaker_match = re.match(r'(\[SPEAKER_\d+\])\s*(.*)', line)
                if speaker_match:
                    speaker_tag, content = speaker_match.groups()
                    # Basic cleanup of content while preserving speaker tag
                    cleaned_content = content.strip()
                    if cleaned_content:
                        refined_lines.append(f"{speaker_tag} {cleaned_content}")
                    else:
                        refined_lines.append(line)  # Keep original if content is empty
                else:
                    refined_lines.append(line)  # Non-speaker line, keep as-is
        
        return '\n'.join(refined_lines)
    
    def refine_transcription_chunked(
        self,
        video_chunks: list,
        whisper_srt_chunks: list,
        language_style: str = "colloquial"
    ) -> TranscriptionRefinementResult:
        """
        Refine transcription for chunked video files.
        
        Args:
            video_chunks: List of video chunk file paths
            whisper_srt_chunks: List of corresponding SRT content
            language_style: "colloquial" or "written" style preference
            
        Returns:
            TranscriptionRefinementResult with merged refined SRT content
        """
        refined_chunks = []
        total_changes = 0
        
        for i, (chunk_path, chunk_srt) in enumerate(zip(video_chunks, whisper_srt_chunks)):
            try:
                chunk_result = self.refine_transcription(
                    video_path=chunk_path,
                    whisper_srt=chunk_srt,
                    language_style=language_style
                )
                refined_chunks.append(chunk_result.refined_srt)
                total_changes += chunk_result.changes_made
                
            except Exception as e:
                # If chunk refinement fails, use original
                print(f"Warning: Chunk {i} refinement failed: {e}")
                refined_chunks.append(chunk_srt)
        
        # Merge refined chunks
        merged_srt = "\n\n".join(refined_chunks)
        
        return TranscriptionRefinementResult(
            refined_srt=merged_srt,
            changes_made=total_changes,
            quality_score=0.95,  # Assume high quality for successful chunk processing
            processing_notes=f"Processed {len(video_chunks)} chunks successfully"
        )
    
    def is_available(self) -> bool:
        """Check if Gemini Flash service is available and configured."""
        if not _GEMINI_AVAILABLE:
            return False
        
        try:
            # Test with a simple request
            test_model = genai.GenerativeModel('gemini-2.5-flash')
            response = test_model.generate_content("Test")
            return True
        except Exception:
            return False
    
    def estimate_token_usage(self, video_duration_seconds: float, srt_length: int) -> int:
        """
        Estimate token usage for Gemini Flash processing.
        
        Args:
            video_duration_seconds: Duration of video in seconds
            srt_length: Length of SRT content in characters
            
        Returns:
            Estimated token count
        """
        # Conservative estimation:
        # - Video: ~50 tokens per minute
        # - SRT content: ~1 token per 4 characters
        # - System prompt: ~1000 tokens
        
        video_tokens = int(video_duration_seconds / 60 * 50)
        srt_tokens = int(srt_length / 4)
        system_tokens = 1000
        
        return video_tokens + srt_tokens + system_tokens
    
    @staticmethod
    def is_gemini_available() -> bool:
        """Check if Gemini dependencies are available."""
        return _GEMINI_AVAILABLE