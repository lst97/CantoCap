"""Tests for the prompt service."""

import unittest
from unittest.mock import patch, mock_open, MagicMock
import json

from src.infrastructure.services.prompt_service import PromptService, prompt_service
from src.domain.value_objects import LanguageCode


class TestPromptService(unittest.TestCase):
    """Test cases for the PromptService class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Reset the singleton instance for each test
        PromptService._instance = None
        PromptService._prompts_cache = None
        
        # Sample configuration for testing
        self.sample_config = {
            "translation_system": "Test translation system prompt",
            "language_guidelines": {
                "en": "English guidelines",
                "ja": "Japanese guidelines"
            },
            "system_instruction": "Test system instruction",
            "language_styles": {
                "written": {"description": "written style"},
                "colloquial": {"description": "colloquial style"}
            },
            "speaker_instructions": {
                "with_speaker_tags": "With speaker tags instruction",
                "without_speaker_tags": "Without speaker tags instruction"
            },
            "validation_tag_instructions": "Validation instructions",
            "configuration": {
                "max_srt_length": 60000,
                "translation": {
                    "max_srt_length": 50000,
                    "min_split_size": 8000
                }
            }
        }
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_load_prompts_success(self, mock_exists, mock_file):
        """Test successful loading of prompts from JSON file."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        
        self.assertIsNotNone(service._prompts_cache)
        self.assertEqual(service._prompts_cache["translation_system"], "Test translation system prompt")
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_load_prompts_file_not_found(self, mock_exists, mock_file):
        """Test handling of missing configuration file."""
        mock_file.side_effect = FileNotFoundError("File not found")
        
        with self.assertRaises(FileNotFoundError):
            PromptService()
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_load_prompts_invalid_json(self, mock_exists, mock_file):
        """Test handling of invalid JSON in configuration file."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = "invalid json"
        mock_file.side_effect = json.JSONDecodeError("Invalid JSON", "doc", 0)
        
        with self.assertRaises(ValueError):
            PromptService()
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_singleton_pattern(self, mock_exists, mock_file):
        """Test that PromptService follows singleton pattern."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service1 = PromptService()
        service2 = PromptService()
        
        self.assertIs(service1, service2)
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_translation_system_prompt(self, mock_exists, mock_file):
        """Test getting translation system prompt."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        result = service.get_translation_system_prompt()
        
        self.assertEqual(result, "Test translation system prompt")
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_language_guidelines(self, mock_exists, mock_file):
        """Test getting language guidelines."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        
        # Test existing language
        result = service.get_language_guidelines("en")
        self.assertEqual(result, "English guidelines")
        
        # Test non-existing language (should return default)
        result = service.get_language_guidelines("unknown")
        self.assertIn("Translation Guidelines for unknown", result)
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_translation_prompt(self, mock_exists, mock_file):
        """Test building complete translation prompt."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        language_code = LanguageCode("en_us")
        
        result = service.get_translation_prompt(language_code)
        
        self.assertIn("Translation Mission: Chinese to English", result)
        self.assertIn("English guidelines", result)
        self.assertIn("**Source Language**: Chinese", result)
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_speaker_instructions(self, mock_exists, mock_file):
        """Test getting speaker instructions."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        
        # Test with speaker tags
        result = service.get_speaker_instructions(True)
        self.assertEqual(result, "With speaker tags instruction")
        
        # Test without speaker tags
        result = service.get_speaker_instructions(False)
        self.assertEqual(result, "Without speaker tags instruction")
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_configuration(self, mock_exists, mock_file):
        """Test getting configuration values."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        
        # Test getting all configuration
        config = service.get_configuration()
        self.assertEqual(config["max_srt_length"], 60000)
        
        # Test getting specific section
        translation_config = service.get_configuration("translation")
        self.assertEqual(translation_config["max_srt_length"], 50000)
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_get_translation_configuration(self, mock_exists, mock_file):
        """Test getting translation-specific configuration."""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(self.sample_config)
        
        service = PromptService()
        config = service.get_translation_configuration()
        
        self.assertEqual(config["max_srt_length"], 50000)
        self.assertEqual(config["min_split_size"], 8000)


if __name__ == '__main__':
    unittest.main()