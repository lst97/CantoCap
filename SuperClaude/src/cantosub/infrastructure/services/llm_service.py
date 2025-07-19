"""LLM service for spoken-to-written style conversion."""

from typing import Optional, Dict, Any
import os
from abc import ABC, abstractmethod

from ...domain.value_objects import Charset


class ILLMService(ABC):
    """Interface for LLM services."""
    
    @abstractmethod
    def convert_to_written_style(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """Convert spoken text to written style."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if service is available."""
        pass


class OpenAILLMService(ILLMService):
    """OpenAI GPT service for text conversion."""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo", api_key: Optional[str] = None):
        """
        Initialize OpenAI LLM service.
        
        Args:
            model_name: OpenAI model to use
            api_key: OpenAI API key (will try env var if not provided)
        """
        self.model_name = model_name
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = None
        
        if self.api_key:
            self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize OpenAI client."""
        try:
            import openai
            self.client = openai.OpenAI(api_key=self.api_key)
        except ImportError:
            print("OpenAI library not installed. Install with: pip install openai")
            self.client = None
        except Exception as e:
            print(f"Failed to initialize OpenAI client: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        return self.client is not None and self.api_key is not None
    
    def convert_to_written_style(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """
        Convert spoken Cantonese to written style using OpenAI.
        
        Args:
            text: Spoken-style text to convert
            target_charset: Target character set
            context: Additional context for conversion
            
        Returns:
            str: Written-style text
            
        Raises:
            RuntimeError: If service not available or conversion fails
        """
        if not self.is_available():
            raise RuntimeError("OpenAI service not available. Check API key.")
        
        # Build conversion prompt
        prompt = self._build_conversion_prompt(text, target_charset, context)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in Cantonese language conversion. Convert spoken Cantonese to formal written style while preserving meaning and natural flow."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,  # Lower temperature for more consistent results
                max_tokens=2000
            )
            
            converted_text = response.choices[0].message.content.strip()
            return self._clean_converted_text(converted_text)
            
        except Exception as e:
            raise RuntimeError(f"Text conversion failed: {e}")
    
    def _build_conversion_prompt(
        self, 
        text: str, 
        target_charset: Charset, 
        context: Optional[str]
    ) -> str:
        """Build conversion prompt for OpenAI."""
        charset_instruction = (
            f"Output in {target_charset.get_locale_name()} characters only."
        )
        
        context_instruction = ""
        if context:
            context_instruction = f"\nContext: {context}"
        
        return f"""Convert the following spoken Cantonese text to formal written style:

{charset_instruction}

Rules:
1. Preserve the original meaning completely
2. Convert colloquial expressions to formal equivalents
3. Maintain natural reading flow
4. Remove filler words and repetitions
5. Use appropriate punctuation for written text
6. Keep the text length roughly the same{context_instruction}

Spoken text to convert:
{text}

Converted text:"""
    
    def _clean_converted_text(self, text: str) -> str:
        """Clean up converted text."""
        # Remove common artifacts from LLM responses
        text = text.strip()
        
        # Remove quotes if the LLM wrapped the response
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]
        
        # Remove "Converted text:" prefix if present
        if text.startswith("Converted text:"):
            text = text[15:].strip()
        
        return text


class GeminiLLMService(ILLMService):
    """Google Gemini service for text conversion."""
    
    def __init__(self, model_name: str = "gemini-pro", api_key: Optional[str] = None):
        """
        Initialize Gemini LLM service.
        
        Args:
            model_name: Gemini model to use
            api_key: Google API key (will try env var if not provided)
        """
        self.model_name = model_name
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.client = None
        
        if self.api_key:
            self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize Gemini client."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model_name)
        except ImportError:
            print("Google Generative AI library not installed. Install with: pip install google-generativeai")
            self.client = None
        except Exception as e:
            print(f"Failed to initialize Gemini client: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if Gemini service is available."""
        return self.client is not None and self.api_key is not None
    
    def convert_to_written_style(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """
        Convert spoken Cantonese to written style using Gemini.
        
        Args:
            text: Spoken-style text to convert
            target_charset: Target character set
            context: Additional context for conversion
            
        Returns:
            str: Written-style text
            
        Raises:
            RuntimeError: If service not available or conversion fails
        """
        if not self.is_available():
            raise RuntimeError("Gemini service not available. Check API key.")
        
        # Build conversion prompt
        prompt = self._build_conversion_prompt(text, target_charset, context)
        
        try:
            response = self.client.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 2000,
                }
            )
            
            converted_text = response.text.strip()
            return self._clean_converted_text(converted_text)
            
        except Exception as e:
            raise RuntimeError(f"Text conversion failed: {e}")
    
    def _build_conversion_prompt(
        self, 
        text: str, 
        target_charset: Charset, 
        context: Optional[str]
    ) -> str:
        """Build conversion prompt for Gemini."""
        charset_instruction = (
            f"Output in {target_charset.get_locale_name()} characters only."
        )
        
        context_instruction = ""
        if context:
            context_instruction = f"\nContext: {context}"
        
        return f"""Convert the following spoken Cantonese text to formal written style:

{charset_instruction}

Rules:
1. Preserve the original meaning completely
2. Convert colloquial expressions to formal equivalents
3. Maintain natural reading flow
4. Remove filler words and repetitions
5. Use appropriate punctuation for written text
6. Keep the text length roughly the same{context_instruction}

Spoken text to convert:
{text}

Please provide only the converted text without any additional explanation."""
    
    def _clean_converted_text(self, text: str) -> str:
        """Clean up converted text."""
        # Remove common artifacts from LLM responses
        text = text.strip()
        
        # Remove quotes if the LLM wrapped the response
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]
        
        return text


class LLMServiceFactory:
    """Factory for creating LLM services."""
    
    @staticmethod
    def create_service(
        provider: str = "openai",
        model_name: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> ILLMService:
        """
        Create LLM service instance.
        
        Args:
            provider: Service provider ("openai" or "gemini")
            model_name: Model name (provider-specific default if None)
            api_key: API key (will try env vars if None)
            
        Returns:
            ILLMService: Service instance
            
        Raises:
            ValueError: If unsupported provider
        """
        provider = provider.lower().strip()
        
        if provider == "openai":
            return OpenAILLMService(
                model_name=model_name or "gpt-3.5-turbo",
                api_key=api_key
            )
        elif provider in ("gemini", "google"):
            return GeminiLLMService(
                model_name=model_name or "gemini-2.5-flash-lite-preview-06-17",
                api_key=api_key
            )
        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider}. "
                f"Supported: openai, gemini"
            )