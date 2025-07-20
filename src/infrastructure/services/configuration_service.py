"""Enhanced configuration management with .env support."""

import os
from pathlib import Path
from typing import Optional, Tuple

try:
    from dotenv import load_dotenv
    _DOTENV_AVAILABLE = True
except ImportError:
    _DOTENV_AVAILABLE = False


class ConfigurationService:
    """Enhanced configuration management with .env support."""
    
    def __init__(self, project_root: Optional[Path] = None):
        """Initialize configuration service."""
        self.project_root = project_root or self._find_project_root()
        self._load_env_files()
    
    def _find_project_root(self) -> Path:
        """Find project root by looking for key files."""
        current = Path(__file__).resolve()
        for parent in current.parents:
            if (parent / "pyproject.toml").exists() or (parent / "setup.py").exists():
                return parent
        return Path.cwd()
    
    def _load_env_files(self):
        """Load .env files in priority order."""
        if not _DOTENV_AVAILABLE:
            return
        
        env_files = [
            self.project_root / ".env.local",
            self.project_root / ".env",
        ]
        
        for env_file in env_files:
            if env_file.exists():
                load_dotenv(env_file, override=False)
                break
    
    def get_gemini_api_key(self, cli_key: Optional[str] = None) -> Optional[str]:
        """
        Get Gemini API key with priority resolution.
        
        Args:
            cli_key: API key from CLI argument
            
        Returns:
            API key or None if not found
        """
        # Priority 1: CLI argument
        if cli_key and cli_key.strip():
            return cli_key.strip()
        
        # Priority 2: Environment variables (.env loaded first)
        key_names = [
            'GEMINI_API_KEY',
            'GOOGLE_GEMINI_API_KEY',
            'GOOGLE_API_KEY'
        ]
        
        for key_name in key_names:
            key = os.environ.get(key_name)
            if key and key.strip():
                return key.strip()
        
        return None
    
    def validate_gemini_configuration(self, api_key: Optional[str]) -> Tuple[bool, str]:
        """
        Validate Gemini configuration.
        
        Returns:
            Tuple of (is_valid, message)
        """
        if not api_key:
            return False, (
                "Gemini API key not found. Set GEMINI_API_KEY in .env file, "
                "environment variable, or use --gemini-key argument."
            )
        
        if len(api_key) < 20:  # Basic validation
            return False, "Gemini API key appears to be invalid (too short)."
        
        return True, "Gemini API key configured successfully."
    
    def get_huggingface_token(self, cli_token: Optional[str] = None) -> Optional[str]:
        """
        Get HuggingFace token with priority resolution.
        
        Args:
            cli_token: Token from CLI argument
            
        Returns:
            Token or None if not found
        """
        # Priority 1: CLI argument
        if cli_token and cli_token.strip():
            return cli_token.strip()
        
        # Priority 2: Environment variables
        token_names = [
            'HUGGINGFACE_AUTH_TOKEN',
            'HUGGINGFACE_TOKEN', 
            'HF_TOKEN',
            'HF_AUTH_TOKEN'
        ]
        
        for token_name in token_names:
            token = os.environ.get(token_name)
            if token and token.strip():
                return token.strip()
        
        return None
    
    def get_openai_api_key(self, cli_key: Optional[str] = None) -> Optional[str]:
        """
        Get OpenAI API key with priority resolution.
        
        Args:
            cli_key: API key from CLI argument
            
        Returns:
            API key or None if not found
        """
        # Priority 1: CLI argument
        if cli_key and cli_key.strip():
            return cli_key.strip()
        
        # Priority 2: Environment variables
        key_names = [
            'OPENAI_API_KEY',
            'OPENAI_KEY'
        ]
        
        for key_name in key_names:
            key = os.environ.get(key_name)
            if key and key.strip():
                return key.strip()
        
        return None
    
    def is_dotenv_available(self) -> bool:
        """Check if python-dotenv is available."""
        return _DOTENV_AVAILABLE