"""Unified LLM service with validation, chunking, and multi-provider support."""

import re
import time
import os
from typing import Optional, Dict, Any, List, Tuple
from abc import ABC, abstractmethod
from dataclasses import dataclass

try:
    from rich.console import Console
    _console = Console()
    def _print(message: str, style: Optional[str] = None) -> None:
        """Print using Rich if available, fallback to standard print."""
        if style:
            _console.print(message, style=style)
        else:
            _console.print(message)
except ImportError:
    def _print(message: str, style: Optional[str] = None) -> None:
        """Fallback to standard print if Rich not available."""
        print(message)

from ...domain.value_objects import Charset


@dataclass
class LLMValidationResult:
    """Result of LLM output validation."""
    is_valid: bool
    error_message: Optional[str] = None
    word_count: Optional[int] = None
    issues: List[str] = None


@dataclass
class ChunkProcessingResult:
    """Result from processing a text chunk."""
    original_text: str
    converted_text: str
    validation_result: LLMValidationResult
    processing_time: float
    retry_count: int = 0


class ILLMProvider(ABC):
    """Interface for LLM providers."""
    
    @abstractmethod
    def generate_response(self, prompt: str, system_prompt: str) -> str:
        """Generate response from the LLM."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is available."""
        pass


class OpenAIProvider(ILLMProvider):
    """OpenAI provider implementation."""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo", api_key: Optional[str] = None):
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
            _print("OpenAI library not installed. Install with: pip install openai", "yellow")
            self.client = None
        except Exception as e:
            _print(f"Failed to initialize OpenAI client: {e}", "red")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        return self.client is not None and self.api_key is not None
    
    def generate_response(self, prompt: str, system_prompt: str) -> str:
        """Generate response from OpenAI."""
        if not self.is_available():
            raise RuntimeError("OpenAI service not available. Check API key.")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            raise RuntimeError(f"OpenAI API call failed: {e}")


