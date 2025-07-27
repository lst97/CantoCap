"""
Enhanced quality score calculation with multi-faceted assessment.
"""

from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass
import re

from ..entities.subtitle import Subtitle, SubtitleDocument
from ..value_objects.quality_metrics import QualityMetrics, QualityIssues, QualityIssue
from ...infrastructure.services.subtitle_translation_service import TranslationResult
from ._patterns import (
    CHINESE_PATTERN, ENGLISH_PATTERN, PUNCTUATION_PATTERN, 
    COMPLEX_PUNCTUATION_PATTERN, COMMON_ENGLISH_WORDS
)


@dataclass
class QualityThresholds:
    """Quality assessment thresholds."""
    min_duration: float = 1.0
    max_duration: float = 8.0
    max_chars_per_line: int = 42
    ideal_reading_speed_wpm: float = 180
    max_reading_speed_wpm: float = 250
    min_gap_between_subtitles: float = 0.1


class EnhancedQualityScore:
    """Multi-faceted quality assessment system."""
    
    def __init__(self, thresholds: Optional[QualityThresholds] = None):
        self.thresholds = thresholds or QualityThresholds()
    
    def calculate_quality(self, document: SubtitleDocument, 
                         translation_result: Optional[TranslationResult] = None) -> QualityMetrics:
        """Calculate comprehensive quality metrics."""
        
        if not document.subtitles:
            return self._empty_quality_metrics()
        
        # Calculate each quality dimension
        technical_score, technical_details = self._technical_quality_score(document)
        linguistic_score, linguistic_details = self._linguistic_quality_score(document)
        readability_score, readability_details = self._readability_quality_score(document)
        translation_score, translation_details = self._translation_quality_score(document, translation_result)
        
        # Calculate confidence level
        confidence_level = self._calculate_confidence(document)
        
        # Collect all issues
        all_issues = []
        all_issues.extend(technical_details.get('issues', []))
        all_issues.extend(linguistic_details.get('issues', []))
        all_issues.extend(readability_details.get('issues', []))
        all_issues.extend(translation_details.get('issues', []))
        
        return QualityMetrics(
            technical_score=technical_score,
            linguistic_score=linguistic_score,
            readability_score=readability_score,
            translation_score=translation_score,
            confidence_level=confidence_level,
            technical_details=technical_details,
            linguistic_details=linguistic_details,
            readability_details=readability_details,
            translation_details=translation_details,
            all_issues=all_issues
        )
    
    def _technical_quality_score(self, document: SubtitleDocument) -> Tuple[float, Dict]:
        """Technical compliance: timing, formatting, structure."""
        issues = QualityIssues()
        details = {}
        total_subtitles = len(document.subtitles)
        
        # Timing analysis
        timing_issues = self._analyze_timing_quality(document, issues)
        details.update(timing_issues)
        
        # Formatting analysis
        formatting_issues = self._analyze_formatting_quality(document, issues)
        details.update(formatting_issues)
        
        # Structure analysis
        structure_issues = self._analyze_structure_quality(document, issues)
        details.update(structure_issues)
        
        # Calculate weighted technical score
        score = issues.calculate_weighted_score(total_subtitles)
        details['issues'] = issues.issues
        details['technical_score'] = score
        
        return score, details
    
    def _linguistic_quality_score(self, document: SubtitleDocument) -> Tuple[float, Dict]:
        """Linguistic coherence, grammar, and naturalness."""
        total_subtitles = len(document.subtitles)
        coherence_scores = []
        grammar_scores = []
        naturalness_scores = []
        issues = QualityIssues()
        
        for i, subtitle in enumerate(document.subtitles):
            # Coherence assessment
            coherence = self._assess_subtitle_coherence(subtitle, document, i)
            coherence_scores.append(coherence)
            
            # Grammar assessment
            grammar = self._assess_grammar_quality(subtitle)
            grammar_scores.append(grammar)
            if grammar < 0.7:
                issues.add_issue('grammar', 'poor_grammar', 1.0 - grammar, i)
            
            # Naturalness assessment
            naturalness = self._assess_naturalness(subtitle)
            naturalness_scores.append(naturalness)
            if naturalness < 0.6:
                issues.add_issue('naturalness', 'unnatural_flow', 1.0 - naturalness, i)
        
        # Calculate averages
        avg_coherence = sum(coherence_scores) / len(coherence_scores) if coherence_scores else 0
        avg_grammar = sum(grammar_scores) / len(grammar_scores) if grammar_scores else 0
        avg_naturalness = sum(naturalness_scores) / len(naturalness_scores) if naturalness_scores else 0
        
        # Weighted linguistic score
        linguistic_score = (avg_coherence * 0.4 + avg_grammar * 0.35 + avg_naturalness * 0.25)
        
        details = {
            'coherence_score': avg_coherence,
            'grammar_score': avg_grammar,
            'naturalness_score': avg_naturalness,
            'linguistic_score': linguistic_score,
            'issues': issues.issues
        }
        
        return linguistic_score, details
    
    def _readability_quality_score(self, document: SubtitleDocument) -> Tuple[float, Dict]:
        """Reading experience: pace, density, comprehension."""
        reading_scores = []
        pace_scores = []
        density_scores = []
        comprehension_scores = []
        issues = QualityIssues()
        
        for i, subtitle in enumerate(document.subtitles):
            # Reading pace analysis
            pace = self._assess_reading_pace(subtitle)
            pace_scores.append(pace)
            if pace < 0.6:
                issues.add_issue('readability', 'poor_pace', 1.0 - pace, i)
            
            # Information density analysis
            density = self._assess_information_density(subtitle)
            density_scores.append(density)
            if density < 0.5:
                issues.add_issue('readability', 'poor_density', 1.0 - density, i)
            
            # Comprehension ease analysis
            comprehension = self._assess_comprehension_ease(subtitle)
            comprehension_scores.append(comprehension)
            if comprehension < 0.6:
                issues.add_issue('readability', 'poor_comprehension', 1.0 - comprehension, i)
            
            # Combined reading score for this subtitle
            subtitle_readability = (pace + density + comprehension) / 3
            reading_scores.append(subtitle_readability)
        
        # Calculate averages
        avg_pace = sum(pace_scores) / len(pace_scores) if pace_scores else 0
        avg_density = sum(density_scores) / len(density_scores) if density_scores else 0
        avg_comprehension = sum(comprehension_scores) / len(comprehension_scores) if comprehension_scores else 0
        
        readability_score = (avg_pace + avg_density + avg_comprehension) / 3
        
        details = {
            'pace_score': avg_pace,
            'density_score': avg_density,
            'comprehension_score': avg_comprehension,
            'readability_score': readability_score,
            'issues': issues.issues
        }
        
        return readability_score, details
    
    def _translation_quality_score(self, document: SubtitleDocument, 
                                 translation_result: Optional[TranslationResult]) -> Tuple[float, Dict]:
        """Translation-specific quality metrics."""
        if not self._has_translations(document):
            # No translation = perfect score for non-translation content
            return 1.0, {'translation_score': 1.0, 'has_translation': False, 'issues': []}
        
        issues = QualityIssues()
        
        # Translation coverage and accuracy
        coverage_score = self._assess_translation_coverage(document)
        accuracy_score = self._assess_translation_accuracy(document, translation_result)
        consistency_score = self._assess_translation_consistency(document, issues)
        
        # Language balance
        balance_score = self._assess_language_balance(document, issues)
        
        # Overall translation quality
        translation_score = (
            coverage_score * 0.3 +
            accuracy_score * 0.3 +
            consistency_score * 0.2 +
            balance_score * 0.2
        )
        
        details = {
            'coverage_score': coverage_score,
            'accuracy_score': accuracy_score,
            'consistency_score': consistency_score,
            'balance_score': balance_score,
            'translation_score': translation_score,
            'has_translation': True,
            'issues': issues.issues
        }
        
        return translation_score, details
    
    # Technical Quality Analysis Methods
    
    def _analyze_timing_quality(self, document: SubtitleDocument, issues: QualityIssues) -> Dict:
        """Analyze timing-related quality issues."""
        timing_stats = {
            'too_short_count': 0,
            'too_long_count': 0,
            'poor_gaps_count': 0,
            'avg_duration': 0.0
        }
        
        durations = []
        
        for i, subtitle in enumerate(document.subtitles):
            duration = subtitle.get_duration_seconds()
            durations.append(duration)
            
            # Check duration issues
            if duration < self.thresholds.min_duration:
                issues.add_issue('timing', 'too_short', 0.8, i, 
                               f"Duration {duration:.1f}s < {self.thresholds.min_duration}s")
                timing_stats['too_short_count'] += 1
                
            elif duration > self.thresholds.max_duration:
                issues.add_issue('timing', 'too_long', 0.6, i,
                               f"Duration {duration:.1f}s > {self.thresholds.max_duration}s")
                timing_stats['too_long_count'] += 1
            
            # Check gaps between subtitles
            if i < len(document.subtitles) - 1:
                next_subtitle = document.subtitles[i + 1]
                gap = next_subtitle.start_time - subtitle.end_time
                
                if gap < self.thresholds.min_gap_between_subtitles:
                    issues.add_issue('timing', 'poor_gap', 0.7, i,
                                   f"Gap {gap:.1f}s < {self.thresholds.min_gap_between_subtitles}s")
                    timing_stats['poor_gaps_count'] += 1
        
        timing_stats['avg_duration'] = sum(durations) / len(durations) if durations else 0
        
        return timing_stats
    
    def _analyze_formatting_quality(self, document: SubtitleDocument, issues: QualityIssues) -> Dict:
        """Analyze formatting-related quality issues."""
        formatting_stats = {
            'text_overflow_count': 0,
            'line_break_issues': 0,
            'avg_chars_per_line': 0.0
        }
        
        total_chars = 0
        total_lines = 0
        
        for i, subtitle in enumerate(document.subtitles):
            lines = subtitle.content.split('\n')
            total_lines += len(lines)
            
            for line_num, line in enumerate(lines):
                line_length = len(line.strip())
                total_chars += line_length
                
                if line_length > self.thresholds.max_chars_per_line:
                    issues.add_issue('formatting', 'text_overflow', 0.7, i,
                                   f"Line {line_num + 1}: {line_length} chars > {self.thresholds.max_chars_per_line}")
                    formatting_stats['text_overflow_count'] += 1
            
            # Check for poor line breaks
            if len(lines) > 1:
                line_balance = self._assess_line_balance(lines)
                if line_balance < 0.6:
                    issues.add_issue('formatting', 'poor_line_breaks', 0.5, i,
                                   "Unbalanced line breaks")
                    formatting_stats['line_break_issues'] += 1
        
        formatting_stats['avg_chars_per_line'] = total_chars / total_lines if total_lines > 0 else 0
        
        return formatting_stats
    
    def _analyze_structure_quality(self, document: SubtitleDocument, issues: QualityIssues) -> Dict:
        """Analyze structural quality issues."""
        structure_stats = {
            'overlap_count': 0,
            'sequence_issues': 0
        }
        
        # Check for overlapping subtitles
        for i in range(len(document.subtitles) - 1):
            current = document.subtitles[i]
            next_subtitle = document.subtitles[i + 1]
            
            if current.end_time > next_subtitle.start_time:
                issues.add_issue('structure', 'overlap', 0.9, i,
                               f"Overlap with subtitle {i + 1}")
                structure_stats['overlap_count'] += 1
            
            # Check sequence timing
            if current.start_time >= current.end_time:
                issues.add_issue('structure', 'invalid_timing', 1.0, i,
                               "Start time >= end time")
                structure_stats['sequence_issues'] += 1
        
        return structure_stats
    
    # Linguistic Quality Analysis Methods
    
    def _assess_subtitle_coherence(self, subtitle: Subtitle, document: SubtitleDocument, index: int) -> float:
        """Assess coherence of subtitle within document context."""
        # Simple coherence check based on content consistency
        content = subtitle.content.lower()
        
        # Check for abrupt topic changes (simplified)
        coherence_score = 0.8  # Base coherence score
        
        # Bonus for proper punctuation and sentence structure
        if PUNCTUATION_PATTERN.search(subtitle.content):
            coherence_score += 0.1
        
        # Penalty for very short or very long content without proper structure
        word_count = len(content.split())
        if word_count < 2:
            coherence_score -= 0.3
        elif word_count > 15 and not PUNCTUATION_PATTERN.search(subtitle.content):
            coherence_score -= 0.2
        
        return max(0.0, min(1.0, coherence_score))
    
    def _assess_grammar_quality(self, subtitle: Subtitle) -> float:
        """Assess basic grammar quality."""
        content = subtitle.content.strip()
        if not content:
            return 0.0
        
        grammar_score = 0.8  # Base score
        
        # Check for basic grammar patterns
        sentences = re.split(r'[.!?]+', content)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Check capitalization
            if sentence and sentence[0].islower():
                grammar_score -= 0.1
            
            # Check for common grammar patterns
            words = sentence.lower().split()
            
            # Check for articles and common word patterns
            has_articles = any(word in ['the', 'a', 'an'] for word in words)
            if len(words) > 3 and not has_articles and not CHINESE_PATTERN.search(sentence):
                grammar_score -= 0.1
        
        return max(0.0, min(1.0, grammar_score))
    
    def _assess_naturalness(self, subtitle: Subtitle) -> float:
        """Assess naturalness of language flow."""
        content = subtitle.content.lower().strip()
        if not content:
            return 0.0
        
        naturalness_score = 0.7  # Base score
        words = content.split()
        
        # Check for natural word flow
        common_word_count = sum(1 for word in words if word in COMMON_ENGLISH_WORDS)
        if words and common_word_count / len(words) > 0.3:
            naturalness_score += 0.2
        
        # Check for natural punctuation usage
        if COMPLEX_PUNCTUATION_PATTERN.search(subtitle.content):
            naturalness_score += 0.1
        
        # Penalty for repetitive words
        unique_words = set(words)
        if words and len(unique_words) / len(words) < 0.5:
            naturalness_score -= 0.2
        
        return max(0.0, min(1.0, naturalness_score))
    
    # Readability Quality Analysis Methods
    
    def _assess_reading_pace(self, subtitle: Subtitle) -> float:
        """Assess reading pace (words per minute)."""
        content = subtitle.content.strip()
        if not content:
            return 0.0
        
        word_count = len(content.split())
        duration = subtitle.get_duration_seconds()
        
        if duration <= 0:
            return 0.0
        
        # Calculate WPM (words per minute)
        wpm = (word_count / duration) * 60
        
        # Score based on ideal reading speed
        if wpm <= self.thresholds.ideal_reading_speed_wpm:
            return 1.0
        elif wpm <= self.thresholds.max_reading_speed_wpm:
            # Linear decline from ideal to max
            excess = wpm - self.thresholds.ideal_reading_speed_wpm
            max_excess = self.thresholds.max_reading_speed_wpm - self.thresholds.ideal_reading_speed_wpm
            return 1.0 - (excess / max_excess) * 0.5
        else:
            # Rapid decline beyond max
            return 0.3
    
    def _assess_information_density(self, subtitle: Subtitle) -> float:
        """Assess information density."""
        content = subtitle.content.strip()
        if not content:
            return 0.0
        
        # Simple density assessment based on content complexity
        word_count = len(content.split())
        char_count = len(content)
        punctuation_count = len(PUNCTUATION_PATTERN.findall(content))
        
        # Calculate density score
        if word_count == 0:
            return 0.0
        
        avg_word_length = char_count / word_count
        punctuation_ratio = punctuation_count / word_count
        
        # Optimal density: 4-6 char average word length, some punctuation
        density_score = 0.5
        
        if 4 <= avg_word_length <= 6:
            density_score += 0.3
        elif avg_word_length < 4:
            density_score += 0.1
        
        if 0.1 <= punctuation_ratio <= 0.3:
            density_score += 0.2
        
        return min(1.0, density_score)
    
    def _assess_comprehension_ease(self, subtitle: Subtitle) -> float:
        """Assess comprehension ease."""
        content = subtitle.content.strip()
        if not content:
            return 0.0
        
        # Simple comprehension assessment
        words = content.split()
        sentences = len(re.split(r'[.!?]+', content))
        
        if not words:
            return 0.0
        
        # Factors affecting comprehension
        avg_words_per_sentence = len(words) / max(sentences, 1)
        
        comprehension_score = 0.8  # Base score
        
        # Optimal: 5-12 words per sentence
        if 5 <= avg_words_per_sentence <= 12:
            comprehension_score += 0.2
        elif avg_words_per_sentence < 5:
            comprehension_score -= 0.1
        elif avg_words_per_sentence > 20:
            comprehension_score -= 0.3
        
        return max(0.0, min(1.0, comprehension_score))
    
    # Translation Quality Analysis Methods
    
    def _has_translations(self, document: SubtitleDocument) -> bool:
        """Check if document contains translations."""
        sample_size = min(5, len(document.subtitles))
        dual_language_count = 0
        
        for subtitle in document.subtitles[:sample_size]:
            content = subtitle.content
            has_chinese = bool(CHINESE_PATTERN.search(content))
            has_english = bool(ENGLISH_PATTERN.search(content))
            
            if has_chinese and has_english:
                dual_language_count += 1
        
        return dual_language_count / sample_size > 0.3
    
    def _assess_translation_coverage(self, document: SubtitleDocument) -> float:
        """Assess translation coverage."""
        if not document.subtitles:
            return 0.0
        
        translated_count = 0
        for subtitle in document.subtitles:
            content = subtitle.content
            has_chinese = bool(CHINESE_PATTERN.search(content))
            has_english = bool(ENGLISH_PATTERN.search(content))
            
            if has_chinese and has_english:
                translated_count += 1
        
        return translated_count / len(document.subtitles)
    
    def _assess_translation_accuracy(self, document: SubtitleDocument, 
                                   translation_result: Optional[TranslationResult]) -> float:
        """Assess translation accuracy."""
        if translation_result:
            return getattr(translation_result, 'quality_score', 0.8)
        
        # Internal accuracy assessment based on balance and completeness
        return self._assess_language_balance(document, QualityIssues())
    
    def _assess_translation_consistency(self, document: SubtitleDocument, issues: QualityIssues) -> float:
        """Assess translation consistency."""
        if not self._has_translations(document):
            return 1.0
        
        # Check for consistent translation patterns
        patterns = []
        for i, subtitle in enumerate(document.subtitles):
            pattern = self._get_translation_pattern(subtitle)
            patterns.append(pattern)
            
            # Flag inconsistencies
            if i > 0 and patterns[i] != patterns[i-1] and patterns[i] == 'other':
                issues.add_issue('translation', 'inconsistent_pattern', 0.5, i,
                               "Translation pattern inconsistency")
        
        # Calculate consistency ratio
        if not patterns:
            return 1.0
        
        most_common = max(set(patterns), key=patterns.count)
        consistency_ratio = patterns.count(most_common) / len(patterns)
        
        return consistency_ratio
    
    def _assess_language_balance(self, document: SubtitleDocument, issues: QualityIssues) -> float:
        """Assess balance between languages."""
        chinese_total = 0
        english_total = 0
        
        for i, subtitle in enumerate(document.subtitles):
            content = subtitle.content
            chinese_chars = len(CHINESE_PATTERN.findall(content))
            english_chars = len(ENGLISH_PATTERN.findall(content))
            
            chinese_total += chinese_chars
            english_total += english_chars
            
            # Check individual subtitle balance
            if chinese_chars > 0 and english_chars > 0:
                balance = min(chinese_chars, english_chars) / max(chinese_chars, english_chars)
                if balance < 0.3:
                    issues.add_issue('translation', 'poor_balance', 0.6, i,
                                   "Poor language balance in subtitle")
        
        if chinese_total == 0 and english_total == 0:
            return 0.0
        
        if chinese_total == 0 or english_total == 0:
            return 0.7  # Single language
        
        # Calculate overall balance
        overall_balance = min(chinese_total, english_total) / max(chinese_total, english_total)
        return overall_balance
    
    # Helper Methods
    
    def _assess_line_balance(self, lines: List[str]) -> float:
        """Assess balance of line lengths."""
        if len(lines) <= 1:
            return 1.0
        
        lengths = [len(line.strip()) for line in lines]
        if not lengths:
            return 0.0
        
        avg_length = sum(lengths) / len(lengths)
        if avg_length == 0:
            return 0.0
        
        # Calculate coefficient of variation
        variance = sum((length - avg_length) ** 2 for length in lengths) / len(lengths)
        std_dev = variance ** 0.5
        cv = std_dev / avg_length
        
        # Good balance has low coefficient of variation
        balance_score = max(0.0, 1.0 - cv)
        return balance_score
    
    def _get_translation_pattern(self, subtitle: Subtitle) -> str:
        """Get translation pattern for a subtitle."""
        content = subtitle.content
        has_chinese = bool(CHINESE_PATTERN.search(content))
        has_english = bool(ENGLISH_PATTERN.search(content))
        
        if has_chinese and has_english:
            return "dual_language"
        elif has_chinese:
            return "chinese_only"
        elif has_english:
            return "english_only"
        else:
            return "other"
    
    def _calculate_confidence(self, document: SubtitleDocument) -> float:
        """Calculate confidence level in quality assessment."""
        confidence_factors = []
        
        # Sample size confidence
        sample_confidence = min(1.0, len(document.subtitles) / 30)
        confidence_factors.append(sample_confidence)
        
        # Content variety confidence
        variety_confidence = self._assess_content_variety(document)
        confidence_factors.append(variety_confidence)
        
        # Duration confidence (longer content = more confidence)
        total_duration = document.get_total_duration()
        duration_confidence = min(1.0, total_duration / 300)  # Full confidence at 5+ minutes
        confidence_factors.append(duration_confidence)
        
        return sum(confidence_factors) / len(confidence_factors)
    
    def _assess_content_variety(self, document: SubtitleDocument) -> float:
        """Assess variety of content for confidence calculation."""
        if not document.subtitles:
            return 0.0
        
        # Check variety in content lengths and patterns
        lengths = [len(subtitle.content) for subtitle in document.subtitles]
        patterns = [self._get_translation_pattern(subtitle) for subtitle in document.subtitles]
        
        # Length variety
        if lengths:
            avg_length = sum(lengths) / len(lengths)
            length_variety = len(set(lengths)) / len(lengths) if avg_length > 0 else 0
        else:
            length_variety = 0
        
        # Pattern variety
        pattern_variety = len(set(patterns)) / len(patterns) if patterns else 0
        
        return (length_variety + pattern_variety) / 2
    
    def _empty_quality_metrics(self) -> QualityMetrics:
        """Return empty quality metrics for edge cases."""
        return QualityMetrics(
            technical_score=0.0,
            linguistic_score=0.0,
            readability_score=0.0,
            translation_score=0.0,
            confidence_level=0.0
        )