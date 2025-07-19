"""File-based subtitle repository implementation."""

import os
import shutil
from typing import Optional
from datetime import datetime
import srt

from ...domain.repositories import ISubtitleRepository
from ...domain.entities import SubtitleDocument, Subtitle
from ...domain.value_objects import FilePath, Timestamp


class FileSubtitleRepository(ISubtitleRepository):
    """Subtitle repository implementation using file system."""
    
    def __init__(self, create_backups: bool = True):
        """
        Initialize file subtitle repository.
        
        Args:
            create_backups: Whether to create backups of existing files
        """
        self.create_backups = create_backups
    
    def save_subtitle_document(
        self,
        subtitle_document: SubtitleDocument,
        output_path: FilePath,
        encoding: str = "utf-8"
    ) -> bool:
        """
        Save subtitle document to SRT file.
        
        Args:
            subtitle_document: Subtitle document to save
            output_path: Output file path
            encoding: Text encoding
            
        Returns:
            bool: True if save successful
            
        Raises:
            OSError: If file operations fail
            UnicodeError: If encoding fails
        """
        try:
            # Create output directory if needed
            output_dir = output_path.get_parent()
            if not output_dir.exists():
                os.makedirs(output_dir.path, exist_ok=True)
            
            # Generate SRT content
            srt_content = self.format_srt_content(subtitle_document)
            
            # Write to file
            with open(output_path.path, 'w', encoding=encoding) as f:
                f.write(srt_content)
            
            # Verify file was written
            if not output_path.exists() or output_path.get_size_bytes() == 0:
                raise OSError(f"Failed to write subtitle file: {output_path.path}")
            
            return True
            
        except (OSError, UnicodeError) as e:
            raise OSError(f"Failed to save subtitle file: {e}")
    
    def load_subtitle_document(
        self,
        input_path: FilePath,
        encoding: str = "utf-8"
    ) -> SubtitleDocument:
        """
        Load subtitle document from SRT file.
        
        Args:
            input_path: Path to SRT file
            encoding: Text encoding
            
        Returns:
            SubtitleDocument: Loaded subtitle document
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If SRT format is invalid
            UnicodeError: If encoding fails
        """
        try:
            # Validate file exists
            input_path.validate_exists()
            input_path.validate_is_file()
            
            # Read file content
            with open(input_path.path, 'r', encoding=encoding) as f:
                content = f.read()
            
            # Validate SRT format
            if not self.validate_srt_format(content):
                raise ValueError(f"Invalid SRT format: {input_path.path}")
            
            # Parse SRT content
            srt_subtitles = list(srt.parse(content))
            
            # Convert to domain entities
            subtitles = []
            for srt_sub in srt_subtitles:
                subtitle = Subtitle(
                    index=srt_sub.index,
                    start_time=Timestamp.from_timedelta(srt_sub.start),
                    end_time=Timestamp.from_timedelta(srt_sub.end),
                    content=srt_sub.content
                )
                subtitles.append(subtitle)
            
            # Create subtitle document
            return SubtitleDocument.create(
                subtitles=subtitles,
                source_file=input_path
            )
            
        except FileNotFoundError:
            raise FileNotFoundError(f"Subtitle file not found: {input_path.path}")
        except (OSError, UnicodeError) as e:
            raise UnicodeError(f"Failed to read subtitle file: {e}")
        except Exception as e:
            raise ValueError(f"Failed to parse subtitle file: {e}")
    
    def validate_srt_format(self, content: str) -> bool:
        """
        Validate SRT file format.
        
        Args:
            content: SRT file content
            
        Returns:
            bool: True if format is valid
        """
        try:
            # Try to parse the content
            subtitles = list(srt.parse(content))
            
            # Check if we got any subtitles
            if not subtitles:
                return False
            
            # Basic validation: check indices are sequential
            for i, subtitle in enumerate(subtitles, 1):
                if subtitle.index != i:
                    return False
            
            return True
            
        except Exception:
            return False
    
    def format_srt_content(self, subtitle_document: SubtitleDocument) -> str:
        """
        Format subtitle document as SRT content.
        
        Args:
            subtitle_document: Subtitle document to format
            
        Returns:
            str: Formatted SRT content
        """
        return subtitle_document.to_srt_content()
    
    def backup_existing_file(self, file_path: FilePath) -> Optional[FilePath]:
        """
        Create backup of existing file.
        
        Args:
            file_path: File to backup
            
        Returns:
            FilePath: Backup file path, None if no backup created
        """
        if not self.create_backups or not file_path.exists():
            return None
        
        try:
            # Generate backup filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{file_path.get_stem()}_backup_{timestamp}{file_path.get_extension()}"
            backup_path = file_path.get_parent().to_pathlib() / backup_name
            
            # Copy file to backup location
            shutil.copy2(file_path.path, str(backup_path))
            
            return FilePath.from_string(str(backup_path))
            
        except (OSError, IOError):
            # If backup fails, don't stop the main operation
            return None