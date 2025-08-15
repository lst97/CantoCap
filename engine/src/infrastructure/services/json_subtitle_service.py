"""
JSON subtitle service for converting SubtitleDocument to JSON format.
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from ...domain.entities.subtitle import SubtitleDocument
from ...application.commands.generate_subtitles_command import GenerateSubtitlesCommand
from ...infrastructure.error_handling import TranscriptionError


@dataclass
class JsonSubtitleMetadata:
    """Metadata for JSON subtitle export."""
    format: str = "CantoCap JSON Subtitle Export"
    version: str = "1.0"
    generated_at: str = ""
    settings: Dict[str, Any] = None
    statistics: Dict[str, Any] = None
    
    def __post_init__(self):
        if not self.generated_at:
            self.generated_at = datetime.now(timezone.utc).isoformat()
        if self.settings is None:
            self.settings = {}
        if self.statistics is None:
            self.statistics = {}


@dataclass
class JsonSubtitleEntry:
    """Individual subtitle entry in JSON format."""
    index: int
    start_time: float
    end_time: float
    duration: float
    caption: str
    translation: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "index": self.index,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "duration": self.duration,
            "caption": self.caption
        }
        
        if self.translation is not None:
            result["translation"] = self.translation
            
        return result


@dataclass
class JsonSubtitleDocument:
    """Complete JSON subtitle document."""
    metadata: JsonSubtitleMetadata
    subtitles: List[JsonSubtitleEntry]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "metadata": {
                "format": self.metadata.format,
                "version": self.metadata.version,
                "generatedAt": self.metadata.generated_at,
                "settings": self.metadata.settings,
                "statistics": self.metadata.statistics
            },
            "subtitles": [subtitle.to_dict() for subtitle in self.subtitles]
        }
    
    def to_json(self, indent: Optional[int] = None) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


class JsonSubtitleService:
    """Service for converting subtitle documents to JSON format."""
    
    def __init__(self):
        """Initialize the JSON subtitle service."""
        pass
    
    def convert_subtitle_document(
        self,
        subtitle_document: SubtitleDocument,
        command: GenerateSubtitlesCommand,
        statistics: Optional[Dict[str, Any]] = None
    ) -> JsonSubtitleDocument:
        """
        Convert a SubtitleDocument to JSON format.
        
        Args:
            subtitle_document: The subtitle document to convert
            command: The original command with settings
            statistics: Optional processing statistics
            
        Returns:
            JsonSubtitleDocument: The converted document
            
        Raises:
            TranscriptionError: If conversion fails
        """
        try:
            # Extract settings from command
            settings = self._extract_settings_from_command(command)
            
            # Process statistics
            processed_stats = self._process_statistics(subtitle_document, statistics)
            
            # Create metadata
            metadata = JsonSubtitleMetadata(
                settings=settings,
                statistics=processed_stats
            )
            
            # Convert subtitles
            json_subtitles = self._convert_subtitles(subtitle_document)
            
            return JsonSubtitleDocument(
                metadata=metadata,
                subtitles=json_subtitles
            )
            
        except Exception as e:
            raise TranscriptionError(
                f"Failed to convert subtitle document to JSON: {str(e)}",
                details={
                    "subtitle_count": subtitle_document.get_subtitle_count(),
                    "language": subtitle_document.get_language(),
                    "original_error": str(e)
                }
            ) from e
    
    def _extract_settings_from_command(self, command: GenerateSubtitlesCommand) -> Dict[str, Any]:
        """Extract relevant settings from the command."""
        settings = {
            "includeCantonese": True,  # Always true for CantoCap
            "includeEnglish": command.requires_translation(),
            "includeTimestampMetadata": False,  # Can be made configurable later
            "language": command.language,
            "charset": command.charset,
            "model_name": command.model_name
        }
        
        # Add advanced settings if enabled
        if command.has_phase2_features():
            settings.update({
                "enable_speakers": command.enable_speakers,
                "enable_written_style": command.enable_written_style,
                "enable_music_detection": command.enable_music_detection,
                "enable_gemini_refinement": command.enable_gemini_refinement
            })
        
        # Add translation settings if enabled
        if command.requires_translation():
            settings.update({
                "translation_language": command.translation_language,
                "enable_translation": command.enable_translation
            })
        
        return settings
    
    def _process_statistics(
        self,
        subtitle_document: SubtitleDocument,
        statistics: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Process and format statistics for JSON output."""
        basic_stats = {
            "totalSubtitles": subtitle_document.get_subtitle_count(),
            "totalDuration": round(subtitle_document.get_total_duration(), 2),
            "averageConfidence": 0.0  # Default, will be updated if available
        }
        
        if statistics:
            # Extract enhanced statistics if available
            if "quality_score" in statistics:
                basic_stats["qualityScore"] = round(statistics["quality_score"], 3)
            
            if "quality_grade" in statistics:
                basic_stats["qualityGrade"] = statistics["quality_grade"]
            
            if "processing_confidence" in statistics:
                basic_stats["averageConfidence"] = round(statistics["processing_confidence"], 3)
            
            # Add quality breakdown if available
            if "quality_breakdown" in statistics:
                basic_stats["qualityBreakdown"] = statistics["quality_breakdown"]
            
            # Add translation coverage if available
            if "translation_coverage" in statistics:
                basic_stats["translationCoverage"] = round(statistics["translation_coverage"], 3)
                
            # Add processing metadata
            if "algorithm_version" in statistics:
                basic_stats["algorithmVersion"] = statistics["algorithm_version"]
        
        return basic_stats
    
    def _convert_subtitles(self, subtitle_document: SubtitleDocument) -> List[JsonSubtitleEntry]:
        """Convert subtitle entries to JSON format."""
        json_subtitles = []
        
        for subtitle in subtitle_document.get_subtitles():
            # Extract translation if present (dual-language format)
            caption, translation = self._extract_dual_language_content(subtitle.get_content())
            
            entry = JsonSubtitleEntry(
                index=subtitle.get_index(),
                start_time=subtitle.get_start_time().seconds,
                end_time=subtitle.get_end_time().seconds,
                duration=subtitle.get_duration_seconds(),
                caption=caption,
                translation=translation
            )
            
            json_subtitles.append(entry)
        
        return json_subtitles
    
    def _extract_dual_language_content(self, content: str) -> tuple[str, Optional[str]]:
        """
        Extract caption and translation from dual-language content.
        
        Returns:
            tuple: (caption, translation) where translation is None if not present
        """
        import re
        
        # Check if this is dual-language content (contains both Chinese and English)
        chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
        english_pattern = re.compile(r'[a-zA-Z]+')
        
        has_chinese = bool(chinese_pattern.search(content))
        has_english = bool(english_pattern.search(content))
        
        if has_chinese and has_english:
            # Try to separate Chinese and English parts
            # This is a simplified approach - could be enhanced with better parsing
            lines = content.split('\n')
            chinese_lines = []
            english_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Skip speaker labels
                if line.startswith('[') and line.endswith(']'):
                    continue
                
                if chinese_pattern.search(line):
                    chinese_lines.append(line)
                elif english_pattern.search(line):
                    english_lines.append(line)
            
            caption = '\n'.join(chinese_lines) if chinese_lines else content
            translation = '\n'.join(english_lines) if english_lines else None
            
            return caption, translation
        else:
            # Single language content
            return content, None
    
    def create_json_response(
        self,
        subtitle_document: SubtitleDocument,
        command: GenerateSubtitlesCommand,
        statistics: Optional[Dict[str, Any]] = None,
        output_file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a complete JSON response for IPC communication.
        
        Args:
            subtitle_document: The subtitle document
            command: The original command
            statistics: Optional processing statistics
            output_file_path: Optional SRT file path for backward compatibility
            
        Returns:
            Dict: Complete JSON response for IPC
        """
        try:
            # Convert to JSON subtitle document
            json_doc = self.convert_subtitle_document(subtitle_document, command, statistics)
            
            # Create complete response
            response = {
                "subtitle_data": json_doc.to_dict(),
                "processing_info": {
                    "input_file": command.input_file_path,
                    "output_file": output_file_path,
                    "language": subtitle_document.get_language(),
                    "processing_time": statistics.get("processing_time", 0) if statistics else 0,
                    "success": True
                }
            }
            
            return response
            
        except Exception as e:
            # Return error response
            return {
                "subtitle_data": None,
                "processing_info": {
                    "input_file": command.input_file_path,
                    "output_file": output_file_path,
                    "success": False,
                    "error": str(e)
                }
            }