"""Tests for Timestamp value object."""

import pytest
from datetime import timedelta

from cantocap.domain.value_objects import Timestamp


class TestTimestamp:
    """Test suite for Timestamp value object."""
    
    def test_create_from_seconds(self):
        """Test creating timestamp from seconds."""
        timestamp = Timestamp.from_seconds(120.5)
        assert timestamp.seconds == 120.5
    
    def test_create_from_milliseconds(self):
        """Test creating timestamp from milliseconds."""
        timestamp = Timestamp.from_milliseconds(120500)
        assert timestamp.seconds == 120.5
    
    def test_create_from_timedelta(self):
        """Test creating timestamp from timedelta."""
        td = timedelta(minutes=2, milliseconds=500)
        timestamp = Timestamp.from_timedelta(td)
        assert timestamp.seconds == 120.5
    
    def test_negative_seconds_raises_error(self):
        """Test that negative seconds raises ValueError."""
        with pytest.raises(ValueError, match="cannot be negative"):
            Timestamp.from_seconds(-10)
    
    def test_excessive_seconds_raises_error(self):
        """Test that excessive seconds raises ValueError."""
        with pytest.raises(ValueError, match="cannot exceed 24 hours"):
            Timestamp.from_seconds(90000)  # > 24 hours
    
    def test_to_timedelta(self):
        """Test conversion to timedelta."""
        timestamp = Timestamp.from_seconds(120.5)
        td = timestamp.to_timedelta()
        assert isinstance(td, timedelta)
        assert td.total_seconds() == 120.5
    
    def test_to_milliseconds(self):
        """Test conversion to milliseconds."""
        timestamp = Timestamp.from_seconds(120.5)
        assert timestamp.to_milliseconds() == 120500
    
    def test_to_srt_format(self):
        """Test SRT format conversion."""
        timestamp = Timestamp.from_seconds(3661.5)  # 1 hour, 1 minute, 1.5 seconds
        assert timestamp.to_srt_format() == "01:01:01,500"
    
    def test_addition_with_timestamp(self):
        """Test addition with another timestamp."""
        t1 = Timestamp.from_seconds(10)
        t2 = Timestamp.from_seconds(5)
        result = t1 + t2
        assert result.seconds == 15
    
    def test_addition_with_float(self):
        """Test addition with float."""
        timestamp = Timestamp.from_seconds(10)
        result = timestamp + 5.5
        assert result.seconds == 15.5
    
    def test_subtraction_with_timestamp(self):
        """Test subtraction with another timestamp."""
        t1 = Timestamp.from_seconds(10)
        t2 = Timestamp.from_seconds(5)
        result = t1 - t2
        assert result.seconds == 5
    
    def test_subtraction_with_float(self):
        """Test subtraction with float."""
        timestamp = Timestamp.from_seconds(10)
        result = timestamp - 3.5
        assert result.seconds == 6.5
    
    def test_subtraction_negative_result_raises_error(self):
        """Test that negative subtraction result raises error."""
        t1 = Timestamp.from_seconds(5)
        t2 = Timestamp.from_seconds(10)
        with pytest.raises(ValueError, match="cannot be negative"):
            t1 - t2
    
    def test_comparison_operations(self):
        """Test timestamp comparison operations."""
        t1 = Timestamp.from_seconds(10)
        t2 = Timestamp.from_seconds(15)
        t3 = Timestamp.from_seconds(10)
        
        assert t1 < t2
        assert t1 <= t2
        assert t1 <= t3
        assert t2 > t1
        assert t2 >= t1
        assert t1 >= t3
    
    def test_immutability(self):
        """Test that timestamp is immutable."""
        timestamp = Timestamp.from_seconds(10)
        with pytest.raises(AttributeError):
            timestamp.seconds = 20