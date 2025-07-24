"""Tests for ConfigurationService."""

import unittest
from unittest.mock import Mock, patch, MagicMock
import os
from pathlib import Path

from src.infrastructure.services.configuration_service import ConfigurationService


class TestConfigurationService(unittest.TestCase):
    """Test cases for ConfigurationService."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_project_root = Path("/test/project")
    
    @patch('src.infrastructure.services.configuration_service.Path')
    def test_init_default_project_root(self, mock_path):
        """Test initialization with default project root detection."""
        # Mock Path resolution chain
        mock_file = Mock()
        mock_file.resolve.return_value = Path("/test/src/infrastructure/services/configuration_service.py")
        mock_path.return_value = mock_file
        
        # Create parent hierarchy
        parents = [
            Path("/test/src/infrastructure/services"),
            Path("/test/src/infrastructure"),  
            Path("/test/src"),
            Path("/test")  # This will have setup.py
        ]
        mock_file.resolve.return_value.parents = parents
        
        with patch.object(Path, 'exists') as mock_exists:
            mock_exists.side_effect = lambda: self == Path("/test/setup.py")
            
            with patch.object(ConfigurationService, '_load_env_files'):
                service = ConfigurationService()
                
                # Should find project root where setup.py exists
                self.assertIsInstance(service.project_root, Path)
    
    def test_init_custom_project_root(self):
        """Test initialization with custom project root."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            self.assertEqual(service.project_root, self.test_project_root)
    
    @patch('src.infrastructure.services.configuration_service.Path.cwd')
    @patch('src.infrastructure.services.configuration_service.Path')
    def test_find_project_root_no_markers(self, mock_path, mock_cwd):
        """Test project root detection when no markers found."""
        mock_cwd.return_value = Path("/fallback")
        
        # Mock file path with no setup.py or pyproject.toml in parents
        mock_file = Mock()
        mock_file.resolve.return_value.parents = [Path("/test")]
        mock_path.return_value = mock_file
        
        with patch.object(Path, 'exists', return_value=False):
            with patch.object(ConfigurationService, '_load_env_files'):
                service = ConfigurationService()
                result = service._find_project_root()
                
                self.assertEqual(result, Path("/fallback"))
    
    @patch('src.infrastructure.services.configuration_service._DOTENV_AVAILABLE', True)
    @patch('src.infrastructure.services.configuration_service.load_dotenv')
    def test_load_env_files_with_dotenv(self, mock_load_dotenv):
        """Test environment file loading when dotenv is available."""
        with patch.object(Path, 'exists') as mock_exists:
            # Only .env.local exists
            mock_exists.side_effect = lambda path: str(path).endswith('.env.local')
            
            with patch.object(ConfigurationService, '_find_project_root', 
                            return_value=self.test_project_root):
                service = ConfigurationService()
                
                mock_load_dotenv.assert_called_once_with(
                    self.test_project_root / ".env.local", 
                    override=False
                )
    
    @patch('src.infrastructure.services.configuration_service._DOTENV_AVAILABLE', False)
    def test_load_env_files_without_dotenv(self):
        """Test environment file loading when dotenv is not available."""
        with patch.object(ConfigurationService, '_find_project_root', 
                        return_value=self.test_project_root):
            # Should not raise an error
            service = ConfigurationService()
            self.assertIsNotNone(service)
    
    def test_get_gemini_api_key_from_cli(self):
        """Test getting Gemini API key from CLI argument."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_gemini_api_key(cli_key="cli_api_key_123")
            
            self.assertEqual(result, "cli_api_key_123")
    
    def test_get_gemini_api_key_from_cli_whitespace(self):
        """Test getting Gemini API key from CLI with whitespace."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_gemini_api_key(cli_key="  cli_api_key_123  ")
            
            self.assertEqual(result, "cli_api_key_123")
    
    @patch.dict(os.environ, {'GEMINI_API_KEY': 'env_api_key_123'})
    def test_get_gemini_api_key_from_env(self):
        """Test getting Gemini API key from environment variable."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_gemini_api_key()
            
            self.assertEqual(result, "env_api_key_123")
    
    def test_get_gemini_api_key_priority_order(self):
        """Test Gemini API key priority order from environment."""
        with patch.dict(os.environ, {
            'GOOGLE_GEMINI_API_KEY': 'google_gemini_key',
            'GOOGLE_API_KEY': 'google_key'
        }, clear=True):
            with patch.object(ConfigurationService, '_load_env_files'):
                service = ConfigurationService(project_root=self.test_project_root)
                
                # GOOGLE_GEMINI_API_KEY should take priority over GOOGLE_API_KEY
                result = service.get_gemini_api_key()
                
                self.assertEqual(result, "google_gemini_key")
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_gemini_api_key_not_found(self):
        """Test getting Gemini API key when not found."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_gemini_api_key()
            
            self.assertIsNone(result)
    
    @patch.dict(os.environ, {'GEMINI_API_KEY': ''})
    def test_get_gemini_api_key_empty_env(self):
        """Test getting Gemini API key when environment variable is empty."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_gemini_api_key()
            
            self.assertIsNone(result)
    
    def test_validate_gemini_configuration_valid(self):
        """Test Gemini configuration validation with valid key."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            is_valid, message = service.validate_gemini_configuration("valid_api_key_123456789")
            
            self.assertTrue(is_valid)
            self.assertIn("successfully", message)
    
    def test_validate_gemini_configuration_none(self):
        """Test Gemini configuration validation with None key."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            is_valid, message = service.validate_gemini_configuration(None)
            
            self.assertFalse(is_valid)
            self.assertIn("not found", message)
    
    def test_validate_gemini_configuration_too_short(self):
        """Test Gemini configuration validation with too short key."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            is_valid, message = service.validate_gemini_configuration("short")
            
            self.assertFalse(is_valid)
            self.assertIn("too short", message)
    
    def test_get_huggingface_token_from_cli(self):
        """Test getting HuggingFace token from CLI argument."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_huggingface_token(cli_token="hf_token_123")
            
            self.assertEqual(result, "hf_token_123")
    
    def test_get_huggingface_token_from_env(self):
        """Test getting HuggingFace token from environment variable."""
        with patch.dict(os.environ, {'HF_TOKEN': 'hf_env_token'}, clear=True):
            with patch.object(ConfigurationService, '_load_env_files'):
                service = ConfigurationService(project_root=self.test_project_root)
                
                result = service.get_huggingface_token()
                
                self.assertEqual(result, "hf_env_token")
    
    @patch.dict(os.environ, {
        'HUGGINGFACE_AUTH_TOKEN': 'hf_auth_token',
        'HF_TOKEN': 'hf_token',
        'HF_AUTH_TOKEN': 'hf_auth_token2'
    })
    def test_get_huggingface_token_priority_order(self):
        """Test HuggingFace token priority order from environment."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            # HUGGINGFACE_AUTH_TOKEN should take priority
            result = service.get_huggingface_token()
            
            self.assertEqual(result, "hf_auth_token")
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_huggingface_token_not_found(self):
        """Test getting HuggingFace token when not found."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_huggingface_token()
            
            self.assertIsNone(result)
    
    def test_get_openai_api_key_from_cli(self):
        """Test getting OpenAI API key from CLI argument."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_openai_api_key(cli_key="sk-openai123")
            
            self.assertEqual(result, "sk-openai123")
    
    @patch.dict(os.environ, {'OPENAI_API_KEY': 'sk-env-openai123'})
    def test_get_openai_api_key_from_env(self):
        """Test getting OpenAI API key from environment variable."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_openai_api_key()
            
            self.assertEqual(result, "sk-env-openai123")
    
    @patch.dict(os.environ, {
        'OPENAI_API_KEY': 'sk-openai-primary',
        'OPENAI_KEY': 'sk-openai-secondary'
    })
    def test_get_openai_api_key_priority_order(self):
        """Test OpenAI API key priority order from environment."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            # OPENAI_API_KEY should take priority over OPENAI_KEY
            result = service.get_openai_api_key()
            
            self.assertEqual(result, "sk-openai-primary")
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_openai_api_key_not_found(self):
        """Test getting OpenAI API key when not found."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.get_openai_api_key()
            
            self.assertIsNone(result)
    
    @patch('src.infrastructure.services.configuration_service._DOTENV_AVAILABLE', True)
    def test_is_dotenv_available_true(self):
        """Test dotenv availability check when available."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.is_dotenv_available()
            
            self.assertTrue(result)
    
    @patch('src.infrastructure.services.configuration_service._DOTENV_AVAILABLE', False)
    def test_is_dotenv_available_false(self):
        """Test dotenv availability check when not available."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            result = service.is_dotenv_available()
            
            self.assertFalse(result)
    
    def test_cli_key_priority_over_env(self):
        """Test that CLI arguments take priority over environment variables."""
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'env_key'}):
            with patch.object(ConfigurationService, '_load_env_files'):
                service = ConfigurationService(project_root=self.test_project_root)
                
                result = service.get_gemini_api_key(cli_key="cli_key")
                
                self.assertEqual(result, "cli_key")
    
    def test_whitespace_handling(self):
        """Test that all methods properly handle whitespace."""
        with patch.object(ConfigurationService, '_load_env_files'):
            service = ConfigurationService(project_root=self.test_project_root)
            
            # Test Gemini key
            result = service.get_gemini_api_key(cli_key="  key  ")
            self.assertEqual(result, "key")
            
            # Test HuggingFace token  
            result = service.get_huggingface_token(cli_token="  token  ")
            self.assertEqual(result, "token")
            
            # Test OpenAI key
            result = service.get_openai_api_key(cli_key="  sk-key  ")
            self.assertEqual(result, "sk-key")


if __name__ == '__main__':
    unittest.main()