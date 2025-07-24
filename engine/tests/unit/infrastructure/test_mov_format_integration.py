"""Integration test to verify .mov format support works end-to-end."""

import unittest
from unittest.mock import Mock, patch
import tempfile
import os

from src.infrastructure.validation.argument_validator import ArgumentValidator


class TestMovFormatIntegration(unittest.TestCase):
    """Integration test for .mov format support."""

    def test_mov_format_end_to_end_validation(self):
        """Test complete .mov format validation pipeline."""
        # Create a temporary .mov file
        with tempfile.NamedTemporaryFile(suffix='.mov', delete=False) as temp_file:
            temp_path = temp_file.name
            # Write some dummy content to make it a real file
            temp_file.write(b"dummy mov file content")
        
        try:
            # Test 1: Direct file path validation
            result = ArgumentValidator.validate_file_path(
                temp_path,
                field_name='input_file',
                must_exist=True,
                must_be_file=True,
                allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                check_readable=True
            )
            
            self.assertTrue(result.is_valid, 
                          f"Direct file validation failed for .mov: {result.get_error_messages()}")
            
            # Test 2: Complete argument validation (the flow that the CLI uses)
            args = {
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
            
            is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(args)
            
            # Filter for format-specific issues (the main concern)
            format_issues = [issue for issue in validation_issues 
                           if 'input_file' in issue.field and 'not supported' in issue.message]
            
            self.assertEqual(len(format_issues), 0, 
                           f".mov format should be fully supported: {format_issues}")
            
            # Test 3: Verify that the supported formats constant includes .mov
            self.assertIn('.mov', ArgumentValidator.SUPPORTED_VIDEO_FORMATS,
                         ".mov should be in SUPPORTED_VIDEO_FORMATS")
            self.assertIn('.mov', ArgumentValidator.SUPPORTED_FORMATS,
                         ".mov should be in combined SUPPORTED_FORMATS")
            
            print("✅ .mov format validation test passed completely!")
            print(f"✅ .mov file validated successfully: {temp_path}")
            print(f"✅ Supported video formats: {sorted(ArgumentValidator.SUPPORTED_VIDEO_FORMATS)}")
            
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_format_constants_completeness(self):
        """Verify that format constants are comprehensive and include expected formats."""
        # Test video formats
        expected_video_formats = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'}
        actual_video_formats = ArgumentValidator.SUPPORTED_VIDEO_FORMATS
        
        self.assertTrue(expected_video_formats.issubset(actual_video_formats),
                       f"Missing video formats: {expected_video_formats - actual_video_formats}")
        
        # Test audio formats  
        expected_audio_formats = {'.wav', '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.opus'}
        actual_audio_formats = ArgumentValidator.SUPPORTED_AUDIO_FORMATS
        
        self.assertTrue(expected_audio_formats.issubset(actual_audio_formats),
                       f"Missing audio formats: {expected_audio_formats - actual_audio_formats}")
        
        # Test combined formats
        expected_combined = expected_video_formats | expected_audio_formats
        actual_combined = ArgumentValidator.SUPPORTED_FORMATS
        
        self.assertTrue(expected_combined.issubset(actual_combined),
                       f"Missing combined formats: {expected_combined - actual_combined}")
        
        print(f"✅ Format constants validation passed")
        print(f"✅ Video formats ({len(actual_video_formats)}): {sorted(actual_video_formats)}")
        print(f"✅ Audio formats ({len(actual_audio_formats)}): {sorted(actual_audio_formats)}")

    def test_case_insensitive_mov_variants(self):
        """Test that .mov format works regardless of case."""
        mov_variants = ['.mov', '.MOV', '.Mov', '.mOv']
        
        for variant in mov_variants:
            with self.subTest(variant=variant):
                # Create temporary file with case variant
                with tempfile.NamedTemporaryFile(suffix=variant, delete=False) as temp_file:
                    temp_path = temp_file.name
                    temp_file.write(b"test content")
                
                try:
                    result = ArgumentValidator.validate_file_path(
                        temp_path,
                        field_name='input_file',
                        must_exist=True,
                        must_be_file=True,
                        allowed_extensions=ArgumentValidator.SUPPORTED_FORMATS,
                        check_readable=True
                    )
                    
                    self.assertTrue(result.is_valid, 
                                  f"Case variant {variant} should be supported: {result.get_error_messages()}")
                    
                finally:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
        
        print(f"✅ Case insensitive validation passed for variants: {mov_variants}")


if __name__ == '__main__':
    unittest.main()