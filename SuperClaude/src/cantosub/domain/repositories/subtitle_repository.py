"""Subtitle repository interface for SRT file operations."""

from abc import ABC, abstractmethod
from typing import Optional

from ..entities import SubtitleDocument
from ..value_objects import FilePath


class ISubtitleRepository(ABC):
    """Interface for subtitle file operations."""
    
    @abstractmethod
    def save_subtitle_document(
        self,
        subtitle_document: SubtitleDocument,
        output_path: FilePath,
        encoding: str = "utf-8"
    ) -> bool:
        """
        Save subtitle document to SRT file.
        
        Args:
            subtitle_document: The subtitle document to save
            output_path: Where to save the SRT file
            encoding: Text encoding (default: utf-8)
            
        Returns:
            bool: True if save successful
            
        Raises:
            FileWriteError: If cannot write to output path
            PermissionError: If insufficient permissions
            EncodingError: If text encoding fails
        """
        pass
    
    @abstractmethod
    def load_subtitle_document(
        self,
        input_path: FilePath,
        encoding: str = "utf-8"
    ) -> SubtitleDocument:
        """
        Load subtitle document from SRT file.
        
        Args:
            input_path: Path to SRT file to load
            encoding: Text encoding (default: utf-8)
            
        Returns:
            SubtitleDocument: The loaded subtitle document
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ParseError: If SRT format is invalid
            EncodingError: If text encoding fails
        """
        pass
    
    @abstractmethod
    def validate_srt_format(self, content: str) -> bool:
        """
        Validate SRT file format.
        
        Args:
            content: SRT file content to validate
            
        Returns:
            bool: True if format is valid
        """
        pass
    
    @abstractmethod
    def format_srt_content(self, subtitle_document: SubtitleDocument) -> str:
        """
        Format subtitle document as SRT content.
        
        Args:
            subtitle_document: The subtitle document
            
        Returns:
            str: Formatted SRT content
        """
        pass
    
    @abstractmethod
    def backup_existing_file(self, file_path: FilePath) -> Optional[FilePath]:
        """
        Create backup of existing SRT file before overwriting.
        
        Args:
            file_path: Path to file that may be overwritten
            
        Returns:
            FilePath: Path to backup file, None if no backup created
        """
        pass