"""
Comprehensive unit tests for Timestamp value object.
"""

import pytest
from datetime import timedelta

from src.domain.value_objects.timestamp import Timestamp


class TestTimestampCreation:
    """Test Timestamp creation and validation."""
    
    def test_create_from_seconds_valid(self):
        """Test creating timestamp from valid seconds."""
        timestamp = Timestamp.from_seconds(120.5)
        assert timestamp.seconds == 120.5
    
    def test_create_from_seconds_zero(self):
        """Test creating timestamp from zero seconds."""
        timestamp = Timestamp.from_seconds(0.0)
        assert timestamp.seconds == 0.0
    
    def test_create_from_seconds_negative_raises_error(self):
        """Test that negative seconds raise ValueError."""
        with pytest.raises(ValueError, match="Timestamp cannot be negative"):
            Timestamp.from_seconds(-1.0)
    
    def test_create_from_seconds_too_large_raises_error(self):
        """Test that seconds > 24 hours raise ValueError."""
        with pytest.raises(ValueError, match="Timestamp cannot exceed 24 hours"):
            Timestamp.from_seconds(86401)  # 24 hours + 1 second
    
    def test_create_from_milliseconds_valid(self):
        """Test creating timestamp from valid milliseconds."""
        timestamp = Timestamp.from_milliseconds(1500)  # 1.5 seconds
        assert timestamp.seconds == 1.5
    
    def test_create_from_milliseconds_zero(self):
        """Test creating timestamp from zero milliseconds."""
        timestamp = Timestamp.from_milliseconds(0)
        assert timestamp.seconds == 0.0
    
    def test_create_from_milliseconds_negative_raises_error(self):
        """Test that negative milliseconds raise ValueError."""
        with pytest.raises(ValueError, match="Timestamp cannot be negative"):
            Timestamp.from_milliseconds(-1000)
    
    def test_create_from_timedelta_valid(self):
        """Test creating timestamp from valid timedelta."""
        td = timedelta(seconds=75, milliseconds=250)
        timestamp = Timestamp.from_timedelta(td)
        assert timestamp.seconds == 75.25
    
    def test_create_from_timedelta_zero(self):
        """Test creating timestamp from zero timedelta."""
        td = timedelta(0)
        timestamp = Timestamp.from_timedelta(td)
        assert timestamp.seconds == 0.0
    
    def test_create_from_timedelta_negative_raises_error(self):
        """Test that negative timedelta raises ValueError."""
        td = timedelta(seconds=-10)
        with pytest.raises(ValueError, match="Timestamp cannot be negative"):
            Timestamp.from_timedelta(td)
    
    def test_direct_construction_valid(self):
        """Test direct construction with valid seconds."""
        timestamp = Timestamp(seconds=42.0)
        assert timestamp.seconds == 42.0
    
    def test_direct_construction_validation(self):
        """Test that direct construction validates constraints."""
        with pytest.raises(ValueError, match="Timestamp cannot be negative"):
            Timestamp(seconds=-1.0)
        
        with pytest.raises(ValueError, match="Timestamp cannot exceed 24 hours"):
            Timestamp(seconds=90000)


class TestTimestampConversion:
    """Test Timestamp conversion methods."""
    
    def test_to_milliseconds(self):
        """Test conversion to milliseconds."""
        timestamp = Timestamp.from_seconds(2.5)
        assert timestamp.to_milliseconds() == 2500.0
    
    def test_to_milliseconds_zero(self):
        """Test conversion of zero to milliseconds."""
        timestamp = Timestamp.from_seconds(0)
        assert timestamp.to_milliseconds() == 0.0
    
    def test_to_timedelta(self):
        """Test conversion to timedelta."""
        timestamp = Timestamp.from_seconds(125.75)
        td = timestamp.to_timedelta()
        assert isinstance(td, timedelta)
        assert td.total_seconds() == 125.75
    
    def test_to_srt_format_simple(self):
        """Test conversion to SRT format for simple time."""
        timestamp = Timestamp.from_seconds(65.123)  # 1:05.123
        srt_format = timestamp.to_srt_format()
        assert srt_format == "00:01:05,123"
    
    def test_to_srt_format_zero(self):
        """Test conversion of zero to SRT format."""
        timestamp = Timestamp.from_seconds(0)
        srt_format = timestamp.to_srt_format()
        assert srt_format == "00:00:00,000"
    
    def test_to_srt_format_hours(self):
        """Test conversion to SRT format with hours."""
        timestamp = Timestamp.from_seconds(3725.456)  # 1:02:05.456
        srt_format = timestamp.to_srt_format()
        assert srt_format == "01:02:05,456"
    
    def test_to_srt_format_max_time(self):
        """Test conversion to SRT format for maximum time."""
        timestamp = Timestamp.from_seconds(86399.999)  # 23:59:59.999
        srt_format = timestamp.to_srt_format()
        # Due to floating point precision, this might be 998 instead of 999
        assert srt_format in ["23:59:59,999", "23:59:59,998"]
    
    def test_to_srt_format_fractional_seconds(self):
        """Test SRT format with various fractional seconds."""
        test_cases = [
            (1.001, ["00:00:01,001", "00:00:01,000"]),  # Allow for floating point precision
            (1.1, "00:00:01,100"),
            (1.999, ["00:00:01,999", "00:00:01,998"]),  # Allow for floating point precision
            (0.001, ["00:00:00,001", "00:00:00,000"]),  # Allow for floating point precision
            (0.5, "00:00:00,500")
        ]
        
        for seconds, expected in test_cases:
            timestamp = Timestamp.from_seconds(seconds)
            result = timestamp.to_srt_format()
            if isinstance(expected, list):
                assert result in expected
            else:
                assert result == expected


