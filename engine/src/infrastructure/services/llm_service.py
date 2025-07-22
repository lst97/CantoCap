"""Generic LLM service interface and provider implementations."""

from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod
from enum import Enum

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

try:
    import openai
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False

from ...domain.value_objects import FilePath


class LLMProvider(Enum):
    """Supported LLM providers."""
    GEMINI = "gemini"
    OPENAI = "openai"


@dataclass
class LLMConfig:
    """Configuration for LLM services."""
    temperature: float = 0.3
    top_p: float = 0.9
    top_k: Optional[int] = 50
    max_output_tokens: int = 50000
    
    # Provider-specific configurations
    gemini_model: str = "models/gemini-2.5-flash"
    openai_model: str = "gpt-4o"
    
    # Safety settings for Gemini
    safety_settings: Optional[List[Dict[str, str]]] = None
    
    def __post_init__(self):
        """Set default safety settings for Gemini if not provided."""
        if self.safety_settings is None:
            self.safety_settings = [
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]


@dataclass
class LLMResponse:
    """Response from LLM service."""
    text: str
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    

class ILLMService(ABC):
    """Interface for LLM services."""
    
    @abstractmethod
    def generate_content(self, prompt: str, system_instruction: Optional[str] = None, media_files: Optional[List[Any]] = None) -> LLMResponse:
        """Generate content using the LLM."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM service is available."""
        pass
    
    @abstractmethod
    def estimate_token_usage(self, text: str, media_duration_seconds: Optional[float] = None) -> int:
        """Estimate token usage for given input."""
        pass


class GeminiLLMService(ILLMService):
    """Google Gemini LLM service implementation."""
    
    def __init__(self, api_key: str, config: LLMConfig):
        """Initialize Gemini LLM service."""
        if not _GEMINI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
        
        genai.configure(api_key=api_key)
        
        # Configure generation settings
        generation_config = genai.types.GenerationConfig(
            temperature=config.temperature,
            top_p=config.top_p,
            top_k=config.top_k,
            max_output_tokens=config.max_output_tokens,
        )
        
        self.model = genai.GenerativeModel(
            model_name=config.gemini_model,
            generation_config=generation_config,
            safety_settings=config.safety_settings
        )
        
        self.api_key = api_key
        self.config = config
    
    def generate_content(self, prompt: str, system_instruction: Optional[str] = None, media_files: Optional[List[Any]] = None) -> LLMResponse:
        """Generate content using Gemini."""
        try:
            # Create model with system instruction if provided
            model = self.model
            if system_instruction:
                generation_config = genai.types.GenerationConfig(
                    temperature=self.config.temperature,
                    top_p=self.config.top_p,
                    top_k=self.config.top_k,
                    max_output_tokens=self.config.max_output_tokens,
                )
                
                model = genai.GenerativeModel(
                    model_name=self.config.gemini_model,
                    generation_config=generation_config,
                    system_instruction=system_instruction,
                    safety_settings=self.config.safety_settings
                )
            
            # Prepare content
            content = [prompt]
            if media_files:
                content.extend(media_files)
            
            response = model.generate_content(content)
            
            finish_reason = None
            if response.candidates:
                finish_reason = response.candidates[0].finish_reason.name if response.candidates[0].finish_reason else None
            
            return LLMResponse(
                text=response.text.strip() if response.text else "",
                finish_reason=finish_reason,
                usage={"model": self.config.gemini_model}
            )
            
        except Exception as e:
            raise RuntimeError(f"Gemini content generation failed: {str(e)}")
    
    def is_available(self) -> bool:
        """Check if Gemini service is available."""
        if not _GEMINI_AVAILABLE:
            return False
        
        try:
            response = self.model.generate_content("Test connectivity")
            return True
        except Exception:
            return False
    
    def estimate_token_usage(self, text: str, media_duration_seconds: Optional[float] = None) -> int:
        """Estimate token usage for Gemini."""
        # Conservative estimation:
        # - Text: ~1 token per 4 characters
        # - Media: ~50 tokens per minute
        # - System prompt overhead: ~1000 tokens
        
        text_tokens = int(len(text) / 4)
        media_tokens = int(media_duration_seconds / 60 * 50) if media_duration_seconds else 0
        system_tokens = 1000
        
        return text_tokens + media_tokens + system_tokens


