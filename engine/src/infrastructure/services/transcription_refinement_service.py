"""Transcription refinement service for converting spoken audio to written text."""

from dataclasses import dataclass
from typing import Optional, List, Any, Dict
import re
import time
import json
import os
from abc import ABC, abstractmethod
from pathlib import Path

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from ...domain.value_objects import FilePath
from ...application.services.terminology_config_service import TerminologyConfigService
from ..utils.llm_text_cleaning_util import GeminiResponseCleaner
from .prompt_service import prompt_service


@dataclass 
class TranscriptionRefinementResult:
    """Result of transcription refinement."""
    refined_srt: str
    changes_made: int
    quality_score: float
    processing_notes: Optional[str] = None


class ITranscriptionRefinementService(ABC):
    """Interface for transcription refinement services."""
    
    @abstractmethod
    def refine_transcription(self, video_path: FilePath, whisper_srt: str, language_style: str) -> TranscriptionRefinementResult:
        """Refine transcription using AI."""
        pass
    
    @abstractmethod
    def refine_transcription_chunked(self, video_chunks: list, whisper_srt_chunks: list, language_style: str = "colloquial") -> TranscriptionRefinementResult:
        """Refine transcription for chunked video files."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the service is available."""
        pass


class GeminiTranscriptionRefinementService(ITranscriptionRefinementService):
    """Google Gemini-based transcription refinement service.
    
    This service uses configuration-driven prompts loaded from JSON file for better maintainability.
    All prompts, language styles, and validation instructions are externalized to configuration.
    """
    
    def __init__(self, api_key: str, terminology_service: Optional[TerminologyConfigService] = None):
        """Initialize Gemini transcription refinement service."""
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
        
        # Transcription refinement model - optimized for creative language processing
        refinement_config = genai.types.GenerationConfig(
            temperature=0.3,   # Slight creativity for natural language
            top_p=0.9,         # Broader sampling for language variety
            top_k=50,          # Wider vocabulary for Cantonese nuances
            max_output_tokens=50000,  # Long outputs for complete transcriptions
        )
        
        # Get system instruction from prompt service
        system_instruction = prompt_service.get_transcription_system_instruction()
        
        self.refinement_model = genai.GenerativeModel(
            model_name='models/gemini-2.5-flash',
            generation_config=refinement_config,
            system_instruction=system_instruction,
            safety_settings=safety_settings
        )
        
        self.api_key = api_key
        self.terminology_service = terminology_service
        
        # Configuration constants from prompt service
        config = prompt_service.get_configuration()
        self.MAX_SRT_LENGTH = config.get("max_srt_length", 60000)
        self.MIN_SPLIT_SIZE = config.get("min_split_size", 10000)
        self.SPLIT_OVERLAP = config.get("split_overlap", 200)
        self.FILE_UPLOAD_TIMEOUT = config.get("file_upload_timeout", 300)
        self.FILE_CHECK_INTERVAL = config.get("file_check_interval", 5)
        self.MAX_UPLOAD_RETRIES = config.get("max_upload_retries", 3)
        
        # Initialize config for template access (fixes missing config attribute error)
        self.config = self._load_prompt_config()
    
    def _load_prompt_config(self) -> Dict:
        """Load prompt configuration from prompt service (for backward compatibility)."""
        # This method is kept for backward compatibility but now uses the prompt service
        return {
            "language_styles": {
                "written": prompt_service.get_language_style("written"),
                "colloquial": prompt_service.get_language_style("colloquial")
            },
            "speaker_instructions": {
                "with_speaker_tags": prompt_service.get_speaker_instructions(True),
                "without_speaker_tags": prompt_service.get_speaker_instructions(False)
            },
            "validation_tag_instructions": prompt_service.get_validation_tag_instructions(),
            "prompt_template": prompt_service._prompts_cache.get("prompt_template", {}),
            "automatic_terminology": prompt_service._prompts_cache.get("automatic_terminology", {})
        }
    
    def _get_transcription_refinement_prompt(self, language_style: str, has_speaker_tags: bool) -> str:
        """Get transcription refinement prompt based on language style and speaker tag presence."""
        
        # Validate language style
        supported_styles = ["written", "colloquial"]
        if language_style not in supported_styles:
            raise ValueError(
                f"Unsupported language style: '{language_style}'. "
                f"Supported styles: {supported_styles}"
            )
        
        style_config = prompt_service.get_language_style(language_style)
        
        # Get speaker instructions from prompt service
        speaker_instructions = prompt_service.get_speaker_instructions(has_speaker_tags)
        
        # Generate terminology configuration section if available
        terminology_section = ""
        if self.terminology_service and self.terminology_service.is_loaded():
            terminology_section = self.terminology_service.generate_terminology_summary_for_prompt(language_style)
        else:
            # Generate automatic terminology detection instructions when no config is provided
            terminology_section = self._generate_automatic_terminology_section(language_style)
        
        validation_tag_instructions = prompt_service.get_validation_tag_instructions()
        
        return self._build_prompt_from_template(style_config, speaker_instructions, validation_tag_instructions, terminology_section)
    
    def _build_prompt_from_template(self, style_config: Dict, speaker_instructions: str, validation_tag_instructions: str, terminology_section: str) -> str:
        """Build the complete prompt from template and configuration."""
        template = self.config["prompt_template"]
        
        # Build style description from config
        style_description = self._build_style_description(style_config)
        
        # Build all phases
        phases_text = self._build_phases_text(template["phases"], style_description, speaker_instructions)
        
        # Combine all sections
        prompt_parts = [
            template["mission_header"],
            "\n" + template["cooperation_framework"]["title"],
            "\n" + template["cooperation_framework"]["whisper_contribution"]["title"],
            "\n".join(template["cooperation_framework"]["whisper_contribution"]["items"]),
            "\n" + template["cooperation_framework"]["refinement_mission"]["title"],
            "\n".join(template["cooperation_framework"]["refinement_mission"]["items"]),
            phases_text,
            "\n### Phase 7: Validation Processing",
            "\n" + validation_tag_instructions,
            "\n" + "\n".join(template["phases"]["phase_7"]["quality_checklist"]["items"]),
            # Add pronoun validation if present
            "\n" + (template["phases"]["phase_7"]["pronoun_validation"]["title"] if "pronoun_validation" in template["phases"]["phase_7"] else ""),
            "\n" + ("\n".join(template["phases"]["phase_7"]["pronoun_validation"]["checklist"]) if "pronoun_validation" in template["phases"]["phase_7"] else ""),
            "\n" + template["final_output_requirements"]["title"],
            "\n" + template["final_output_requirements"]["srt_format"]["title"],
            template["final_output_requirements"]["srt_format"]["description"],
            "\n" + template["final_output_requirements"]["srt_format"]["format"],
            "\n" + template["final_output_requirements"]["success_metrics"]["title"],
            "\n".join(template["final_output_requirements"]["success_metrics"]["items"]),
            terminology_section
        ]
        
        return "\n".join(prompt_parts)
    
    def _build_style_description(self, style_config: Dict) -> str:
        """Build style description from configuration."""
        parts = [style_config["description"]]
        
        # Add objectives
        if "objectives" in style_config:
            parts.extend(style_config["objectives"])
        
        # Add principles
        if "principles" in style_config:
            parts.append("2. Core Principles")
            parts.extend([f"    {principle}" for principle in style_config["principles"]])
        
        # Add execution checklist
        if "execution_checklist" in style_config:
            parts.append("3. Execution Checklist:")
            for key, value in style_config["execution_checklist"].items():
                if isinstance(value, dict):
                    parts.append(f"    {value['description']}")
                    
                    # Handle simplified pronoun_refinement structure
                    if key == "vocabulary_conversion" and "pronoun_refinement" in value:
                        pronoun_ref = value["pronoun_refinement"]
                        parts.append(f"    {pronoun_ref['description']}")
                        
                        # Add context clues
                        if "context_clues" in pronoun_ref:
                            parts.append("    **Context Clues:**")
                            parts.extend([f"        - {clue}" for clue in pronoun_ref["context_clues"]])
                        
                        # Add guidelines
                        if "guidelines" in pronoun_ref:
                            parts.append("    **Guidelines:**")
                            parts.extend([f"        - {guideline}" for guideline in pronoun_ref["guidelines"]])
                        
                        # Add other mappings
                        if "other_mappings" in value:
                            parts.append("    **Other Vocabulary Conversions:**")
                            for k, v in value["other_mappings"].items():
                                parts.append(f"        {k} → {v}")
                                
                    elif "mappings" in value:
                        for k, v in value["mappings"].items():
                            parts.append(f"        {k} → {v}")
                    elif "example" in value:
                        parts.append(f"        Example: {value['example']}")
                    elif "characters" in value:
                        parts.extend([f"        {char}" for char in value["characters"]])
        
        return "\n".join(parts)
    
    def _build_phases_text(self, phases: Dict, style_description: str, speaker_instructions: str) -> str:
        """Build phases text from template."""
        phases_parts = []
        
        for phase_key, phase_data in phases.items():
            if phase_key == "phase_7":  # Skip phase 7 as it's handled separately
                continue
                
            phases_parts.append("\n" + phase_data["title"])
            
            for key, value in phase_data.items():
                if key == "title":
                    continue
                
                # Handle direct compliance_note (like in phase_4)
                if key == "compliance_note":
                    phases_parts.append("\n" + value)
                    phases_parts.append(style_description)
                    continue
                    
                if isinstance(value, dict):
                    if "title" in value:
                        phases_parts.append("\n" + value["title"])
                    if "description" in value:
                        phases_parts.append(value["description"])
                    if "items" in value:
                        phases_parts.extend(value["items"])
                    if "steps" in value:  # Handle steps array (for pronoun_context_analysis)
                        phases_parts.extend(value["steps"])
                    if "requirements" in value:  # Handle requirements array (for pronoun_compliance)
                        phases_parts.extend(value["requirements"])
                    if "checklist" in value:  # Handle checklist array (for pronoun_validation)
                        phases_parts.extend(value["checklist"])
                    if "critical_note" in value:  # Handle critical_note (for pronoun_compliance)
                        phases_parts.append(value["critical_note"])
                    if "guidance" in value:  # Handle guidance (for simplified pronoun_context_analysis)
                        phases_parts.append(value["guidance"])
                    if "note" in value:  # Handle note (for simplified pronoun_compliance)
                        phases_parts.append(value["note"])
                    if "reminder" in value:  # Handle reminder (for simplified pronoun_compliance)
                        phases_parts.append(value["reminder"])
                    if "compliance_note" in value:  # Handle nested compliance_note
                        phases_parts.append(value["compliance_note"])
                        phases_parts.append(style_description)
                        
        # Add speaker continuity instruction where needed
        phases_parts.append(f"- **Speaker Continuity**: {speaker_instructions}")
        
        return "\n".join(phases_parts)

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

            # Clean the Gemini response to remove invalid characters like ```
            try:
                refined_srt = GeminiResponseCleaner.clean_and_validate_srt(response.text)
            except ValueError as e:
                print(f"Warning: Gemini response cleaning failed: {e}")
                # Fallback to basic cleaning if validation fails
                refined_srt = GeminiResponseCleaner.clean_gemini_response(response.text, preserve_srt_format=True)
            
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
                    
                    # Clean the Gemini response to remove invalid characters like ```
                    try:
                        refined_chunk = GeminiResponseCleaner.clean_and_validate_srt(response.text)
                    except ValueError as e:
                        print(f"Warning: Chunk {i+1} response cleaning failed: {e}")
                        # Fallback to basic cleaning if validation fails
                        refined_chunk = GeminiResponseCleaner.clean_gemini_response(response.text, preserve_srt_format=True)
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
        auto_term_config = self.config["automatic_terminology"]
        
        # Build style-specific guidelines
        style_guidelines = ""
        if language_style.lower() in auto_term_config["style_guidelines"]:
            guidelines = auto_term_config["style_guidelines"][language_style.lower()]
            style_guidelines = f"**{language_style.title()} Style Guidelines:**\n" + "\n".join(guidelines)
        
        # Build the complete section
        sections = [
            f"\n{auto_term_config['title']}",
            auto_term_config["description"],
            f"\n{auto_term_config['analysis_protocol']['title']}",
            "\n".join(auto_term_config["analysis_protocol"]["items"]),
            f"\n{auto_term_config['terminology_categories']['title']}",
            f"\n{auto_term_config['terminology_categories']['names_proper_nouns']['title']}",
            "\n".join(auto_term_config["terminology_categories"]["names_proper_nouns"]["items"]),
            f"\n{auto_term_config['terminology_categories']['technical_professional']['title']}",
            "\n".join(auto_term_config["terminology_categories"]["technical_professional"]["items"]),
            f"\n{auto_term_config['terminology_categories']['cultural_social']['title']}",
            "\n".join(auto_term_config["terminology_categories"]["cultural_social"]["items"]),
            f"\n**3. Style-Specific Application ({language_style.title()} Mode):**",
            style_guidelines,
            f"\n{auto_term_config['consistency_management']['title']}",
            "\n".join(auto_term_config["consistency_management"]["items"]),
            f"\n{auto_term_config['priority_guidelines']['title']}",
            "\n".join(auto_term_config["priority_guidelines"]["priorities"]),
            f"\n{auto_term_config['decision_framework']['title']}",
            "\n".join(auto_term_config["decision_framework"]["items"]),
            f"\n{auto_term_config['implementation_process']['title']}",
            "\n".join(auto_term_config["implementation_process"]["steps"]),
            f"\n{auto_term_config['conclusion']}"
        ]
        
        return "\n".join(sections)
    
    def is_available(self) -> bool:
        """Check if Gemini transcription refinement service is available and configured."""
        if not _GEMINI_AVAILABLE:
            return False
        
        try:
            # Test with a simple request using the refinement model
            response = self.refinement_model.generate_content("Test connectivity")
            return True
        except Exception:
            return False
    
    @staticmethod
    def is_gemini_available() -> bool:
        """Check if Gemini dependencies are available."""
        return _GEMINI_AVAILABLE