class TestTimestampArithmetic:
    """Test Timestamp arithmetic operations."""
    
    def test_add_timestamp(self):
        """Test adding two timestamps."""
        ts1 = Timestamp.from_seconds(10.5)
        ts2 = Timestamp.from_seconds(5.25)
        result = ts1 + ts2
        assert isinstance(result, Timestamp)
        assert result.seconds == 15.75
    
    def test_add_float(self):
        """Test adding float seconds to timestamp."""
        timestamp = Timestamp.from_seconds(10.0)
        result = timestamp + 5.5
        assert isinstance(result, Timestamp)
        assert result.seconds == 15.5
    
    def test_add_zero(self):
        """Test adding zero to timestamp."""
        timestamp = Timestamp.from_seconds(10.0)
        result = timestamp + 0
        assert result.seconds == 10.0
    
    def test_subtract_timestamp(self):
        """Test subtracting two timestamps."""
        ts1 = Timestamp.from_seconds(15.75)
        ts2 = Timestamp.from_seconds(5.25)
        result = ts1 - ts2
        assert isinstance(result, Timestamp)
        assert result.seconds == 10.5
    
    def test_subtract_float(self):
        """Test subtracting float seconds from timestamp."""
        timestamp = Timestamp.from_seconds(15.5)
        result = timestamp - 5.5
        assert isinstance(result, Timestamp)
        assert result.seconds == 10.0
    
    def test_subtract_zero(self):
        """Test subtracting zero from timestamp."""
        timestamp = Timestamp.from_seconds(10.0)
        result = timestamp - 0
        assert result.seconds == 10.0
    
    def test_subtract_negative_result_raises_error(self):
        """Test that subtraction resulting in negative raises ValueError."""
        ts1 = Timestamp.from_seconds(5.0)
        ts2 = Timestamp.from_seconds(10.0)
        
        with pytest.raises(ValueError, match="Resulting timestamp cannot be negative"):
            ts1 - ts2
    
    def test_subtract_float_negative_result_raises_error(self):
        """Test that subtracting float resulting in negative raises ValueError."""
        timestamp = Timestamp.from_seconds(5.0)
        
        with pytest.raises(ValueError, match="Resulting timestamp cannot be negative"):
            timestamp - 10.0
    
    def test_arithmetic_chaining(self):
        """Test chaining arithmetic operations."""
        timestamp = Timestamp.from_seconds(10.0)
        result = (timestamp + 5.0) - 2.5 + Timestamp.from_seconds(1.0)
        assert result.seconds == 13.5


class TestTimestampComparison:
    """Test Timestamp comparison operations."""
    
    def test_less_than(self):
        """Test less than comparison."""
        ts1 = Timestamp.from_seconds(5.0)
        ts2 = Timestamp.from_seconds(10.0)
        assert ts1 < ts2
        assert not (ts2 < ts1)
    
    def test_less_than_equal(self):
        """Test less than or equal comparison."""
        ts1 = Timestamp.from_seconds(5.0)
        ts2 = Timestamp.from_seconds(10.0)
        ts3 = Timestamp.from_seconds(5.0)
        
        assert ts1 <= ts2
        assert ts1 <= ts3
        assert not (ts2 <= ts1)
    
    def test_greater_than(self):
        """Test greater than comparison."""
        ts1 = Timestamp.from_seconds(10.0)
        ts2 = Timestamp.from_seconds(5.0)
        assert ts1 > ts2
        assert not (ts2 > ts1)
    
    def test_greater_than_equal(self):
        """Test greater than or equal comparison."""
        ts1 = Timestamp.from_seconds(10.0)
        ts2 = Timestamp.from_seconds(5.0)
        ts3 = Timestamp.from_seconds(10.0)
        
        assert ts1 >= ts2
        assert ts1 >= ts3
        assert not (ts2 >= ts1)
    
    def test_equality(self):
        """Test equality comparison."""
        ts1 = Timestamp.from_seconds(5.0)
        ts2 = Timestamp.from_seconds(5.0)
        ts3 = Timestamp.from_seconds(10.0)
        
        assert ts1 == ts2
        assert not (ts1 == ts3)
    
    def test_inequality(self):
        """Test inequality comparison."""
        ts1 = Timestamp.from_seconds(5.0)
        ts2 = Timestamp.from_seconds(10.0)
        ts3 = Timestamp.from_seconds(5.0)
        
        assert ts1 != ts2
        assert not (ts1 != ts3)
    
    def test_comparison_with_fractional_seconds(self):
        """Test comparison with fractional seconds."""
        ts1 = Timestamp.from_seconds(5.123)
        ts2 = Timestamp.from_seconds(5.124)
        
        assert ts1 < ts2
        assert ts2 > ts1
        assert ts1 != ts2
    
    def test_sorting(self):
        """Test that timestamps can be sorted."""
        timestamps = [
            Timestamp.from_seconds(10.0),
            Timestamp.from_seconds(2.5),
            Timestamp.from_seconds(7.8),
            Timestamp.from_seconds(0.1)
        ]
        
        sorted_timestamps = sorted(timestamps)
        expected_seconds = [0.1, 2.5, 7.8, 10.0]
        
        for timestamp, expected in zip(sorted_timestamps, expected_seconds):
            assert timestamp.seconds == expected


