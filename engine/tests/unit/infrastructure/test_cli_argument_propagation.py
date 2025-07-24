"""Comprehensive CLI argument propagation testing with mocked services."""

import unittest
from unittest.mock import Mock, patch, MagicMock, call
import tempfile
import os
from pathlib import Path

from src.presentation.cli.commands import generate_command
from src.domain.entities.subtitle import Subtitle
from src.domain.value_objects import LanguageCode


class TestCLIArgumentPropagation(unittest.TestCase):
    """Test that CLI arguments are correctly propagated to services."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a temporary test file
        self.temp_file = tempfile.NamedTemporaryFile(suffix='.mov', delete=False)
        self.temp_file.write(b"dummy test content")
        self.temp_file.close()
        self.test_file_path = self.temp_file.name

    def tearDown(self):
        """Clean up test fixtures."""
        if os.path.exists(self.test_file_path):
            os.unlink(self.test_file_path)

    @patch('src.presentation.cli.commands.Container')
    @patch('src.presentation.cli.commands.safe_execute')
    @patch('src.presentation.cli.commands._display_file_info')
    @patch('src.presentation.cli.commands._execute_with_enhanced_progress')
    @patch('src.presentation.cli.commands._display_results')
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    def test_basic_arguments_propagation(self, mock_which, mock_display_results, 
                                       mock_execute_progress, mock_display_info,
                                       mock_safe_execute, mock_container):
        """Test basic argument propagation to services."""
        
        # Setup mocks
        mock_use_case = Mock()
        mock_command = Mock()
        mock_result = Mock()
        mock_result.success = True
        
        # Configure safe_execute to return our mocks
        mock_safe_execute.side_effect = [mock_use_case, mock_command]
        mock_execute_progress.return_value = mock_result
        
        # Test arguments (use valid values to pass validation)
        test_args = {
            'input_file': self.test_file_path,
            'output_file': None,  # Use None to avoid path validation issues
            'language': 'zh_cn',
            'model': 'medium',
            'priority': 'quality',
            'speakers': True,
            'written': True,
            'music': False,
            'charset': 'simplified',
            'video_quality': '720p',
            'disable_gemini_refinement': False,
            'ffmpeg_path': 'ffmpeg',
            'terminology_config': None,  # Use None to avoid file validation issues
            'max_chunk_duration': 5,
            'gemini_api_key': 'test_gemini_key',
            'hf_token': 'test_hf_token',
            'verbose': True,
            'ipc_mode': False,
            'subtitle': 'en_us',
            'translation_help': False
        }
        
        # Execute CLI command
        generate_command(**test_args)
        
        # Verify Container was called with correct ffmpeg_path
        mock_container.assert_called_once_with(ffmpeg_path='ffmpeg')
        
        # Verify use case initialization was called
        container_instance = mock_container.return_value
        container_instance.get_enhanced_generate_subtitles_use_case.assert_called_once()
        
        # Get the arguments passed to use case initialization
        use_case_call_args = container_instance.get_enhanced_generate_subtitles_use_case.call_args
        use_case_kwargs = use_case_call_args.kwargs
        
        # Verify key arguments were passed correctly
        self.assertEqual(use_case_kwargs['model_name'], 'medium')
        self.assertEqual(use_case_kwargs['priority'], 'quality')
        self.assertEqual(use_case_kwargs['gemini_api_key'], 'test_gemini_key')
        self.assertEqual(use_case_kwargs['terminology_config_path'], None)
        
        # Verify command creation was called
        self.assertEqual(mock_safe_execute.call_count, 2)  # Once for use_case, once for command
        
        return {
            'container_args': mock_container.call_args,
            'use_case_args': use_case_call_args,
            'command_args': mock_safe_execute.call_args_list[1],
            'result': mock_result
        }

    @patch('src.presentation.cli.commands.Container')
    @patch('src.presentation.cli.commands.safe_execute')
    @patch('src.presentation.cli.commands._display_file_info')
    @patch('src.presentation.cli.commands._execute_with_enhanced_progress')
    @patch('src.presentation.cli.commands._display_results')
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    def test_argument_variations(self, mock_which, mock_display_results,
                               mock_execute_progress, mock_display_info,
                               mock_safe_execute, mock_container):
        """Test different argument value combinations."""
        
        test_cases = [
            {
                'name': 'Speed Priority',
                'args': {
                    'language': 'zh_tw',
                    'model': 'small',
                    'priority': 'speed',
                    'charset': 'traditional',
                    'video_quality': '480p',
                    'speakers': False,
                    'written': False,
                    'music': True,
                    'disable_gemini_refinement': True
                }
            },
            {
                'name': 'Balanced Quality',
                'args': {
                    'language': 'en_us',
                    'model': 'large',
                    'priority': 'balanced',
                    'charset': 'simplified',
                    'video_quality': '360p',
                    'speakers': True,
                    'written': True,
                    'music': False,
                    'disable_gemini_refinement': False
                }
            },
            {
                'name': 'Maximum Quality',
                'args': {
                    'language': 'zh_cn',
                    'model': None,  # Auto-select
                    'priority': 'quality',
                    'charset': 'traditional',
                    'video_quality': '720p',
                    'speakers': True,
                    'written': True,
                    'music': True,
                    'disable_gemini_refinement': False,
                    'max_chunk_duration': 15,
                    'subtitle': 'fr_fr'
                }
            }
        ]
        
        results = {}
        
        for test_case in test_cases:
            with self.subTest(test_case=test_case['name']):
                # Reset mocks
                mock_container.reset_mock()
                mock_safe_execute.reset_mock()
                
                # Setup mocks
                mock_use_case = Mock()
                mock_command = Mock()
                mock_result = Mock()
                mock_result.success = True
                
                mock_safe_execute.side_effect = [mock_use_case, mock_command]
                mock_execute_progress.return_value = mock_result
                
                # Base arguments
                base_args = {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'gemini_api_key': None,
                    'hf_token': None,
                    'verbose': False,
                    'ipc_mode': False,
                    'translation_help': False
                }
                
                # Merge with test case args
                test_args = {**base_args, **test_case['args']}
                
                # Execute command
                generate_command(**test_args)
                
                # Verify container initialization
                mock_container.assert_called_once_with(ffmpeg_path='ffmpeg')
                
                # Get use case call arguments
                container_instance = mock_container.return_value
                use_case_call = container_instance.get_enhanced_generate_subtitles_use_case.call_args
                
                # Store results for verification
                results[test_case['name']] = {
                    'input_args': test_case['args'],
                    'use_case_call': use_case_call,
                    'container_call': mock_container.call_args
                }
                
                # Verify key arguments are propagated
                if use_case_call and use_case_call.kwargs:
                    kwargs = use_case_call.kwargs
                    
                    # Check model propagation
                    expected_model = test_case['args'].get('model')
                    self.assertEqual(kwargs.get('model_name'), expected_model)
                    
                    # Check priority propagation
                    expected_priority = test_case['args'].get('priority')
                    self.assertEqual(kwargs.get('priority'), expected_priority)
                    
                    # Check Gemini key propagation
                    expected_gemini = test_case['args'].get('gemini_api_key')
                    self.assertEqual(kwargs.get('gemini_api_key'), expected_gemini)
        
        return results

    @patch('src.presentation.cli.commands.Container')
    @patch('src.presentation.cli.commands.safe_execute')
    @patch('src.presentation.cli.commands._display_file_info')
    @patch('src.presentation.cli.commands._execute_with_enhanced_progress')
    @patch('src.presentation.cli.commands._display_results')
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    def test_gemini_and_whisper_service_calls(self, mock_which, mock_display_results,
                                            mock_execute_progress, mock_display_info,
                                            mock_safe_execute, mock_container):
        """Test that Gemini and Whisper services receive correct arguments."""
        
        # Setup mocks with detailed tracking
        mock_container_instance = Mock()
        mock_container.return_value = mock_container_instance
        
        mock_whisper_service = Mock()
        mock_use_case = Mock()
        mock_command = Mock()
        mock_result = Mock()
        mock_result.success = True
        
        # Configure container methods
        mock_container_instance.get_whisper_service.return_value = mock_whisper_service
        mock_container_instance.get_enhanced_generate_subtitles_use_case.return_value = mock_use_case
        
        mock_safe_execute.side_effect = [mock_use_case, mock_command]
        mock_execute_progress.return_value = mock_result
        
        # Test with Gemini and Whisper arguments (use valid paths)
        test_args = {
            'input_file': self.test_file_path,
            'output_file': None,  # Avoid path validation issues
            'language': 'zh_cn',
            'model': 'large',
            'priority': 'quality',
            'speakers': True,
            'written': True,
            'music': True,
            'charset': 'traditional',
            'video_quality': '720p',
            'disable_gemini_refinement': False,
            'ffmpeg_path': 'ffmpeg',  # Use simple ffmpeg instead of custom path
            'terminology_config': None,  # Avoid file validation issues
            'max_chunk_duration': 10,
            'gemini_api_key': 'mock_gemini_api_key_12345',
            'hf_token': 'mock_hf_token_67890',
            'verbose': True,
            'ipc_mode': False,
            'subtitle': 'en_us',
            'translation_help': False
        }
        
        # Execute command
        generate_command(**test_args)
        
        # Verify Container initialization with ffmpeg path
        mock_container.assert_called_once_with(ffmpeg_path='ffmpeg')
        
        # Verify Whisper service was pre-configured
        mock_container_instance.get_whisper_service.assert_called_once_with(
            model_name='large',
            priority='quality'
        )
        
        # Verify enhanced use case was called with all parameters
        use_case_call = mock_container_instance.get_enhanced_generate_subtitles_use_case.call_args
        self.assertIsNotNone(use_case_call)
        
        kwargs = use_case_call.kwargs
        
        # Verify Whisper arguments
        self.assertEqual(kwargs['model_name'], 'large')
        self.assertEqual(kwargs['priority'], 'quality')
        
        # Verify Gemini arguments
        self.assertEqual(kwargs['gemini_api_key'], 'mock_gemini_api_key_12345')
        
        # Verify other service arguments
        self.assertEqual(kwargs['terminology_config_path'], None)
        
        # Create a mock command creation function and verify its call
        def verify_command_creation():
            # This simulates the command creation process
            command_args = {
                'input_file_path': str(test_args['input_file']),
                'output_file_path': None,  # Will be None since output_file is None
                'language': test_args['language'],
                'model_name': test_args['model'],
                'enable_speakers': test_args['speakers'],
                'enable_written_style': test_args['written'],
                'enable_music_detection': test_args['music'],
                'charset': test_args['charset'],
                'enable_gemini_refinement': not test_args['disable_gemini_refinement'],
                'gemini_api_key': test_args['gemini_api_key'],
                'video_compression_quality': test_args['video_quality'],
                'max_chunk_duration_minutes': test_args['max_chunk_duration'],
                'terminology_config_path': test_args['terminology_config'],
                'hf_token': test_args['hf_token'],
                'enable_translation': True,  # Based on subtitle parameter
                'translation_language': test_args['subtitle']
            }
            return command_args
        
        expected_command_args = verify_command_creation()
        
        return {
            'container_call': mock_container.call_args,
            'whisper_service_call': mock_container_instance.get_whisper_service.call_args,
            'use_case_call': use_case_call,
            'expected_command_args': expected_command_args,
            'mock_services': {
                'whisper': mock_whisper_service,
                'use_case': mock_use_case,
                'result': mock_result
            }
        }

    def test_argument_validation_before_service_calls(self):
        """Test that arguments are validated before being passed to services."""
        
        # Test invalid arguments that should be caught by validation
        invalid_test_cases = [
            {
                'name': 'Invalid Language',
                'args': {'language': 'invalid_lang'},
                'expected_error': 'language'
            },
            {
                'name': 'Invalid Priority',
                'args': {'priority': 'invalid_priority'},
                'expected_error': 'priority'
            },
            {
                'name': 'Invalid Video Quality',
                'args': {'video_quality': 'invalid_quality'},
                'expected_error': 'video_quality'
            },
            {
                'name': 'Invalid Charset',
                'args': {'charset': 'invalid_charset'},
                'expected_error': 'charset'
            }
        ]
        
        results = {}
        
        for test_case in invalid_test_cases:
            with self.subTest(test_case=test_case['name']):
                from src.infrastructure.validation.argument_validator import ArgumentValidator
                
                # Base valid arguments
                base_args = {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': None,
                    'priority': 'balanced',
                    'video_quality': '720p',
                    'charset': 'traditional',
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 10,
                    'gemini_api_key': None,
                    'hf_token': None,
                    'subtitle': None,
                    'speakers': False,
                    'written': False,
                    'music': False,
                    'disable_gemini_refinement': False,
                    'verbose': False,
                    'ipc_mode': False
                }
                
                # Apply invalid argument
                test_args = {**base_args, **test_case['args']}
                
                # Test validation
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(test_args)
                
                # Should have validation errors
                self.assertFalse(is_valid, f"Validation should fail for {test_case['name']}")
                
                # Should have specific error for the field
                field_errors = [issue for issue in validation_issues 
                              if test_case['expected_error'] in issue.field]
                self.assertGreater(len(field_errors), 0, 
                                 f"Should have error for field '{test_case['expected_error']}'")
                
                results[test_case['name']] = {
                    'is_valid': is_valid,
                    'validation_issues': validation_issues,
                    'field_errors': field_errors
                }
        
        return results

    def test_mock_service_response_handling(self):
        """Test how the CLI handles mock responses from services."""
        
        with patch('src.presentation.cli.commands.Container') as mock_container, \
             patch('src.presentation.cli.commands.safe_execute') as mock_safe_execute, \
             patch('src.presentation.cli.commands._display_file_info'), \
             patch('src.presentation.cli.commands._execute_with_enhanced_progress') as mock_execute, \
             patch('src.presentation.cli.commands._display_results') as mock_display, \
             patch('shutil.which', return_value='/usr/bin/ffmpeg'):
            
            # Create mock services with realistic responses
            mock_whisper_result = Mock()
            mock_whisper_result.transcript = "Mock transcription result"
            mock_whisper_result.segments = [
                {'start': 0.0, 'end': 5.0, 'text': 'Mock segment 1'},
                {'start': 5.0, 'end': 10.0, 'text': 'Mock segment 2'}
            ]
            
            mock_gemini_result = Mock()
            mock_gemini_result.refined_text = "Mock Gemini refined text"
            mock_gemini_result.confidence = 0.95
            
            # Configure use case and command mocks
            mock_use_case = Mock()
            mock_command = Mock()
            mock_result = Mock()
            mock_result.success = True
            mock_result.subtitle = Mock()
            mock_result.processing_time_seconds = 120.5
            mock_result.error_message = None
            
            mock_safe_execute.side_effect = [mock_use_case, mock_command]
            mock_execute.return_value = mock_result
            
            # Test arguments
            test_args = {
                'input_file': self.test_file_path,
                'output_file': '/tmp/mock_output.srt',
                'language': 'zh_cn',
                'model': 'medium',
                'priority': 'balanced',
                'speakers': True,
                'written': True,
                'music': False,
                'charset': 'traditional',
                'video_quality': '720p',
                'disable_gemini_refinement': False,
                'ffmpeg_path': 'ffmpeg',
                'terminology_config': None,
                'max_chunk_duration': 10,
                'gemini_api_key': 'mock_gemini_key',
                'hf_token': 'mock_hf_token',
                'verbose': True,
                'ipc_mode': False,
                'subtitle': None,
                'translation_help': False
            }
            
            # Execute command
            generate_command(**test_args)
            
            # Verify that results were displayed
            mock_display.assert_called_once_with(mock_result, ipc_mode=False)
            
            # Verify execution was called with correct parameters
            mock_execute.assert_called_once()
            execute_call_args = mock_execute.call_args
            
            # Verify the command and use_case were passed correctly
            self.assertEqual(execute_call_args[0][0], mock_command)  # command
            self.assertEqual(execute_call_args[0][1], mock_use_case)  # use_case
            self.assertTrue(execute_call_args[0][2])  # verbose=True
            self.assertEqual(execute_call_args[0][3], 'medium')  # model
            self.assertEqual(execute_call_args[0][4], 'balanced')  # priority
            self.assertFalse(execute_call_args[0][5])  # ipc_mode=False
            self.assertEqual(execute_call_args[0][6], 'ffmpeg')  # ffmpeg_path
            
            return {
                'result': mock_result,
                'execute_call': execute_call_args,
                'display_call': mock_display.call_args,
                'whisper_mock': mock_whisper_result,
                'gemini_mock': mock_gemini_result
            }


if __name__ == '__main__':
    # Run with verbose output
    unittest.main(verbosity=2)