class GeminiProvider(ILLMProvider):
    """Google Gemini provider implementation."""
    
    def __init__(self, model_name: str = "gemini-2.5-flash-lite-preview-06-17", api_key: Optional[str] = None):
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
            _print("Google Generative AI library not installed. Install with: pip install google-generativeai", "yellow")
            self.client = None
        except Exception as e:
            _print(f"Failed to initialize Gemini client: {e}", "red")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if Gemini service is available."""
        return self.client is not None and self.api_key is not None
    
    def generate_response(self, prompt: str, system_prompt: str) -> str:
        """Generate response from Gemini."""
        if not self.is_available():
            raise RuntimeError("Gemini service not available. Check API key.")
        
        try:
            # Combine system prompt and user prompt for Gemini
            full_prompt = f"{system_prompt}\n\n{prompt}"
            
            response = self.client.generate_content(
                full_prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 2000,
                }
            )
            
            return response.text.strip()
            
        except Exception as e:
            raise RuntimeError(f"Gemini API call failed: {e}")


class UnifiedLLMService:
    """Unified LLM service with validation, chunking, and multi-provider support."""
    
    def __init__(
        self,
        provider: str = "openai",
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        max_chinese_words: int = 20,
        max_retries: int = 3,
        chunk_size: int = 200,
        enable_validation: bool = True,
        enable_chunking: bool = True
    ):
        """
        Initialize unified LLM service.
        
        Args:
            provider: LLM provider (openai, gemini)
            model_name: Model name (provider-specific default if None)
            api_key: API key (will try env vars if None)
            max_chinese_words: Maximum Chinese words per sentence for validation
            max_retries: Maximum retry attempts for invalid responses
            chunk_size: Maximum characters per processing chunk
            enable_validation: Enable output validation
            enable_chunking: Enable chunked processing
        """
        self.provider_name = provider.lower().strip()
        self.enable_validation = enable_validation
        self.enable_chunking = enable_chunking
        self.max_chinese_words = max_chinese_words
        self.max_retries = max_retries
        self.chunk_size = chunk_size
        
        # Initialize provider
        self.provider = self._create_provider(provider, model_name, api_key)
        
        # Statistics
        self.stats = {
            "total_processed": 0,
            "total_retries": 0,
            "validation_failures": 0,
            "average_processing_time": 0.0,
            "chunks_processed": 0
        }
    
    def _create_provider(self, provider: str, model_name: Optional[str], api_key: Optional[str]) -> ILLMProvider:
        """Create provider instance."""
        provider = provider.lower().strip()
        
        if provider == "openai":
            return OpenAIProvider(
                model_name=model_name or "gpt-3.5-turbo",
                api_key=api_key
            )
        elif provider in ("gemini", "google"):
            return GeminiProvider(
                model_name=model_name or "gemini-2.5-flash-lite-preview-06-17",
                api_key=api_key
            )
        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider}. "
                f"Supported: openai, gemini"
            )
    
    def convert_to_written_style(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None,
        progress_callback: Optional[callable] = None
    ) -> str:
        """
        Convert spoken text to written style.
        
        Args:
            text: Spoken-style text to convert
            target_charset: Target character set
            context: Additional context for conversion
            progress_callback: Progress callback function
            
        Returns:
            str: Converted written-style text
        """
        if not self.provider.is_available():
            raise RuntimeError(f"{self.provider_name.title()} service not available. Check API key.")
        
        # Use chunked processing if enabled and text is long
        if self.enable_chunking and len(text) > self.chunk_size:
            return self._convert_text_chunked(text, target_charset, context, progress_callback)
        else:
            return self._convert_text_single(text, target_charset, context)
    
    def _convert_text_single(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """Convert text as a single chunk."""
        if self.enable_validation:
            return self._process_with_validation(text, target_charset, context)
        else:
            return self._process_simple(text, target_charset, context)
    
    def _convert_text_chunked(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None,
        progress_callback: Optional[callable] = None
    ) -> str:
        """Convert text using chunked processing."""
        # Split text into chunks
        chunks = self._split_text_into_chunks(text)
        
        if progress_callback:
            progress_callback(f"Processing {len(chunks)} text chunks")
        
        results = []
        total_processing_time = 0.0
        
        for i, chunk in enumerate(chunks):
            if progress_callback:
                progress = ((i + 1) / len(chunks)) * 100
                progress_callback(f"Processing chunk {i + 1}/{len(chunks)} ({progress:.1f}%)")
            
            # Process chunk
            if self.enable_validation:
                result = self._process_chunk_with_validation(chunk, target_charset, context)
                results.append(result.converted_text)
                total_processing_time += result.processing_time
                
                # Update statistics
                self.stats["total_processed"] += 1
                self.stats["total_retries"] += result.retry_count
                self.stats["chunks_processed"] += 1
                if not result.validation_result.is_valid:
                    self.stats["validation_failures"] += 1
            else:
                start_time = time.time()
                converted = self._process_simple(chunk, target_charset, context)
                results.append(converted)
                
                processing_time = time.time() - start_time
                total_processing_time += processing_time
                self.stats["total_processed"] += 1
                self.stats["chunks_processed"] += 1
        
        # Update average processing time
        if self.stats["total_processed"] > 0:
            self.stats["average_processing_time"] = (
                (self.stats["average_processing_time"] * (self.stats["total_processed"] - len(chunks)) + 
                 total_processing_time) / self.stats["total_processed"]
            )
        
        # Combine results
        return self._combine_chunks(results)
    
    def _process_simple(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """Process text without validation."""
        system_prompt = self._get_system_prompt()
        user_prompt = self._build_conversion_prompt(text, target_charset, context)
        
        response = self.provider.generate_response(user_prompt, system_prompt)
        return self._clean_converted_text(response)
    
    def _process_with_validation(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """Process text with validation and retries."""
        result = self._process_chunk_with_validation(text, target_charset, context)
        
        # Update statistics
        self.stats["total_processed"] += 1
        self.stats["total_retries"] += result.retry_count
        if not result.validation_result.is_valid:
            self.stats["validation_failures"] += 1
        
        return result.converted_text
    
    def _process_chunk_with_validation(
        self,
        chunk: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> ChunkProcessingResult:
        """Process a single chunk with validation and retries."""
        start_time = time.time()
        retry_count = 0
        
        while retry_count <= self.max_retries:
            try:
                # Convert chunk
                converted = self._process_simple(chunk, target_charset, context)
                
                # Validate result
                validation = self._validate_llm_output(converted)
                
                processing_time = time.time() - start_time
                
                if validation.is_valid:
                    return ChunkProcessingResult(
                        original_text=chunk,
                        converted_text=converted,
                        validation_result=validation,
                        processing_time=processing_time,
                        retry_count=retry_count
                    )
                else:
                    retry_count += 1
                    if retry_count <= self.max_retries:
                        _print(f"Validation failed (attempt {retry_count}): {validation.error_message}", "yellow")
                        # Add validation feedback to context for retry
                        retry_context = f"Previous attempt failed validation: {validation.error_message}. Please fix and try again."
                        context = f"{context}\n{retry_context}" if context else retry_context
                    else:
                        # Max retries reached, return with validation failure
                        return ChunkProcessingResult(
                            original_text=chunk,
                            converted_text=converted,
                            validation_result=validation,
                            processing_time=processing_time,
                            retry_count=retry_count
                        )
                        
            except Exception as e:
                retry_count += 1
                if retry_count > self.max_retries:
                    processing_time = time.time() - start_time
                    return ChunkProcessingResult(
                        original_text=chunk,
                        converted_text=chunk,  # Return original on failure
                        validation_result=LLMValidationResult(
                            is_valid=False,
                            error_message=f"Processing failed: {str(e)}"
                        ),
                        processing_time=processing_time,
                        retry_count=retry_count
                    )
        
        # Should not reach here, but return original if somehow we do
        processing_time = time.time() - start_time
        return ChunkProcessingResult(
            original_text=chunk,
            converted_text=chunk,
            validation_result=LLMValidationResult(
                is_valid=False,
                error_message="Max retries exceeded"
            ),
            processing_time=processing_time,
            retry_count=retry_count
        )
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for conversion."""
        return """You are an expert linguist specializing in converting spoken Hong Kong Cantonese to formal written Chinese.

Rules:
1. Only convert the text. Do not add any commentary, explanations, or apologies.
2. Preserve the original meaning and intent.
3. Replace colloquial particles (e.g., 呀, 喎, 嘅) with their formal equivalents or remove them if unnecessary.
4. Convert spoken vocabulary to written equivalents (e.g., 係 -> 是, 喺 -> 在, 咗 -> 了, 冇 -> 沒有, 佢 -> 他/她).
5. Maintain the sentence structure as much as possible, but correct grammar for written style if needed.
6. Return only the converted text.

Example:
Input: "喂，你食咗飯未呀？我頭先喺公司見到佢，佢話佢搞唔掂啲嘢喎。"
Output: "你好，你吃飯了嗎？我剛才在公司看到他，他說他處理不了那些事情。" """
    
    def _build_conversion_prompt(
        self, 
        text: str, 
        target_charset: Charset, 
        context: Optional[str]
    ) -> str:
        """Build conversion prompt."""
        charset_instruction = f"Use {target_charset.get_locale_name()} characters."
        
        context_instruction = ""
        if context:
            context_instruction = f"\nContext: {context}"
        
        return f"""{charset_instruction}{context_instruction}

Convert to formal written style:
{text}"""
    
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
        prefixes = ["Converted text:", "转换后的文本：", "Converted:", "转换："]
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
        
        return text
    
    def _split_text_into_chunks(self, text: str) -> List[str]:
        """Split text into processing chunks."""
        chunks = []
        
        # First, split by sentences to maintain context
        sentences = self._split_into_sentences(text)
        
        current_chunk = ""
        for sentence in sentences:
            # If adding this sentence would exceed chunk size
            if len(current_chunk) + len(sentence) > self.chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Chinese sentence endings
        sentence_endings = r'[。！？；]'
        
        # Split by sentence endings but keep the endings
        sentences = re.split(f'({sentence_endings})', text)
        
        # Combine split parts back into complete sentences
        complete_sentences = []
        current_sentence = ""
        
        for part in sentences:
            current_sentence += part
            if re.match(sentence_endings, part):
                complete_sentences.append(current_sentence.strip())
                current_sentence = ""
        
        # Add any remaining text
        if current_sentence.strip():
            complete_sentences.append(current_sentence.strip())
        
        return [s for s in complete_sentences if s.strip()]
    
    def _validate_llm_output(self, text: str) -> LLMValidationResult:
        """Validate LLM output according to specified rules."""
        issues = []
        
        # Remove whitespace and punctuation for word counting
        cleaned_text = re.sub(r'[，。！？；：、\s\n\r\t]', '', text)
        
        # Count Chinese characters (approximation of words)
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', cleaned_text)
        chinese_word_count = len(chinese_chars)
        
        # Check word count limit
        if chinese_word_count > self.max_chinese_words:
            issues.append(f"Too many Chinese words: {chinese_word_count} > {self.max_chinese_words}")
        
        # Check for empty or very short output
        if len(text.strip()) < 2:
            issues.append("Output too short or empty")
        
        # Check for common LLM artifacts
        artifacts = [
            "converted text:", "转换后的文本：", "written style:", "正式文体：",
            "formal style:", "书面语：", "[", "]", "Note:", "注："
        ]
        
        text_lower = text.lower()
        for artifact in artifacts:
            if artifact.lower() in text_lower:
                issues.append(f"Contains LLM artifact: {artifact}")
        
        # Check for repetitive patterns
        if self._has_excessive_repetition(text):
            issues.append("Contains excessive repetitive patterns")
        
        # Check for mixed languages (English in Chinese text)
        english_words = re.findall(r'[a-zA-Z]{3,}', text)
        if len(english_words) > 2:  # Allow some English words
            issues.append(f"Contains too many English words: {english_words}")
        
        is_valid = len(issues) == 0
        error_message = "; ".join(issues) if issues else None
        
        return LLMValidationResult(
            is_valid=is_valid,
            error_message=error_message,
            word_count=chinese_word_count,
            issues=issues
        )
    
    def _has_excessive_repetition(self, text: str) -> bool:
        """Check for excessive repetitive patterns."""
        # Check for repeated characters
        repeated_chars = re.findall(r'(.)\1{3,}', text)
        if repeated_chars:
            return True
        
        # Check for repeated words
        words = text.split()
        if len(words) > 3:
            word_counts = {}
            for word in words:
                if len(word) > 1:  # Ignore single characters
                    word_counts[word] = word_counts.get(word, 0) + 1
                    if word_counts[word] > 3:  # Word appears more than 3 times
                        return True
        
        return False
    
    def _combine_chunks(self, chunks: List[str]) -> str:
        """Combine processed chunks into final text."""
        # Simple combination with proper spacing
        combined = ""
        
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
                
            if i == 0:
                combined = chunk
            else:
                # Add appropriate spacing between chunks
                if combined.endswith(('。', '！', '？', '；')):
                    combined += " " + chunk
                else:
                    combined += chunk
        
        return combined.strip()
    
    def is_available(self) -> bool:
        """Check if the LLM service is available."""
        return self.provider.is_available()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics."""
        return {
            **self.stats,
            "provider": self.provider_name,
            "max_chinese_words": self.max_chinese_words,
            "max_retries": self.max_retries,
            "chunk_size": self.chunk_size,
            "validation_enabled": self.enable_validation,
            "chunking_enabled": self.enable_chunking,
            "service_available": self.is_available()
        }
    
    def reset_statistics(self) -> None:
        """Reset processing statistics."""
        self.stats = {
            "total_processed": 0,
            "total_retries": 0,
            "validation_failures": 0,
            "average_processing_time": 0.0,
            "chunks_processed": 0
        }
    
    def configure_validation(
        self,
        max_chinese_words: Optional[int] = None,
        max_retries: Optional[int] = None,
        enable_validation: Optional[bool] = None
    ) -> None:
        """Configure validation settings."""
        if max_chinese_words is not None:
            self.max_chinese_words = max_chinese_words
        if max_retries is not None:
            self.max_retries = max_retries
        if enable_validation is not None:
            self.enable_validation = enable_validation
    
    def configure_chunking(
        self,
        chunk_size: Optional[int] = None,
        enable_chunking: Optional[bool] = None
    ) -> None:
        """Configure chunking settings."""
        if chunk_size is not None:
            self.chunk_size = chunk_size
        if enable_chunking is not None:
            self.enable_chunking = enable_chunking


# Legacy compatibility classes and functions
class ILLMService(ABC):
    """Legacy interface for backward compatibility."""
    
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


class LegacyLLMServiceAdapter(ILLMService):
    """Adapter to make UnifiedLLMService compatible with legacy interface."""
    
    def __init__(self, unified_service: UnifiedLLMService):
        self.unified_service = unified_service
    
    def convert_to_written_style(
        self,
        text: str,
        target_charset: Charset,
        context: Optional[str] = None
    ) -> str:
        """Convert spoken text to written style."""
        return self.unified_service.convert_to_written_style(text, target_charset, context)
    
    def is_available(self) -> bool:
        """Check if service is available."""
        return self.unified_service.is_available()


class LLMServiceFactory:
    """Factory for creating LLM services with backward compatibility."""
    
    @staticmethod
    def create_service(
        provider: str = "openai",
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        enable_validation: bool = False,
        enable_chunking: bool = False
    ) -> ILLMService:
        """
        Create LLM service instance.
        
        Args:
            provider: Service provider ("openai" or "gemini")
            model_name: Model name (provider-specific default if None)
            api_key: API key (will try env vars if None)
            enable_validation: Enable validation features
            enable_chunking: Enable chunking features
            
        Returns:
            ILLMService: Service instance
        """
        unified_service = UnifiedLLMService(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            enable_validation=enable_validation,
            enable_chunking=enable_chunking
        )
        
        return LegacyLLMServiceAdapter(unified_service)
    
    @staticmethod
    def create_enhanced_service(
        provider: str = "openai",
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        max_chinese_words: int = 20,
        max_retries: int = 3,
        chunk_size: int = 200
    ) -> UnifiedLLMService:
        """
        Create enhanced LLM service with all features enabled.
        
        Args:
            provider: Service provider ("openai" or "gemini")
            model_name: Model name (provider-specific default if None)
            api_key: API key (will try env vars if None)
            max_chinese_words: Maximum Chinese words per sentence
            max_retries: Maximum retry attempts
            chunk_size: Characters per chunk
            
        Returns:
            UnifiedLLMService: Enhanced service instance
        """
        return UnifiedLLMService(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            max_chinese_words=max_chinese_words,
            max_retries=max_retries,
            chunk_size=chunk_size,
            enable_validation=True,
            enable_chunking=True
        )


# Backward compatibility aliases
OpenAILLMService = LegacyLLMServiceAdapter
GeminiLLMService = LegacyLLMServiceAdapter
EnhancedLLMService = UnifiedLLMService