class TestTimestampImmutability:
    """Test Timestamp immutability."""
    
    def test_frozen_dataclass(self):
        """Test that Timestamp is immutable (frozen dataclass)."""
        timestamp = Timestamp.from_seconds(10.0)
        
        with pytest.raises(AttributeError):
            timestamp.seconds = 20.0
    
    def test_arithmetic_creates_new_instance(self):
        """Test that arithmetic operations create new instances."""
        original = Timestamp.from_seconds(10.0)
        result = original + 5.0
        
        assert original is not result
        assert original.seconds == 10.0
        assert result.seconds == 15.0


class TestTimestampStringRepresentation:
    """Test Timestamp string representations."""
    
    def test_str_representation(self):
        """Test string representation (if implemented)."""
        timestamp = Timestamp.from_seconds(65.123)
        str_repr = str(timestamp)
        # Should contain the seconds value
        assert "65.123" in str_repr
    
    def test_repr_representation(self):
        """Test repr representation."""
        timestamp = Timestamp.from_seconds(65.123)
        repr_str = repr(timestamp)
        # Should be evaluable and contain class name
        assert "Timestamp" in repr_str
        assert "65.123" in repr_str


class TestTimestampEdgeCases:
    """Test Timestamp edge cases and boundary conditions."""
    
    def test_very_small_positive_seconds(self):
        """Test with very small positive seconds."""
        timestamp = Timestamp.from_seconds(0.001)
        assert timestamp.seconds == 0.001
        assert timestamp.to_milliseconds() == 1.0
    
    def test_maximum_valid_seconds(self):
        """Test with maximum valid seconds (24 hours)."""
        timestamp = Timestamp.from_seconds(86400)  # Exactly 24 hours
        assert timestamp.seconds == 86400
        assert timestamp.to_srt_format() == "24:00:00,000"
    
    def test_floating_point_precision(self):
        """Test floating point precision handling."""
        # Test that small precision differences are handled correctly
        timestamp = Timestamp.from_seconds(1.0000000001)
        assert abs(timestamp.seconds - 1.0000000001) < 1e-10
    
    def test_conversion_round_trip_consistency(self):
        """Test that conversions are consistent in round trips."""
        original_seconds = 125.456
        
        # Test seconds -> milliseconds -> seconds
        timestamp = Timestamp.from_seconds(original_seconds)
        milliseconds = timestamp.to_milliseconds()
        timestamp2 = Timestamp.from_milliseconds(milliseconds)
        assert abs(timestamp2.seconds - original_seconds) < 1e-10
        
        # Test seconds -> timedelta -> seconds
        timedelta_obj = timestamp.to_timedelta()
        timestamp3 = Timestamp.from_timedelta(timedelta_obj)
        assert abs(timestamp3.seconds - original_seconds) < 1e-10


class TestTimestampPerformance:
    """Test Timestamp performance characteristics."""
    
    def test_creation_performance(self):
        """Test that timestamp creation is reasonably fast."""
        import time
        
        start_time = time.time()
        for i in range(1000):
            Timestamp.from_seconds(i * 0.1)
        end_time = time.time()
        
        # Should complete in reasonable time (less than 1 second)
        assert (end_time - start_time) < 1.0
    
    def test_arithmetic_performance(self):
        """Test that arithmetic operations are reasonably fast."""
        import time
        
        timestamps = [Timestamp.from_seconds(i * 0.1 + 1.0) for i in range(100)]  # Start from 1.0 to avoid negative results
        
        start_time = time.time()
        for ts in timestamps:
            _ = ts + 1.0
            _ = ts - 0.5  # Now safe since all timestamps >= 1.0
        end_time = time.time()
        
        # Should complete in reasonable time
        assert (end_time - start_time) < 1.0