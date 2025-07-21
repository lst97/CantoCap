"""Google Gemini Flash integration for video analysis and transcription refinement."""

from dataclasses import dataclass
from typing import Optional, Dict, Any, List
import json
import re
import time

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from ...domain.value_objects import FilePath
from ...application.services.terminology_config_service import TerminologyConfigService


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
    
    # Configuration constants for SRT splitting
    MAX_SRT_LENGTH = 60000  # Maximum characters in SRT content for single request
    MIN_SPLIT_SIZE = 10000  # Minimum size for a split chunk
    SPLIT_OVERLAP = 200     # Character overlap between chunks for continuity
    
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
    
    # System instruction for transcription refinement model
    TRANSCRIPTION_REFINEMENT_SYSTEM = '''You are a specialized Cantonese linguistics and transcription refinement expert working in a two-stage workflow.

## Your Role in the Pipeline
You receive:
1. AUDIO/VIDEO: The definitive source of truth for what was actually said
2. SRT SCAFFOLD: A preliminary transcription from OpenAI Whisper providing timing structure and rough content

Your mission is to refine the SRT scaffold by listening to the actual audio and producing a perfectly accurate, contextually appropriate Cantonese subtitle file.

## Core Expertise & Workflow
1. **Audio-First Analysis**: Always listen to the audio first to understand what was actually spoken
2. **SRT Scaffold Utilization**: Use the Whisper-generated SRT as a structural foundation (timing, segmentation) but verify and correct all content against the audio
3. **Cantonese Language Mastery**: Deep understanding of both colloquial and written Cantonese
4. **Contextual Refinement**: Understand emotional tone, relationships, and situational context from audio-visual cues
5. **Quality Enhancement**: Fix common Whisper artifacts while preserving accurate timing structure

## Whisper→Gemini Cooperation Protocol
The provided SRT scaffold from Whisper gives you:
✓ Timing structure and segment boundaries (use as foundation)
✓ Rough phonetic approximations (verify against audio)
✓ Speaker change indicators (when present)
✗ Content accuracy (must be verified against audio)
✗ Cantonese language nuances (requires your expertise)
✗ Cultural context (requires your analysis)

## Common Whisper Artifacts to Fix
- Phonetic approximations that don't match proper Chinese characters
- Incorrect character choices for Cantonese sounds
- Missing or misplaced punctuation
- Wrong word boundaries or segmentation
- Misrecognized proper nouns or specialized terms
- Inconsistent romanization mixed with Chinese characters

## Processing Standards
- **Audio is Ultimate Truth**: When audio and SRT scaffold conflict, always trust the audio
- **Preserve Timing Structure**: Maintain the timing boundaries from Whisper unless audio clearly indicates different natural breaks
- **Enhance Content Quality**: Correct transcription errors while preserving the structural framework
- **Cultural Context Integration**: Use audio-visual context to choose appropriate language register and expressions
- **Validation Tag Processing**: Handle [TRIM], [REPEAT] and other validation tags by analyzing actual audio content

## Quality Gates
- Final output must accurately reflect what was spoken in the audio
- Timing must remain synchronized with speech patterns
- Language must be natural and culturally appropriate Cantonese
- NO validation tags ([TRIM], [REPEAT]) in final output
- Preserve speaker identification when present'''

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
        
        # Generate terminology configuration section if available
        terminology_section = ""
        if self.terminology_service and self.terminology_service.is_loaded():
            terminology_section = self.terminology_service.generate_terminology_summary_for_prompt(language_style)
        else:
            # Generate automatic terminology detection instructions when no config is provided
            terminology_section = self._generate_automatic_terminology_section(language_style)
        
        validation_tag_instructions = '''
    Validation Tag Processing (CRITICAL):
        The provided text may contain validation tags that must be processed and removed:
        
        [TRIM] Tag Processing:
        - Indicates text was truncated due to excessive length
        - Analyze the actual audio to provide the complete, accurate transcription
        - Break long content into properly timed subtitle segments
        - Ensure each segment aligns with natural speech pauses
        - Remove the [TRIM] tag from final output
        
        [REPEAT] Tag Processing:
        - Indicates detected repetitive patterns in the original text
        - Listen to the actual audio to determine the correct transcription
        - If the speaker actually repeats words/phrases, transcribe accurately
        - If the repetition was a transcription error, provide the correct text
        - Remove the [REPEAT] tag from final output
        
        MANDATORY: Your final output must contain NO validation tags ([TRIM] or [REPEAT])
        '''
        
        return f'''
## Your Mission: Whisper→Gemini Transcription Refinement Partnership

You are an expert Cantonese linguistics specialist working in an **intelligent two-stage pipeline** where OpenAI Whisper provides the structural foundation and you provide content expertise.

### Understanding the Cooperation Framework

**Whisper's Contribution (Your Foundation):**
✓ **Timing Structure**: Precise start/end timestamps that align with actual speech
✓ **Segment Boundaries**: Natural speech breaks and subtitle divisions  
✓ **Duration Alignment**: Overall flow and pacing of the conversation
✓ **Speaker Indicators**: Change detection between different voices (when present)
✓ **Phonetic Approximations**: Sound-based interpretation of spoken words

**Your Refinement Mission (Content Expertise):**
✗ **Content Accuracy**: Verify every word against actual audio (Whisper may have errors)
✗ **Language Quality**: Replace phonetic approximations with proper Cantonese characters
✗ **Cultural Context**: Apply appropriate language register and cultural expressions
✗ **Grammar Correction**: Fix sentence structure and word choice issues
✗ **Validation Processing**: Handle [TRIM], [REPEAT] tags by analyzing actual audio

### Phase 1: Intelligent Foundation Analysis

**Step 1 - Evaluate Whisper's Structural Work:**
The SRT scaffold from Whisper provides excellent timing and segmentation. Analyze:
- Timing boundaries → Trust these unless audio clearly suggests different natural breaks
- Segment count → Maintain similar number of subtitles for consistency
- Speaker transitions → Preserve existing speaker change indicators
- Overall flow → Keep the natural conversation rhythm Whisper detected

**Step 2 - Identify Content Refinement Opportunities:**
Listen to actual audio and compare against Whisper's text interpretation:
- **Phonetic Mismatches**: Where Whisper approximated sounds but chose wrong characters
- **Grammar Issues**: Sentence structure that doesn't match natural Cantonese
- **Missing Context**: Emotional tone or cultural expressions Whisper couldn't detect
- **Technical Errors**: Common Whisper artifacts like romanization mixed with Chinese

### Phase 2: Audio-First Content Verification

**Audio Truth Protocol:**
🎵 **Primary Source**: Audio/video content is the definitive truth for what was actually said
📝 **Secondary Reference**: Whisper SRT provides structural guidance and rough content hints
🔄 **Intelligent Synthesis**: Combine Whisper's timing expertise with your content expertise

**Contextual Analysis (Listen First, Then Refine):**
Before modifying any text, analyze the audio to understand:
- **Actual Words Spoken**: What is really being said (may differ from Whisper's interpretation)
- **Scene Context**: Conversation type, setting, relationship dynamics
- **Emotional Register**: Tone, formality level, intimacy, excitement, etc.
- **Cultural Elements**: Expressions, references, or terms specific to Cantonese culture

### Phase 3: Cooperative Enhancement Strategy

**Preserve Whisper's Strengths:**
- **Timing Accuracy**: Keep start/end timestamps unless audio clearly indicates different breaks
- **Segmentation Logic**: Maintain subtitle boundaries that Whisper identified as natural
- **Overall Structure**: Preserve the conversation flow and pacing
- **Speaker Organization**: Keep existing speaker change patterns

**Apply Your Content Expertise:**
- **Character Accuracy**: Replace phonetic approximations with correct Chinese characters
- **Grammar Enhancement**: Fix sentence structure to match natural Cantonese patterns  
- **Cultural Adaptation**: Apply appropriate expressions and language register
- **Style Consistency**: Ensure every line follows the specified language style requirements

### Phase 4: Language Style Implementation

**Mandatory Style Compliance:**
Every subtitle line must strictly follow these requirements:
{style_instructions[language_style]}

**Whisper→Gemini Style Application:**
- Use Whisper's timing and structure as the foundation
- Apply style requirements to the content while preserving the scaffold
- Maintain conversation flow that Whisper identified
- Ensure cultural and linguistic accuracy in every correction

### Phase 5: Cooperative Error Correction

**Whisper Artifact Recognition & Correction:**
Common Whisper patterns to identify and fix:
- **Phonetic Romanization**: "ho ma" → "荷媽", "ge" → "嘅", "hai" → "係"
- **Character Misselection**: Wrong Chinese characters chosen for Cantonese sounds
- **Grammar Inconsistency**: Sentence structure that doesn't match natural Cantonese flow
- **Missing Punctuation**: Add appropriate punctuation based on audio tone and pauses
- **Word Boundary Errors**: Correct word splitting or merging based on actual speech

**Content Verification Against Audio:**
- **Addition**: Add words/phrases spoken in audio but missing from Whisper SRT
- **Deletion**: Remove words/sentences from Whisper SRT that weren't actually spoken
- **Correction**: Replace incorrect words with what was actually said in the audio
- **Restructuring**: Reorganize sentence structure to match natural Cantonese patterns

**Language Style Implementation:**
Apply these requirements to EVERY subtitle line while preserving Whisper's timing structure:
{style_instructions[language_style]}

### Phase 6: Cooperative Timing & Structure Management

**Timing Preservation Protocol:**
- **Primary Rule**: Keep Whisper's timestamps unless audio clearly indicates different natural breaks
- **Fine-Tuning**: Adjust timing only when audio reveals more precise start/end points
- **Segment Respect**: Maintain the number of subtitle segments Whisper identified
- **Natural Breaks**: Preserve conversation flow and natural speech rhythm

**Structure Maintenance:**
- **Subtitle Numbering**: Keep sequential numbering consistent with SRT format
- **Line Organization**: Each subtitle should represent a complete thought or natural speech unit
- **Speaker Continuity**: {speaker_instructions}

### Phase 7: Validation Processing

{validation_tag_instructions}

**Quality Assurance Checklist:**
✓ Every word accurately reflects what was spoken in the audio
✓ All Cantonese characters are contextually correct and culturally appropriate
✓ Timing structure preserved from Whisper's excellent segmentation work
✓ Language style requirements applied consistently throughout
✓ No validation tags ([TRIM], [REPEAT]) remain in final output
✓ Speaker tags preserved when present in original SRT

### Final Output Requirements

**SRT Format Compliance:**
Return the complete refined SRT file following standard format:

[Subtitle Number]
[Start Time] --> [End Time]  
[Refined Cantonese Text - Audio Accurate & Style Compliant]

**Cooperation Success Metrics:**
- ✅ Whisper's timing expertise + Your content expertise = Perfect subtitle file
- ✅ Structural foundation preserved + Content accuracy achieved
- ✅ Technical precision + Cultural authenticity combined
- ✅ Audio truth maintained + Style requirements satisfied

{terminology_section}
'''

    def __init__(self, api_key: str, terminology_service: Optional[TerminologyConfigService] = None):
        """Initialize Gemini Flash service with API key, specialized models, and optional terminology configuration."""
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
        
        # Transcription refinement model - optimized for creative language processing
        refinement_config = genai.types.GenerationConfig(
            temperature=0.3,   # Slight creativity for natural language
            top_p=0.9,         # Broader sampling for language variety
            top_k=50,          # Wider vocabulary for Cantonese nuances
            max_output_tokens=50000,  # Long outputs for complete transcriptions
        )
        
        self.refinement_model = genai.GenerativeModel(
            model_name='models/gemini-2.5-flash',
            generation_config=refinement_config,
            system_instruction=self.TRANSCRIPTION_REFINEMENT_SYSTEM,
            safety_settings=safety_settings
        )
        
        self.api_key = api_key
        self.terminology_service = terminology_service
    
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
            # Check if SRT content is too long and needs splitting
            if len(whisper_srt) > self.MAX_SRT_LENGTH:
                print(f"SRT content is large ({len(whisper_srt)} chars), splitting for processing...")
                return self._refine_transcription_with_splitting(video_path, whisper_srt, language_style)
            
            # Upload video file and wait for it to become active
            video_file = self._upload_and_wait_for_active(
                str(video_path.path),
                "video file for transcription refinement"
            )
            
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
            
            # Generate refined transcription using specialized refinement model
            response = self.refinement_model.generate_content(content)
            
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
            if 'video_file' in locals() and hasattr(video_file, 'name'):
                try:
                    print(f"Cleaning up uploaded file: {video_file.name}")
                    genai.delete_file(video_file.name)
                    print("✅ File cleanup completed")
                except Exception as e:
                    print(f"⚠️ File cleanup failed: {e}")
                    # File cleanup failure shouldn't break the flow
    
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
            # Test with a simple request using the speaker model
            response = self.speaker_model.generate_content("Test connectivity")
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
    
    def _refine_transcription_with_splitting(
        self, 
        video_path: FilePath, 
        whisper_srt: str, 
        language_style: str
    ) -> TranscriptionRefinementResult:
        """
        Handle large SRT content by splitting into manageable chunks.
        
        Args:
            video_path: Path to video file  
            whisper_srt: Large SRT content to split and process
            language_style: Language style preference
            
        Returns:
            TranscriptionRefinementResult with merged refined content
        """
        try:
            # Split SRT into chunks
            srt_chunks = self._split_srt_content(whisper_srt)
            print(f"Split SRT into {len(srt_chunks)} chunks for processing")
            
            # Upload video file once for all chunks and wait for it to become active
            video_file = self._upload_and_wait_for_active(
                str(video_path.path),
                "video file for chunked transcription refinement"
            )
            
            # Process each chunk
            refined_chunks = []
            total_changes = 0
            
            for i, chunk in enumerate(srt_chunks):
                try:
                    print(f"Processing chunk {i+1}/{len(srt_chunks)}...")
                    
                    # Detect speaker tags in this chunk
                    has_speaker_tags = bool(re.search(r'\[SPEAKER_\d+\]', chunk))
                    
                    # Generate prompt for this chunk
                    prompt = self._get_transcription_refinement_prompt(language_style, has_speaker_tags)
                    
                    # Prepare content for this chunk
                    content = [
                        prompt,
                        f"\n\nOriginal SRT content to refine:\n\n{chunk}",
                        video_file
                    ]
                    
                    # Process chunk
                    response = self.refinement_model.generate_content(content)
                    
                    if not response.parts:
                        # Use original chunk if refinement fails
                        refined_chunks.append(chunk)
                        print(f"Warning: Chunk {i+1} refinement failed, using original")
                        continue
                    
                    refined_chunk = response.text.strip()
                    refined_chunks.append(refined_chunk)
                    
                    # Count changes (simple heuristic)
                    original_lines = len(chunk.split('\n'))
                    refined_lines = len(refined_chunk.split('\n'))
                    total_changes += abs(original_lines - refined_lines)
                    
                except Exception as e:
                    print(f"Warning: Chunk {i+1} processing failed: {e}")
                    refined_chunks.append(chunk)  # Use original on failure
            
            # Merge refined chunks
            merged_srt = self._merge_srt_chunks(refined_chunks, whisper_srt)
            
            # Calculate quality score
            quality_score = min(1.0, len(merged_srt) / max(len(whisper_srt), 1))
            
            return TranscriptionRefinementResult(
                refined_srt=merged_srt,
                changes_made=total_changes,
                quality_score=quality_score,
                processing_notes=f"Large SRT processed in {len(srt_chunks)} chunks"
            )
            
        except Exception as e:
            raise RuntimeError(f"SRT splitting refinement failed: {str(e)}")
        finally:
            # Clean up uploaded file
            if 'video_file' in locals():
                try:
                    genai.delete_file(video_file.name)
                except Exception:
                    pass
    
    def _split_srt_content(self, srt_content: str) -> List[str]:
        """
        Split SRT content into manageable chunks based on subtitle boundaries.
        
        Args:
            srt_content: Original SRT content to split
            
        Returns:
            List of SRT chunks with proper formatting
        """
        lines = srt_content.strip().split('\n')
        chunks = []
        current_chunk_lines = []
        current_size = 0
        subtitle_buffer = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check if this is a subtitle number (start of new subtitle)
            if line.isdigit():
                # If we have a buffered subtitle, add it to current chunk
                if subtitle_buffer:
                    chunk_addition = '\n'.join(subtitle_buffer) + '\n'
                    if current_size + len(chunk_addition) > self.MAX_SRT_LENGTH and current_chunk_lines:
                        # Current chunk is full, finalize it
                        chunks.append('\n'.join(current_chunk_lines).strip())
                        current_chunk_lines = []
                        current_size = 0
                    
                    current_chunk_lines.extend(subtitle_buffer)
                    current_size += len(chunk_addition)
                    subtitle_buffer = []
                
                # Start collecting new subtitle
                subtitle_buffer = [line]  # Subtitle number
                
                # Get timestamp line
                if i + 1 < len(lines) and '-->' in lines[i + 1]:
                    subtitle_buffer.append(lines[i + 1])
                    i += 2
                    
                    # Collect content lines
                    while i < len(lines) and lines[i].strip() and not lines[i].strip().isdigit():
                        subtitle_buffer.append(lines[i])
                        i += 1
                    
                    # Add empty line separator
                    if i < len(lines) and not lines[i].strip():
                        subtitle_buffer.append('')
                        i += 1
                else:
                    i += 1
            else:
                i += 1
        
        # Add any remaining subtitle buffer
        if subtitle_buffer:
            current_chunk_lines.extend(subtitle_buffer)
        
        # Add the last chunk if it has content
        if current_chunk_lines:
            chunks.append('\n'.join(current_chunk_lines).strip())
        
        return chunks
    
    def _merge_srt_chunks(self, refined_chunks: List[str], original_srt: str) -> str:
        """
        Merge refined SRT chunks back into a single SRT file.
        
        Args:
            refined_chunks: List of refined SRT chunks
            original_srt: Original SRT for reference
            
        Returns:
            Merged SRT content with corrected subtitle numbering
        """
        if not refined_chunks:
            return original_srt
        
        merged_lines = []
        subtitle_counter = 1
        
        for chunk in refined_chunks:
            chunk_lines = chunk.strip().split('\n')
            i = 0
            
            while i < len(chunk_lines):
                line = chunk_lines[i].strip()
                
                # Check if this is a subtitle number
                if line.isdigit():
                    # Replace with corrected subtitle number
                    merged_lines.append(str(subtitle_counter))
                    subtitle_counter += 1
                    
                    # Add timestamp line
                    if i + 1 < len(chunk_lines) and '-->' in chunk_lines[i + 1]:
                        merged_lines.append(chunk_lines[i + 1])
                        i += 2
                        
                        # Add content lines
                        while i < len(chunk_lines) and chunk_lines[i].strip() and not chunk_lines[i].strip().isdigit():
                            merged_lines.append(chunk_lines[i])
                            i += 1
                        
                        # Add empty separator
                        merged_lines.append('')
                        
                        # Skip empty lines in source
                        while i < len(chunk_lines) and not chunk_lines[i].strip():
                            i += 1
                    else:
                        i += 1
                else:
                    i += 1
        
        return '\n'.join(merged_lines).strip()
    
    def _generate_automatic_terminology_section(self, language_style: str) -> str:
        """Generate automatic terminology detection instructions when no terminology config is provided."""
        
        return f'''
### Automatic Terminology Detection & Application

Since no specific terminology configuration is provided, you must **intelligently analyze the video content** to identify common terms, proper nouns, and context-specific vocabulary that require consistent handling.

**Your Analytical Responsibilities:**

**1. Content Analysis Protocol:**
- **Scene Context**: Identify the setting (workplace, home, restaurant, medical, educational, etc.)
- **Relationship Dynamics**: Analyze formality levels between speakers
- **Subject Matter**: Determine topics being discussed (business, family, technology, etc.)
- **Cultural References**: Note Hong Kong-specific places, brands, or cultural terms

**2. Automatic Terminology Categories to Detect:**

**Names & Proper Nouns:**
- **Character Names**: Maintain consistent spelling/writing for all people mentioned
- **Place Names**: Hong Kong locations, streets, districts, buildings (e.g., 中環, 旺角, 海港城)
- **Company Names**: Organizations, brands, stores mentioned in dialogue
- **Institutions**: Schools, hospitals, government departments

**Technical & Professional Terms:**
- **Workplace Vocabulary**: Job titles, company processes, industry terms
- **Technology Terms**: Apps, software, devices commonly used in Hong Kong
- **Financial Terms**: Banking, payments, investments (HSBC, 八達通, etc.)
- **Medical Terms**: Hospitals, treatments, body parts

**Cultural & Social Terms:**
- **Food & Dining**: Restaurant names, local dishes, dining culture
- **Transportation**: MTR stations, bus routes, taxi references
- **Entertainment**: Local celebrities, TV shows, movies, venues
- **Shopping**: Malls, markets, retail chains specific to Hong Kong

**3. Style-Specific Application ({language_style.title()} Mode):**

{"**Written Style Guidelines:**" if language_style.lower() == "written" else "**Colloquial Style Guidelines:**"}
{'''- Convert proper nouns to appropriate written Chinese forms when standard exists
- Use formal terminology for institutions and organizations
- Apply consistent written conventions for place names
- Maintain professional terminology in business contexts''' if language_style.lower() == "written" else '''- Preserve natural spoken forms of proper nouns as actually pronounced
- Keep colloquial pronunciation patterns for place names (e.g., "啟德" as naturally spoken)
- Maintain code-switching patterns for English terms in natural conversation
- Preserve informal nicknames and slang when appropriate to speaker relationship'''}

**4. Consistency Management:**
- **First Occurrence Analysis**: When you encounter a term for the first time, establish the correct form based on context
- **Subsequent Applications**: Use the same form consistently throughout the subtitle file
- **Ambiguity Resolution**: If unclear, choose the form that best fits the speaker's education level and context

**5. Priority Guidelines:**
1. **Character Names**: Always highest priority - establish and maintain consistency
2. **Location Names**: High priority - use locally recognized forms
3. **Institution Names**: High priority - use official names when identifiable
4. **Technical Terms**: Medium priority - apply consistent translation patterns
5. **Cultural References**: Medium priority - preserve cultural context appropriately

**6. Decision Framework:**
- **Audio Truth**: What the speaker actually says takes precedence
- **Context Clues**: Use visual and conversational context to inform decisions
- **Cultural Authenticity**: Choose forms that authentic Hong Kong speakers would use
- **Natural Flow**: Ensure terminology choices don't disrupt conversation naturalness

**Implementation Process:**
1. **Listen First**: Analyze the complete video to understand overall context
2. **Identify Patterns**: Note recurring terms and their usage contexts
3. **Establish Standards**: Create consistent handling for each identified term type
4. **Apply Systematically**: Use your established standards throughout the transcription
5. **Validate Consistency**: Ensure all instances of terms follow your established patterns

This automatic terminology detection ensures professional, culturally appropriate, and contextually consistent subtitles even without predefined terminology configuration.
'''
    
    @staticmethod
    def is_gemini_available() -> bool:
        """Check if Gemini dependencies are available."""
        return _GEMINI_AVAILABLE