class OpenAILLMService(ILLMService):
    """OpenAI LLM service implementation."""
    
    def __init__(self, api_key: str, config: LLMConfig):
        """Initialize OpenAI LLM service."""
        if not _OPENAI_AVAILABLE:
            raise ImportError(
                "openai package not installed. "
                "Install with: pip install openai"
            )
        
        self.client = openai.OpenAI(api_key=api_key)
        self.api_key = api_key
        self.config = config
    
    def generate_content(self, prompt: str, system_instruction: Optional[str] = None, media_files: Optional[List[Any]] = None) -> LLMResponse:
        """Generate content using OpenAI."""
        try:
            messages = []
            
            # Add system message if provided
            if system_instruction:
                messages.append({
                    "role": "system",
                    "content": system_instruction
                })
            
            # Add user message
            user_content = [{"type": "text", "text": prompt}]
            
            # Note: OpenAI API media handling would need to be implemented
            # based on specific media file types and encoding
            if media_files:
                # This is a placeholder - actual implementation would need
                # to handle different media types appropriately
                user_content.append({
                    "type": "text", 
                    "text": f"[Media files provided: {len(media_files)} files]"
                })
            
            messages.append({
                "role": "user",
                "content": user_content
            })
            
            response = self.client.chat.completions.create(
                model=self.config.openai_model,
                messages=messages,
                temperature=self.config.temperature,
                top_p=self.config.top_p,
                max_tokens=self.config.max_output_tokens
            )
            
            return LLMResponse(
                text=response.choices[0].message.content or "",
                finish_reason=response.choices[0].finish_reason,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else None,
                    "completion_tokens": response.usage.completion_tokens if response.usage else None,
                    "total_tokens": response.usage.total_tokens if response.usage else None,
                    "model": self.config.openai_model
                }
            )
            
        except Exception as e:
            raise RuntimeError(f"OpenAI content generation failed: {str(e)}")
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        if not _OPENAI_AVAILABLE:
            return False
        
        try:
            # Test with a simple completion
            response = self.client.chat.completions.create(
                model=self.config.openai_model,
                messages=[{"role": "user", "content": "Test"}],
                max_tokens=1
            )
            return True
        except Exception:
            return False
    
    def estimate_token_usage(self, text: str, media_duration_seconds: Optional[float] = None) -> int:
        """Estimate token usage for OpenAI."""
        # Conservative estimation:
        # - Text: ~1 token per 4 characters (rough approximation)
        # - Media: Not directly supported in base API
        # - System prompt overhead: ~500 tokens
        
        text_tokens = int(len(text) / 4)
        system_tokens = 500
        
        # Note: OpenAI doesn't natively process video/audio in chat completions
        # This would require preprocessing through other services
        
        return text_tokens + system_tokens


class LLMServiceFactory:
    """Factory for creating LLM services."""
    
    @staticmethod
    def create_service(provider: LLMProvider, api_key: str, config: Optional[LLMConfig] = None) -> ILLMService:
        """Create an LLM service instance."""
        if config is None:
            config = LLMConfig()
        
        if provider == LLMProvider.GEMINI:
            return GeminiLLMService(api_key, config)
        elif provider == LLMProvider.OPENAI:
            return OpenAILLMService(api_key, config)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    
    @staticmethod
    def get_available_providers() -> List[LLMProvider]:
        """Get list of available LLM providers based on installed packages."""
        available = []
        
        if _GEMINI_AVAILABLE:
            available.append(LLMProvider.GEMINI)
        
        if _OPENAI_AVAILABLE:
            available.append(LLMProvider.OPENAI)
        
        return available
    
    @staticmethod
    def is_provider_available(provider: LLMProvider) -> bool:
        """Check if a specific provider is available."""
        return provider in LLMServiceFactory.get_available_providers()


# Convenience functions for backward compatibility
def is_gemini_available() -> bool:
    """Check if Gemini dependencies are available."""
    return _GEMINI_AVAILABLE


def is_openai_available() -> bool:
    """Check if OpenAI dependencies are available."""
    return _OPENAI_AVAILABLE