"""
Enhanced translation coverage analysis with multi-dimensional metrics.
"""

from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass

from ..entities.subtitle import Subtitle, SubtitleDocument
from ..value_objects.quality_metrics import CoverageMetrics
from ...infrastructure.services.subtitle_translation_service import TranslationResult
from ._patterns import CHINESE_PATTERN, ENGLISH_PATTERN, PUNCTUATION_PATTERN


@dataclass
class ContentWeight:
    """Content weighting factors for coverage calculation."""
    word_count_weight: float
    complexity_weight: float
    speaker_importance_weight: float
    temporal_weight: float


class EnhancedTranslationCoverage:
    """Comprehensive translation coverage analysis."""
    
    def __init__(self):
        # Quality thresholds
        self.full_translation_threshold = 0.8
        self.partial_translation_threshold = 0.2
        self.meaningful_content_min_words = 2
        
    def calculate_coverage(self, document: SubtitleDocument, 
                         translation_result: Optional[TranslationResult] = None) -> CoverageMetrics:
        """Calculate comprehensive translation coverage metrics."""
        
        if not document.subtitles:
            return self._empty_coverage_metrics()
        
        # Calculate core coverage dimensions
        subtitle_coverage = self._subtitle_coverage_ratio(document)
        temporal_coverage = self._temporal_coverage_analysis(document)
        content_coverage = self._content_density_coverage(document)
        
        # Calculate qualitative metrics
        translation_quality = self._translation_quality_score(document, translation_result)
        completeness_score = self._translation_completeness(document)
        
        # Calculate advanced metrics
        semantic_coherence = self._semantic_coherence_score(document)
        linguistic_consistency = self._linguistic_consistency(document)
        
        # Calculate confidence level
        confidence_level = self._calculate_confidence(document, translation_result)
        
        return CoverageMetrics(
            subtitle_coverage=subtitle_coverage,
            temporal_coverage=temporal_coverage,
            content_coverage=content_coverage,
            translation_quality=translation_quality,
            completeness_score=completeness_score,
            semantic_coherence=semantic_coherence,
            linguistic_consistency=linguistic_consistency,
            confidence_level=confidence_level
        )
    
    def _subtitle_coverage_ratio(self, document: SubtitleDocument) -> float:
        """Enhanced subtitle-level coverage with partial translation detection."""
        subtitles = document.subtitles
        if not subtitles:
            return 0.0
            
        fully_translated = 0
        partially_translated = 0
        
        for subtitle in subtitles:
            translation_ratio = self._analyze_subtitle_translation(subtitle)
            if translation_ratio >= self.full_translation_threshold:
                fully_translated += 1
            elif translation_ratio >= self.partial_translation_threshold:
                partially_translated += 1
        
        # Weighted coverage: full=1.0, partial=0.5, none=0.0
        weighted_coverage = (fully_translated + partially_translated * 0.5) / len(subtitles)
        return min(1.0, weighted_coverage)
    
    def _temporal_coverage_analysis(self, document: SubtitleDocument) -> float:
        """Analyze translation coverage across time segments."""
        total_duration = document.get_total_duration()
        if total_duration <= 0:
            return 0.0
            
        translated_duration = 0
        
        for subtitle in document.subtitles:
            if self._has_meaningful_translation(subtitle):
                translated_duration += subtitle.get_duration_seconds()
        
        return min(1.0, translated_duration / total_duration)
    
    def _content_density_coverage(self, document: SubtitleDocument) -> float:
        """Weight coverage by content complexity and word count."""
        total_weighted_content = 0
        translated_weighted_content = 0
        
        for subtitle in document.subtitles:
            # Calculate content weight based on multiple factors
            content_weight = self._calculate_content_weight(subtitle)
            total_weighted_content += content_weight
            
            if self._has_meaningful_translation(subtitle):
                # Assess quality of the translation for this subtitle
                translation_quality = self._assess_translation_quality(subtitle)
                translated_weighted_content += content_weight * translation_quality
        
        return translated_weighted_content / total_weighted_content if total_weighted_content > 0 else 0
    
    def _translation_quality_score(self, document: SubtitleDocument, 
                                 translation_result: Optional[TranslationResult]) -> float:
        """Assess overall translation quality."""
        if not self._has_translations(document):
            return 1.0  # No translation needed = perfect score
        
        quality_factors = []
        
        # Translation completeness (from external result if available)
        if translation_result:
            external_quality = getattr(translation_result, 'quality_score', 0.8)
            quality_factors.append(external_quality)
        
        # Internal quality assessment
        internal_quality = self._assess_internal_translation_quality(document)
        quality_factors.append(internal_quality)
        
        # Language balance quality
        balance_quality = self._assess_language_balance(document)
        quality_factors.append(balance_quality)
        
        return sum(quality_factors) / len(quality_factors) if quality_factors else 0.0
    
    def _translation_completeness(self, document: SubtitleDocument) -> float:
        """Assess how complete the translation coverage is."""
        if not document.subtitles:
            return 0.0
        
        # Check for gaps in translation coverage
        translation_gaps = self._identify_translation_gaps(document)
        gap_penalty = len(translation_gaps) * 0.1  # 10% penalty per significant gap
        
        # Check for consistency in translation approach
        consistency_score = self._assess_translation_consistency_internal(document)
        
        # Base completeness from subtitle coverage
        base_completeness = self._subtitle_coverage_ratio(document)
        
        # Combine factors
        completeness = base_completeness * consistency_score - gap_penalty
        return max(0.0, min(1.0, completeness))
    
    def _semantic_coherence_score(self, document: SubtitleDocument) -> float:
        """Assess semantic coherence of translations."""
        if not self._has_translations(document) or len(document.subtitles) < 2:
            return 1.0
        
        coherence_scores = []
        
        # Check coherence between consecutive subtitles
        for i in range(len(document.subtitles) - 1):
            current_subtitle = document.subtitles[i]
            next_subtitle = document.subtitles[i + 1]
            
            if (self._has_meaningful_translation(current_subtitle) and 
                self._has_meaningful_translation(next_subtitle)):
                
                coherence = self._assess_subtitle_pair_coherence(current_subtitle, next_subtitle)
                coherence_scores.append(coherence)
        
        return sum(coherence_scores) / len(coherence_scores) if coherence_scores else 1.0
    
    def _linguistic_consistency(self, document: SubtitleDocument) -> float:
        """Assess linguistic consistency across translations."""
        if not self._has_translations(document):
            return 1.0
        
        # Check for consistent translation patterns
        pattern_consistency = self._assess_translation_patterns(document)
        
        # Check for consistent terminology usage
        terminology_consistency = self._assess_terminology_consistency(document)
        
        # Check for consistent style and tone
        style_consistency = self._assess_style_consistency(document)
        
        return (pattern_consistency + terminology_consistency + style_consistency) / 3
    
    # Helper Methods
    
    def _analyze_subtitle_translation(self, subtitle: Subtitle) -> float:
        """Analyze translation ratio for a single subtitle."""
        content = subtitle.content.strip()
        if not content:
            return 0.0
        
        # Split content by lines to analyze line-separated translations
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        
        if len(lines) == 0:
            return 0.0
        
        # Analyze each line for language content
        chinese_lines = []
        english_lines = []
        mixed_lines = []
        
        for line in lines:
            chinese_chars = len(CHINESE_PATTERN.findall(line))
            english_words = len(ENGLISH_PATTERN.findall(line))
            
            # Calculate character counts for better classification
            chinese_char_count = sum(len(match) for match in CHINESE_PATTERN.findall(line))
            english_char_count = sum(len(match) for match in ENGLISH_PATTERN.findall(line))
            
            # Determine if this is truly mixed content or predominantly one language
            if chinese_chars > 0 and english_words > 0:
                # Check if one language dominates (>70% of characters)
                total_lang_chars = chinese_char_count + english_char_count
                if total_lang_chars > 0:
                    chinese_ratio = chinese_char_count / total_lang_chars
                    english_ratio = english_char_count / total_lang_chars
                    
                    if chinese_ratio >= 0.7:
                        # Predominantly Chinese with minor English (like "GM")
                        chinese_lines.append(line)
                    elif english_ratio >= 0.7:
                        # Predominantly English with minor Chinese
                        english_lines.append(line)
                    else:
                        # Truly mixed content
                        mixed_lines.append(line)
                else:
                    mixed_lines.append(line)
            elif chinese_chars > 0:
                # Chinese line
                chinese_lines.append(line)
            elif english_words > 0:
                # English line
                english_lines.append(line)
        
        # Calculate translation coverage based on line analysis
        if mixed_lines:
            # Mixed language lines - calculate balance within lines
            total_balance = 0
            for line in mixed_lines:
                chinese_chars = len(CHINESE_PATTERN.findall(line))
                english_words = len(ENGLISH_PATTERN.findall(line))
                if chinese_chars > 0 and english_words > 0:
                    balance = min(chinese_chars, english_words) / max(chinese_chars, english_words)
                    total_balance += balance
            avg_balance = total_balance / len(mixed_lines) if mixed_lines else 0
            
            # If we also have separate language lines, boost the score
            if chinese_lines or english_lines:
                return min(1.0, avg_balance + 0.2)  # Bonus for having separate lines too
            else:
                return avg_balance
            
        elif chinese_lines and english_lines:
            # Separate line format (Chinese on one line, English on another)
            # This is the typical dual-language subtitle format
            chinese_content = ' '.join(chinese_lines)
            english_content = ' '.join(english_lines)
            
            chinese_chars = len(CHINESE_PATTERN.findall(chinese_content))
            english_words = len(ENGLISH_PATTERN.findall(english_content))
            
            if chinese_chars > 0 and english_words > 0:
                # High score for proper dual-language format
                line_balance = abs(len(chinese_lines) - len(english_lines)) / max(len(chinese_lines), len(english_lines))
                content_balance = min(chinese_chars, english_words) / max(chinese_chars, english_words)
                
                # Combine line balance and content balance
                translation_score = (1.0 - line_balance * 0.2) * content_balance
                return min(1.0, translation_score + 0.3)  # Higher bonus for separate line format
            
        elif chinese_lines or english_lines:
            # Single language content only
            total_lines = len(lines)
            content_lines = len(chinese_lines) + len(english_lines)
            
            if content_lines >= self.meaningful_content_min_words:
                return 0.8  # Good single language content
            else:
                return 0.5  # Minimal single language content
        
        # No meaningful language content detected
        return 0.0
    
    def _has_meaningful_translation(self, subtitle: Subtitle) -> bool:
        """Check if subtitle has meaningful translation content."""
        return self._analyze_subtitle_translation(subtitle) >= self.partial_translation_threshold
    
    def _calculate_content_weight(self, subtitle: Subtitle) -> float:
        """Calculate content weight based on multiple factors."""
        content = subtitle.content.strip()
        
        # Word count weight
        word_count = len(content.split())
        word_weight = min(1.0, word_count / 10)  # Normalize to max 10 words
        
        # Complexity weight (punctuation, special chars indicate complexity)
        complexity_indicators = len(PUNCTUATION_PATTERN.findall(content))
        complexity_weight = min(1.0, complexity_indicators / 3)  # Normalize to max 3 indicators
        
        # Duration weight (longer subtitles may be more important)
        duration = subtitle.get_duration_seconds()
        duration_weight = min(1.0, duration / 5.0)  # Normalize to max 5 seconds
        
        # Combined weight
        return (word_weight * 0.4 + complexity_weight * 0.3 + duration_weight * 0.3)
    
    def _assess_translation_quality(self, subtitle: Subtitle) -> float:
        """Assess the quality of translation for a single subtitle."""
        content = subtitle.content.strip()
        
        # Check for balanced dual-language content
        chinese_chars = len(CHINESE_PATTERN.findall(content))
        english_words = len(ENGLISH_PATTERN.findall(content))
        
        if chinese_chars == 0 and english_words == 0:
            return 0.0
        
        if chinese_chars > 0 and english_words > 0:
            # Dual language - check balance
            total = chinese_chars + english_words
            balance = min(chinese_chars, english_words) / max(chinese_chars, english_words)
            return balance * 0.9 + 0.1  # Bonus for having both languages
        
        # Single language content
        return 0.7
    
    def _has_translations(self, document: SubtitleDocument) -> bool:
        """Check if document contains translations."""
        if not document.subtitles:
            return False
        
        # Sample a few subtitles to check for translation patterns
        sample_size = min(5, len(document.subtitles))
        samples = document.subtitles[:sample_size]
        
        dual_language_count = 0
        for subtitle in samples:
            content = subtitle.content
            
            # Check for both same-line and separate-line translation formats
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            
            has_chinese = False
            has_english = False
            
            # Check each line for language content
            for line in lines:
                if CHINESE_PATTERN.search(line):
                    has_chinese = True
                if ENGLISH_PATTERN.search(line):
                    has_english = True
            
            # Also check for mixed content in single lines (backward compatibility)
            overall_has_chinese = bool(CHINESE_PATTERN.search(content))
            overall_has_english = bool(ENGLISH_PATTERN.search(content))
            
            if (has_chinese and has_english) or (overall_has_chinese and overall_has_english):
                dual_language_count += 1
        
        # Consider it a translation document if >30% of samples have dual language
        return dual_language_count / sample_size > 0.3
    
    def _assess_internal_translation_quality(self, document: SubtitleDocument) -> float:
        """Assess translation quality based on internal analysis."""
        if not self._has_translations(document):
            return 1.0
        
        quality_scores = []
        
        for subtitle in document.subtitles:
            if self._has_meaningful_translation(subtitle):
                subtitle_quality = self._assess_translation_quality(subtitle)
                quality_scores.append(subtitle_quality)
        
        return sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
    
    def _assess_language_balance(self, document: SubtitleDocument) -> float:
        """Assess balance between source and target languages."""
        chinese_total = 0
        english_total = 0
        
        for subtitle in document.subtitles:
            content = subtitle.content
            chinese_total += len(CHINESE_PATTERN.findall(content))
            english_total += len(ENGLISH_PATTERN.findall(content))
        
        if chinese_total == 0 and english_total == 0:
            return 0.0
        
        if chinese_total == 0 or english_total == 0:
            return 0.7  # Single language
        
        # Calculate balance ratio
        total = chinese_total + english_total
        balance = min(chinese_total, english_total) / max(chinese_total, english_total)
        return balance
    
    def _identify_translation_gaps(self, document: SubtitleDocument) -> List[Tuple[int, int]]:
        """Identify significant gaps in translation coverage."""
        gaps = []
        gap_start = None
        
        for i, subtitle in enumerate(document.subtitles):
            has_translation = self._has_meaningful_translation(subtitle)
            
            if not has_translation and gap_start is None:
                gap_start = i
            elif has_translation and gap_start is not None:
                gap_length = i - gap_start
                if gap_length >= 3:  # Significant gap: 3+ consecutive subtitles
                    gaps.append((gap_start, i - 1))
                gap_start = None
        
        # Handle gap at the end
        if gap_start is not None:
            gap_length = len(document.subtitles) - gap_start
            if gap_length >= 3:
                gaps.append((gap_start, len(document.subtitles) - 1))
        
        return gaps
    
    def _assess_translation_consistency_internal(self, document: SubtitleDocument) -> float:
        """Assess consistency of translation approach within document."""
        if len(document.subtitles) < 5:
            return 1.0  # Too few subtitles to assess consistency
        
        # Check consistency of translation patterns
        translation_patterns = []
        
        for subtitle in document.subtitles:
            if self._has_meaningful_translation(subtitle):
                pattern = self._get_translation_pattern(subtitle)
                translation_patterns.append(pattern)
        
        if not translation_patterns:
            return 0.0
        
        # Calculate pattern consistency
        most_common_pattern = max(set(translation_patterns), key=translation_patterns.count)
        consistency_ratio = translation_patterns.count(most_common_pattern) / len(translation_patterns)
        
        return consistency_ratio
    
    def _assess_subtitle_pair_coherence(self, subtitle1: Subtitle, subtitle2: Subtitle) -> float:
        """Assess coherence between two consecutive subtitles."""
        # Enhanced coherence check based on translation pattern consistency
        pattern1 = self._get_translation_pattern(subtitle1)
        pattern2 = self._get_translation_pattern(subtitle2)
        
        # Group similar dual-language patterns
        dual_language_patterns = {
            "dual_language_separate", "dual_language_inline", "dual_language_mixed"
        }
        
        # If patterns match exactly, excellent coherence
        if pattern1 == pattern2:
            return 1.0
        
        # If both are dual-language (different sub-types), still good coherence
        elif pattern1 in dual_language_patterns and pattern2 in dual_language_patterns:
            return 0.9
        
        # If one is dual-language and other is single language, moderate coherence
        elif ((pattern1 in dual_language_patterns and pattern2 in ["chinese_only", "english_only"]) or
              (pattern2 in dual_language_patterns and pattern1 in ["chinese_only", "english_only"])):
            return 0.7
        
        # If both are single language (same type), good coherence
        elif pattern1 == pattern2 and pattern1 in ["chinese_only", "english_only"]:
            return 0.8
        
        # Different patterns, lower coherence
        else:
            return 0.6
    
    def _assess_translation_patterns(self, document: SubtitleDocument) -> float:
        """Assess consistency of translation patterns."""
        return self._assess_translation_consistency_internal(document)
    
    def _assess_terminology_consistency(self, document: SubtitleDocument) -> float:
        """Assess consistency of terminology usage."""
        # Simplified implementation - could be enhanced with NLP
        # For now, assume good consistency if translations are present
        if self._has_translations(document):
            return 0.85  # Assume good terminology consistency
        return 1.0
    
    def _assess_style_consistency(self, document: SubtitleDocument) -> float:
        """Assess consistency of translation style and tone."""
        # Simplified implementation
        if self._has_translations(document):
            return 0.85  # Assume good style consistency
        return 1.0
    
    def _get_translation_pattern(self, subtitle: Subtitle) -> str:
        """Get translation pattern for a subtitle."""
        content = subtitle.content
        
        # Check for both same-line and separate-line formats
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        
        chinese_lines = []
        english_lines = []
        mixed_lines = []
        
        for line in lines:
            has_chinese = bool(CHINESE_PATTERN.search(line))
            has_english = bool(ENGLISH_PATTERN.search(line))
            
            if has_chinese and has_english:
                # Calculate character counts for better classification
                chinese_char_count = sum(len(match) for match in CHINESE_PATTERN.findall(line))
                english_char_count = sum(len(match) for match in ENGLISH_PATTERN.findall(line))
                
                # Determine if this is truly mixed content or predominantly one language
                total_lang_chars = chinese_char_count + english_char_count
                if total_lang_chars > 0:
                    chinese_ratio = chinese_char_count / total_lang_chars
                    english_ratio = english_char_count / total_lang_chars
                    
                    if chinese_ratio >= 0.7:
                        # Predominantly Chinese with minor English (like "GM")
                        chinese_lines.append(line)
                    elif english_ratio >= 0.7:
                        # Predominantly English with minor Chinese
                        english_lines.append(line)
                    else:
                        # Truly mixed content
                        mixed_lines.append(line)
                else:
                    mixed_lines.append(line)
            elif has_chinese:
                chinese_lines.append(line)
            elif has_english:
                english_lines.append(line)
        
        # Determine pattern based on line analysis
        if mixed_lines:
            if chinese_lines or english_lines:
                return "dual_language_mixed"  # Both mixed and separate lines
            else:
                return "dual_language_inline"  # Mixed within lines
        elif chinese_lines and english_lines:
            return "dual_language_separate"  # Separate lines (typical format)
        elif chinese_lines:
            return "chinese_only"
        elif english_lines:
            return "english_only"
        else:
            return "other"
    
    def _calculate_confidence(self, document: SubtitleDocument, 
                            translation_result: Optional[TranslationResult]) -> float:
        """Calculate confidence level in coverage assessment."""
        confidence_factors = []
        
        # Sample size confidence
        sample_confidence = min(1.0, len(document.subtitles) / 50)  # Full confidence at 50+ subtitles
        confidence_factors.append(sample_confidence)
        
        # Content diversity confidence
        diversity_confidence = self._assess_content_diversity(document)
        confidence_factors.append(diversity_confidence)
        
        # External validation confidence
        if translation_result:
            external_confidence = 0.9  # High confidence when external result available
            confidence_factors.append(external_confidence)
        
        return sum(confidence_factors) / len(confidence_factors)
    
    def _assess_content_diversity(self, document: SubtitleDocument) -> float:
        """Assess content diversity for confidence calculation."""
        if not document.subtitles:
            return 0.0
        
        # Check diversity of content lengths, patterns, etc.
        lengths = [len(subtitle.content) for subtitle in document.subtitles]
        avg_length = sum(lengths) / len(lengths)
        
        # Calculate coefficient of variation as diversity measure
        if avg_length > 0:
            variance = sum((length - avg_length) ** 2 for length in lengths) / len(lengths)
            std_dev = variance ** 0.5
            cv = std_dev / avg_length
            diversity = min(1.0, cv)  # Higher variation = higher diversity
        else:
            diversity = 0.0
        
        return diversity
    
    def _empty_coverage_metrics(self) -> CoverageMetrics:
        """Return empty coverage metrics for edge cases."""
        return CoverageMetrics(
            subtitle_coverage=0.0,
            temporal_coverage=0.0,
            content_coverage=0.0,
            translation_quality=0.0,
            completeness_score=0.0,
            semantic_coherence=0.0,
            linguistic_consistency=0.0,
            confidence_level=0.0
        )