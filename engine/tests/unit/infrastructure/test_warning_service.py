"""Tests for AccuracyWarningService."""

import unittest
from unittest.mock import Mock, patch

from rich.console import Console

from src.infrastructure.services.warning_service import AccuracyWarningService, WarningLevel


class TestAccuracyWarningService(unittest.TestCase):
    """Test cases for AccuracyWarningService."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_console = Mock(spec=Console)
        self.service = AccuracyWarningService(console=self.mock_console)

    def test_init_with_custom_console(self):
        """Test initialization with custom console."""
        self.assertEqual(self.service.console, self.mock_console)
        self.assertEqual(self.service.warnings_issued, [])

    def test_init_with_default_console(self):
        """Test initialization with default console."""
        service = AccuracyWarningService()
        self.assertIsInstance(service.console, Console)
        self.assertEqual(service.warnings_issued, [])

    def test_warn_missing_gemini_key(self):
        """Test warning for missing Gemini API key."""
        impact_features = ["Speaker diarization", "Transcription refinement"]
        
        self.service.warn_missing_gemini_key(impact_features)
        
        # Check that console.print was called
        self.mock_console.print.assert_called_once()
        
        # Check that warning was recorded
        self.assertIn("missing_gemini_key", self.service.warnings_issued)
        self.assertEqual(len(self.service.warnings_issued), 1)

    def test_warn_chunking_required(self):
        """Test warning for file chunking requirements."""
        file_size_mb = 150.5
        chunk_count = 3
        
        self.service.warn_chunking_required(file_size_mb, chunk_count)
        
        # Check that console.print was called
        self.mock_console.print.assert_called_once()
        
        # Check that warning was recorded
        self.assertIn("chunking_required", self.service.warnings_issued)

    def test_warn_rate_limit_risk_high_usage(self):
        """Test rate limit warning when usage is above threshold."""
        estimated_tokens = 8500  # 85% of 10000
        rate_limit = 10000
        
        self.service.warn_rate_limit_risk(estimated_tokens, rate_limit)
        
        # Should trigger warning (85% > 80% threshold)
        self.mock_console.print.assert_called_once()
        self.assertIn("rate_limit_risk", self.service.warnings_issued)

    def test_warn_rate_limit_risk_low_usage(self):
        """Test rate limit warning when usage is below threshold."""
        estimated_tokens = 5000  # 50% of 10000
        rate_limit = 10000
        
        self.service.warn_rate_limit_risk(estimated_tokens, rate_limit)
        
        # Should not trigger warning (50% < 80% threshold)
        self.mock_console.print.assert_not_called()
        self.assertNotIn("rate_limit_risk", self.service.warnings_issued)

    def test_warn_rate_limit_risk_at_threshold(self):
        """Test rate limit warning exactly at threshold."""
        estimated_tokens = 8000  # Exactly 80% of 10000
        rate_limit = 10000
        
        self.service.warn_rate_limit_risk(estimated_tokens, rate_limit)
        
        # Should not trigger warning (80% == 80% threshold, not >)
        self.mock_console.print.assert_not_called()
        self.assertNotIn("rate_limit_risk", self.service.warnings_issued)

    def test_warn_missing_dependencies_google_generativeai(self):
        """Test warning for missing google-generativeai dependency."""
        missing_deps = ["google-generativeai"]
        feature_impact = "Gemini-based features will be disabled"
        
        self.service.warn_missing_dependencies(missing_deps, feature_impact)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("missing_dependencies", self.service.warnings_issued)

    def test_warn_missing_dependencies_python_dotenv(self):
        """Test warning for missing python-dotenv dependency."""
        missing_deps = ["python-dotenv"]
        feature_impact = "Environment file loading will be disabled"
        
        self.service.warn_missing_dependencies(missing_deps, feature_impact)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("missing_dependencies", self.service.warnings_issued)

    def test_warn_missing_dependencies_multiple(self):
        """Test warning for multiple missing dependencies."""
        missing_deps = ["google-generativeai", "python-dotenv", "other-package"]
        feature_impact = "Multiple features will be disabled"
        
        self.service.warn_missing_dependencies(missing_deps, feature_impact)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("missing_dependencies", self.service.warnings_issued)

    def test_warn_file_too_large(self):
        """Test warning for files that are too large."""
        file_size_mb = 500.0
        max_size_mb = 200.0
        
        self.service.warn_file_too_large(file_size_mb, max_size_mb)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("file_too_large", self.service.warnings_issued)

    def test_warn_compression_failed(self):
        """Test warning for compression failures."""
        original_size_mb = 300.0
        error_message = "FFmpeg encoder failed"
        
        self.service.warn_compression_failed(original_size_mb, error_message)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("compression_failed", self.service.warnings_issued)

    def test_info_fallback_mode(self):
        """Test informational message for fallback mode."""
        disabled_features = ["Speaker diarization", "Music detection", "LLM refinement"]
        
        self.service.info_fallback_mode(disabled_features)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("fallback_mode", self.service.warnings_issued)

    def test_has_warned_true(self):
        """Test has_warned returns True for issued warnings."""
        # Issue a warning
        self.service.warn_missing_gemini_key(["Feature"])
        
        result = self.service.has_warned("missing_gemini_key")
        
        self.assertTrue(result)

    def test_has_warned_false(self):
        """Test has_warned returns False for non-issued warnings."""
        result = self.service.has_warned("non_existent_warning")
        
        self.assertFalse(result)

    def test_get_warning_count_empty(self):
        """Test warning count when no warnings issued."""
        count = self.service.get_warning_count()
        
        self.assertEqual(count, 0)

    def test_get_warning_count_multiple(self):
        """Test warning count with multiple warnings."""
        # Issue multiple warnings
        self.service.warn_missing_gemini_key(["Feature1"])
        self.service.warn_chunking_required(100.0, 2)
        self.service.warn_file_too_large(500.0, 200.0)
        
        count = self.service.get_warning_count()
        
        self.assertEqual(count, 3)

    def test_clear_warnings(self):
        """Test clearing all warnings."""
        # Issue some warnings
        self.service.warn_missing_gemini_key(["Feature1"])
        self.service.warn_chunking_required(100.0, 2)
        
        # Verify warnings exist
        self.assertEqual(self.service.get_warning_count(), 2)
        
        # Clear warnings
        self.service.clear_warnings()
        
        # Verify warnings are cleared
        self.assertEqual(self.service.get_warning_count(), 0)
        self.assertEqual(self.service.warnings_issued, [])

    def test_multiple_same_warning_type(self):
        """Test issuing the same warning type multiple times."""
        # Issue the same warning multiple times
        self.service.warn_missing_gemini_key(["Feature1"])
        self.service.warn_missing_gemini_key(["Feature2"])
        
        # Should record each occurrence
        warning_count = self.service.warnings_issued.count("missing_gemini_key")
        self.assertEqual(warning_count, 2)
        self.assertEqual(self.service.get_warning_count(), 2)

    def test_warning_level_enum(self):
        """Test WarningLevel enum values."""
        self.assertEqual(WarningLevel.INFO.value, "info")
        self.assertEqual(WarningLevel.WARNING.value, "warning")
        self.assertEqual(WarningLevel.ERROR.value, "error")
        self.assertEqual(WarningLevel.CRITICAL.value, "critical")

    def test_warn_missing_gemini_key_empty_features(self):
        """Test warning with empty features list."""
        impact_features = []
        
        self.service.warn_missing_gemini_key(impact_features)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("missing_gemini_key", self.service.warnings_issued)

    def test_warn_missing_dependencies_empty_list(self):
        """Test warning with empty dependencies list."""
        missing_deps = []
        feature_impact = "No impact"
        
        self.service.warn_missing_dependencies(missing_deps, feature_impact)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("missing_dependencies", self.service.warnings_issued)

    def test_info_fallback_mode_empty_features(self):
        """Test fallback mode info with empty features list."""
        disabled_features = []
        
        self.service.info_fallback_mode(disabled_features)
        
        self.mock_console.print.assert_called_once()
        self.assertIn("fallback_mode", self.service.warnings_issued)

    def test_warning_deduplication_check(self):
        """Test that has_warned can be used for deduplication."""
        # First time issuing warning
        if not self.service.has_warned("missing_gemini_key"):
            self.service.warn_missing_gemini_key(["Feature"])
        
        # Second time - should not issue again
        if not self.service.has_warned("missing_gemini_key"):
            self.service.warn_missing_gemini_key(["Feature"])
        
        # Should only have one warning
        self.assertEqual(self.service.get_warning_count(), 1)
        self.mock_console.print.assert_called_once()

    def test_rate_limit_edge_cases(self):
        """Test rate limit warning edge cases."""
        # Test with zero rate limit (should not crash)
        self.service.warn_rate_limit_risk(1000, 0)
        self.mock_console.print.assert_not_called()
        
        # Test with negative values (should not crash)
        self.service.warn_rate_limit_risk(-100, 1000)
        self.mock_console.print.assert_not_called()

    def test_file_size_edge_cases(self):
        """Test file size warnings with edge cases."""
        # Test with zero sizes
        self.service.warn_file_too_large(0.0, 100.0)
        self.mock_console.print.assert_called()
        self.mock_console.reset_mock()
        
        # Test with negative sizes (should not crash)
        self.service.warn_compression_failed(-10.0, "Test error")
        self.mock_console.print.assert_called()


if __name__ == '__main__':
    unittest.main()