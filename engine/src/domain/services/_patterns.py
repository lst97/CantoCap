"""Shared regex patterns for domain services."""

import re

# Language detection patterns
CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]+')
ENGLISH_PATTERN = re.compile(r'[a-zA-Z]+')

# Punctuation patterns
PUNCTUATION_PATTERN = re.compile(r'[.,!?;:()"]')
COMPLEX_PUNCTUATION_PATTERN = re.compile(r'[""''—…]')

# Text breaking patterns
CHINESE_BREAK_POINTS = [',', '，', '。', '？', '！', '；', '：']

# Common English words for naturalness assessment
COMMON_ENGLISH_WORDS = {
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had'
}

def get_text_cleaning_patterns():
    """Get patterns for text cleaning."""
    return {
        'whitespace': re.compile(r'\s+'),
        'speaker_tags': re.compile(r'^\[SPEAKER_\d+\]\s*'),
        'artifacts': re.compile(r'\[.*?\]'),  # Remove [noise], [music] etc.
        'unclear': re.compile(r'\(.*?\)'),   # Remove (unclear) etc.
        'trailing_punct': re.compile(r'[.,!?]+\s*$'),
        'duplicate_punct': {
            '。': re.compile(r'。。+'),
            '，': re.compile(r'，，+'),
            '？': re.compile(r'？？+'),
            '！': re.compile(r'！！+'),
        }
    }