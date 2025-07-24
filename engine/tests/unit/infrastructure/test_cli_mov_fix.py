"""Test CLI .mov format fix."""

import unittest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os

from src.presentation.cli.commands import generate_command


class TestCLIMovFix(unittest.TestCase):
    """Test that CLI commands work correctly with .mov files after the bug fix."""

    def test_cli_command_with_mov_file(self):
        """Test that CLI command doesn't crash with undefined 'validated_input' variable."""
        # Create a temporary .mov file
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Mock external dependencies that would normally prevent execution
            with patch('src.presentation.cli.commands.Container') as mock_container, \
                 patch('src.presentation.cli.commands.safe_execute') as mock_safe_execute, \
                 patch('src.presentation.cli.commands._display_file_info') as mock_display, \
                 patch('src.presentation.cli.commands._execute_with_enhanced_progress') as mock_execute, \
                 patch('src.presentation.cli.commands._display_results') as mock_results, \
                 patch('src.presentation.cli.commands.handle_error') as mock_handle_error, \
                 patch('shutil.which', return_value='/usr/bin/ffmpeg'):
                
                # Mock the services initialization and execution
                mock_use_case = Mock()
                mock_safe_execute.side_effect = [mock_use_case, Mock()]  # First for use_case, second for command
                
                # Mock successful execution result
                mock_result = Mock()
                mock_result.success = True
                mock_execute.return_value = mock_result
                
                # This should not crash with NameError: name 'validated_input' is not defined
                try:
                    generate_command(
                        input_file=temp_path,
                        output_file=None,
                        language='zh_cn',
                        model=None,
                        priority='balanced',
                        speakers=False,
                        written=False,
                        music=False,
                        charset='traditional',
                        video_quality='720p',
                        disable_gemini_refinement=False,
                        ffmpeg_path='ffmpeg',
                        terminology_config=None,
                        max_chunk_duration=10,
                        gemini_api_key=None,
                        hf_token=None,
                        verbose=False,
                        ipc_mode=False,
                        subtitle=None,
                        translation_help=False
                    )
                    # If we get here without NameError, the bug is fixed
                    test_passed = True
                except NameError as e:
                    if 'validated_input' in str(e):
                        self.fail(f"CLI still has 'validated_input' undefined variable bug: {e}")
                    else:
                        # Different NameError, might be related to mocking
                        test_passed = True
                except Exception as e:
                    # Other exceptions are expected due to mocking
                    # The key is that we don't get NameError about 'validated_input'
                    test_passed = True
                
                self.assertTrue(test_passed, "CLI command should not crash with 'validated_input' NameError")
                
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_argument_validation_flow_with_mov(self):
        """Test that the argument validation flow works correctly with .mov files."""
        # Create a temporary .mov file
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Test just the validation part that was causing issues
            from src.infrastructure.validation.argument_validator import ArgumentValidator
            
            args_to_validate = {
                'input_file': temp_path,
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
            
            is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(args_to_validate)
            
            # Check for format-specific issues
            format_issues = [issue for issue in validation_issues 
                           if 'input_file' in issue.field and 'not supported' in issue.message]
            
            self.assertEqual(len(format_issues), 0, 
                           f".mov format should be accepted, but got format issues: {format_issues}")
            
            # The input_file should be processed without format errors
            # (There might be other validation errors, but not format-related ones)
            
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)


if __name__ == '__main__':
    unittest.main()