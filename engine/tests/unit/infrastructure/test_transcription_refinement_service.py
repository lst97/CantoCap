"""Tests for the transcription refinement service."""

import unittest
from unittest.mock import patch, MagicMock, mock_open
import json

from src.infrastructure.services.transcription_refinement_service import GeminiTranscriptionRefinementService


class TestGeminiTranscriptionRefinementService(unittest.TestCase):
    """Test cases for the GeminiTranscriptionRefinementService class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Sample configuration for testing
        self.sample_config = {
            "translation_system": "Test translation system prompt",
            "language_guidelines": {
                "en": "English guidelines",
                "ja": "Japanese guidelines"
            },
            "system_instruction": "Test system instruction",
            "language_styles": {
                "written": {
                    "description": "written style",
                    "objectives": ["objective 1"],
                    "principles": ["principle 1"],
                    "execution_checklist": {}
                },
                "colloquial": {
                    "description": "colloquial style",
                    "objectives": ["objective 2"],
                    "principles": ["principle 2"],
                    "execution_checklist": {}
                }
            },
            "speaker_instructions": {
                "with_speaker_tags": "With speaker tags instruction",
                "without_speaker_tags": "Without speaker tags instruction"
            },
            "validation_tag_instructions": "Validation instructions",
            "prompt_template": {
                "mission_header": "Mission header",
                "cooperation_framework": {
                    "title": "Framework title",
                    "whisper_contribution": {
                        "title": "Whisper title",
                        "items": ["item 1"]
                    },
                    "refinement_mission": {
                        "title": "Refinement title",
                        "items": ["item 2"]
                    }
                },
                "phases": {
                    "phase_7": {
                        "quality_checklist": {
                            "items": ["checklist item"]
                        }
                    }
                },
                "final_output_requirements": {
                    "title": "Output requirements",
                    "srt_format": {
                        "title": "SRT format",
                        "description": "SRT description",
                        "format": "SRT format"
                    },
                    "success_metrics": {
                        "title": "Success metrics",
                        "items": ["metric 1"]
                    }
                }
            },
            "automatic_terminology": {
                "title": "Auto terminology"
            },
            "configuration": {
                "max_srt_length": 60000,
                "min_split_size": 10000,
                "split_overlap": 200,
                "file_upload_timeout": 300,
                "file_check_interval": 5,
                "max_upload_retries": 3
            }
        }
    
    @patch('src.infrastructure.services.transcription_refinement_service._GEMINI_AVAILABLE', True)
    @patch('src.infrastructure.services.transcription_refinement_service.genai')
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_service_initialization_with_config_attribute(self, mock_exists, mock_file, mock_genai):
        """Test that the service initializes with config attribute properly set."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        # Mock Gemini components
        mock_genai.configure = MagicMock()
        mock_genai.GenerativeModel = MagicMock()
        mock_genai.types.GenerationConfig = MagicMock()
        
        # Reset singleton for clean test
        from src.infrastructure.services.prompt_service import PromptService
        PromptService._instance = None
        PromptService._prompts_cache = None
        
        # Initialize service
        service = GeminiTranscriptionRefinementService("fake_api_key")
        
        # Verify config attribute exists and has expected structure
        self.assertTrue(hasattr(service, 'config'))
        self.assertIsInstance(service.config, dict)
        
        # Verify config contains expected sections
        self.assertIn('language_styles', service.config)
        self.assertIn('speaker_instructions', service.config)
        self.assertIn('validation_tag_instructions', service.config)
        self.assertIn('prompt_template', service.config)
        self.assertIn('automatic_terminology', service.config)
        
        # Verify language styles
        self.assertIn('written', service.config['language_styles'])
        self.assertIn('colloquial', service.config['language_styles'])
        
        # Verify configuration constants are set
        self.assertEqual(service.MAX_SRT_LENGTH, 60000)
        self.assertEqual(service.MIN_SPLIT_SIZE, 10000)
        self.assertEqual(service.SPLIT_OVERLAP, 200)
    
    @patch('src.infrastructure.services.transcription_refinement_service._GEMINI_AVAILABLE', True)
    @patch('src.infrastructure.services.transcription_refinement_service.genai')
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_transcription_refinement_prompt_accesses_config(self, mock_exists, mock_file, mock_genai):
        """Test that _get_transcription_refinement_prompt can access self.config without error."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        # Mock Gemini components
        mock_genai.configure = MagicMock()
        mock_genai.GenerativeModel = MagicMock()
        mock_genai.types.GenerationConfig = MagicMock()
        
        # Reset singleton for clean test
        from src.infrastructure.services.prompt_service import PromptService
        PromptService._instance = None
        PromptService._prompts_cache = None
        
        # Initialize service
        service = GeminiTranscriptionRefinementService("fake_api_key")
        
        # This should not raise an AttributeError for missing config
        try:
            prompt = service._get_transcription_refinement_prompt("colloquial", False)
            # If we get here, the config attribute was accessible
            self.assertIsInstance(prompt, str)
            self.assertGreater(len(prompt), 0)
        except AttributeError as e:
            if "'config'" in str(e):
                self.fail("service._get_transcription_refinement_prompt() raised AttributeError for missing 'config' attribute")
            else:
                # Some other AttributeError, re-raise
                raise


if __name__ == '__main__':
    unittest.main()