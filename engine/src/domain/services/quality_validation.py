"""
Quality validation framework with confidence assessment and metric validation.
"""

from typing import Dict, Optional, List, Any
from dataclasses import dataclass
import time

from ..entities.subtitle import SubtitleDocument
from ..value_objects.quality_metrics import QualityMetrics, CoverageMetrics, ValidationResult, EnhancedStatistics
from ...infrastructure.services.subtitle_translation_service import TranslationResult


@dataclass
class ValidationThresholds:
    """Thresholds for quality validation."""
    significant_deviation_threshold: float = 0.2  # 20% change triggers warning
    confidence_threshold: float = 0.7  # Minimum confidence for reliable metrics
    quality_regression_threshold: float = 0.15  # 15% quality drop triggers warning
    coverage_regression_threshold: float = 0.25  # 25% coverage drop triggers warning


class QualityValidation:
    """Validation and confidence assessment for quality metrics."""
    
    def __init__(self, thresholds: Optional[ValidationThresholds] = None):
        self.thresholds = thresholds or ValidationThresholds()
    
    def validate_and_enhance_statistics(
        self,
        document: SubtitleDocument,
        basic_stats: Dict[str, Any],
        quality_metrics: QualityMetrics,
        coverage_metrics: Optional[CoverageMetrics] = None,
        translation_result: Optional[TranslationResult] = None,
        previous_stats: Optional[Dict[str, Any]] = None
    ) -> EnhancedStatistics:
        """Create and validate enhanced statistics."""
        
        # Validate new metrics against previous if available
        validation_result = self.validate_metrics(previous_stats, quality_metrics, coverage_metrics)
        
        # Calculate overall processing confidence
        processing_confidence = self._calculate_processing_confidence(
            document, quality_metrics, coverage_metrics, validation_result
        )
        
        # Create enhanced statistics
        enhanced_stats = EnhancedStatistics(
            basic_stats=basic_stats,
            quality_metrics=quality_metrics,
            coverage_metrics=coverage_metrics,
            validation_result=validation_result,
            processing_confidence=processing_confidence,
            analysis_timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            algorithm_version="1.0"
        )
        
        # Add recommendations based on analysis
        self._add_improvement_recommendations(enhanced_stats, document)
        
        return enhanced_stats
    
    def validate_metrics(
        self,
        previous_stats: Optional[Dict[str, Any]],
        quality_metrics: QualityMetrics,
        coverage_metrics: Optional[CoverageMetrics] = None
    ) -> ValidationResult:
        """Validate new metrics against previous calculations."""
        validation_result = ValidationResult()
        
        # Validate quality metrics
        self._validate_quality_metrics(previous_stats, quality_metrics, validation_result)
        
        # Validate coverage metrics if available
        if coverage_metrics:
            self._validate_coverage_metrics(previous_stats, coverage_metrics, validation_result)
        
        # Check internal consistency
        self._validate_internal_consistency(quality_metrics, coverage_metrics, validation_result)
        
        # Add confidence warnings
        self._validate_confidence_levels(quality_metrics, coverage_metrics, validation_result)
        
        return validation_result
    
    def _validate_quality_metrics(
        self,
        previous_stats: Optional[Dict[str, Any]],
        quality_metrics: QualityMetrics,
        validation_result: ValidationResult
    ):
        """Validate quality metrics against previous results."""
        if not previous_stats:
            return
        
        # Check overall quality score deviation
        if 'quality_score' in previous_stats:
            old_score = previous_stats['quality_score']
            new_score = quality_metrics.overall_score
            deviation = abs(new_score - old_score)
            
            if deviation > self.thresholds.significant_deviation_threshold:
                if new_score < old_score:
                    validation_result.add_warning(
                        f"Quality score decreased significantly: {old_score:.1%} → {new_score:.1%} "
                        f"({-deviation:.1%} change)"
                    )
                else:
                    validation_result.add_warning(
                        f"Quality score increased significantly: {old_score:.1%} → {new_score:.1%} "
                        f"(+{deviation:.1%} change)"
                    )
            
            # Check for quality regression
            if new_score < old_score - self.thresholds.quality_regression_threshold:
                validation_result.add_error(
                    f"Quality regression detected: {old_score:.1%} → {new_score:.1%} "
                    f"({-(new_score - old_score):.1%} drop)"
                )
        
        # Validate dimension scores
        if 'quality_breakdown' in previous_stats:
            old_breakdown = previous_stats['quality_breakdown']
            self._validate_dimension_changes(old_breakdown, quality_metrics, validation_result)
    
    def _validate_coverage_metrics(
        self,
        previous_stats: Optional[Dict[str, Any]],
        coverage_metrics: CoverageMetrics,
        validation_result: ValidationResult
    ):
        """Validate coverage metrics against previous results."""
        if not previous_stats:
            return
        
        # Check translation coverage deviation
        if 'translation_coverage' in previous_stats:
            old_coverage = previous_stats['translation_coverage']
            new_coverage = coverage_metrics.overall_coverage
            deviation = abs(new_coverage - old_coverage)
            
            if deviation > self.thresholds.significant_deviation_threshold:
                if new_coverage < old_coverage:
                    validation_result.add_warning(
                        f"Translation coverage decreased: {old_coverage:.1%} → {new_coverage:.1%} "
                        f"({-deviation:.1%} change)"
                    )
                else:
                    validation_result.add_warning(
                        f"Translation coverage increased: {old_coverage:.1%} → {new_coverage:.1%} "
                        f"(+{deviation:.1%} change)"
                    )
            
            # Check for coverage regression
            if new_coverage < old_coverage - self.thresholds.coverage_regression_threshold:
                validation_result.add_error(
                    f"Coverage regression detected: {old_coverage:.1%} → {new_coverage:.1%} "
                    f"({-(new_coverage - old_coverage):.1%} drop)"
                )
    
    def _validate_dimension_changes(
        self,
        old_breakdown: Dict[str, float],
        quality_metrics: QualityMetrics,
        validation_result: ValidationResult
    ):
        """Validate changes in quality dimensions."""
        current_breakdown = {
            'technical': quality_metrics.technical_score,
            'linguistic': quality_metrics.linguistic_score,
            'readability': quality_metrics.readability_score,
            'translation': quality_metrics.translation_score
        }
        
        for dimension, new_score in current_breakdown.items():
            if dimension in old_breakdown:
                old_score = old_breakdown[dimension]
                deviation = abs(new_score - old_score)
                
                if deviation > self.thresholds.significant_deviation_threshold:
                    change_type = "improvement" if new_score > old_score else "decline"
                    validation_result.add_warning(
                        f"{dimension.title()} quality {change_type}: "
                        f"{old_score:.1%} → {new_score:.1%} ({deviation:.1%} change)"
                    )
    
    def _validate_internal_consistency(
        self,
        quality_metrics: QualityMetrics,
        coverage_metrics: Optional[CoverageMetrics],
        validation_result: ValidationResult
    ):
        """Validate internal consistency of metrics."""
        
        # Check if overall quality score aligns with dimension scores
        expected_overall = (
            quality_metrics.technical_score * 0.25 +
            quality_metrics.linguistic_score * 0.30 +
            quality_metrics.readability_score * 0.20 +
            quality_metrics.translation_score * 0.25
        )
        
        deviation = abs(quality_metrics.overall_score - expected_overall)
        if deviation > 0.05:  # 5% tolerance
            validation_result.add_error(
                f"Quality score calculation inconsistency: "
                f"expected {expected_overall:.1%}, got {quality_metrics.overall_score:.1%}"
            )
        
        # Check coverage metrics consistency if available
        if coverage_metrics:
            self._validate_coverage_consistency(coverage_metrics, validation_result)
        
        # Check for logical inconsistencies
        if quality_metrics.translation_score > 0.9 and coverage_metrics:
            if coverage_metrics.overall_coverage < 0.5:
                validation_result.add_warning(
                    "High translation quality but low coverage may indicate limited translation scope"
                )
    
    def _validate_coverage_consistency(
        self,
        coverage_metrics: CoverageMetrics,
        validation_result: ValidationResult
    ):
        """Validate internal consistency of coverage metrics."""
        
        # Check if overall coverage aligns with component scores
        expected_overall = (
            coverage_metrics.subtitle_coverage * 0.25 +
            coverage_metrics.temporal_coverage * 0.20 +
            coverage_metrics.content_coverage * 0.25 +
            coverage_metrics.translation_quality * 0.15 +
            coverage_metrics.completeness_score * 0.10 +
            coverage_metrics.semantic_coherence * 0.03 +
            coverage_metrics.linguistic_consistency * 0.02
        )
        
        deviation = abs(coverage_metrics.overall_coverage - expected_overall)
        if deviation > 0.05:  # 5% tolerance
            validation_result.add_error(
                f"Coverage calculation inconsistency: "
                f"expected {expected_overall:.1%}, got {coverage_metrics.overall_coverage:.1%}"
            )
    
    def _validate_confidence_levels(
        self,
        quality_metrics: QualityMetrics,
        coverage_metrics: Optional[CoverageMetrics],
        validation_result: ValidationResult
    ):
        """Validate confidence levels and add warnings for low confidence."""
        
        if quality_metrics.confidence_level < self.thresholds.confidence_threshold:
            validation_result.add_warning(
                f"Low confidence in quality assessment: {quality_metrics.confidence_level:.1%}"
            )
            validation_result.add_recommendation(
                "Consider using larger sample size or additional validation for more reliable metrics"
            )
        
        if coverage_metrics and coverage_metrics.confidence_level < self.thresholds.confidence_threshold:
            validation_result.add_warning(
                f"Low confidence in coverage assessment: {coverage_metrics.confidence_level:.1%}"
            )
            validation_result.add_recommendation(
                "Translation coverage assessment may be less reliable with current content"
            )
    
    def _calculate_processing_confidence(
        self,
        document: SubtitleDocument,
        quality_metrics: QualityMetrics,
        coverage_metrics: Optional[CoverageMetrics],
        validation_result: ValidationResult
    ) -> float:
        """Calculate overall processing confidence."""
        confidence_factors = []
        
        # Base confidence from quality metrics
        confidence_factors.append(quality_metrics.confidence_level)
        
        # Coverage confidence if available
        if coverage_metrics:
            confidence_factors.append(coverage_metrics.confidence_level)
        
        # Validation confidence (reduced by errors and warnings)
        validation_confidence = 1.0
        validation_confidence -= len(validation_result.errors) * 0.3
        validation_confidence -= len(validation_result.warnings) * 0.1
        confidence_factors.append(max(0.0, validation_confidence))
        
        # Content size confidence
        content_confidence = min(1.0, len(document.subtitles) / 30)  # Full confidence at 30+ subtitles
        confidence_factors.append(content_confidence)
        
        # Duration confidence
        duration_confidence = min(1.0, document.get_total_duration() / 180)  # Full confidence at 3+ minutes
        confidence_factors.append(duration_confidence)
        
        return sum(confidence_factors) / len(confidence_factors)
    
    def _add_improvement_recommendations(
        self,
        enhanced_stats: EnhancedStatistics,
        document: SubtitleDocument
    ):
        """Add improvement recommendations based on analysis."""
        if not enhanced_stats.validation_result:
            return
        
        quality_metrics = enhanced_stats.quality_metrics
        coverage_metrics = enhanced_stats.coverage_metrics
        
        # Quality improvement recommendations
        if quality_metrics.overall_score < 0.8:
            self._add_quality_recommendations(quality_metrics, enhanced_stats.validation_result)
        
        # Coverage improvement recommendations
        if coverage_metrics and coverage_metrics.overall_coverage < 0.7:
            self._add_coverage_recommendations(coverage_metrics, enhanced_stats.validation_result)
        
        # Technical recommendations
        if quality_metrics.technical_score < 0.8:
            enhanced_stats.validation_result.add_recommendation(
                "Consider reviewing subtitle timing and formatting for technical improvements"
            )
        
        # Processing confidence recommendations
        if enhanced_stats.processing_confidence < 0.7:
            enhanced_stats.validation_result.add_recommendation(
                "Consider processing larger content samples for more reliable quality assessment"
            )
    
    def _add_quality_recommendations(
        self,
        quality_metrics: QualityMetrics,
        validation_result: ValidationResult
    ):
        """Add quality-specific recommendations."""
        
        if quality_metrics.technical_score < 0.7:
            validation_result.add_recommendation(
                "Technical quality: Review subtitle timing, duration, and formatting compliance"
            )
        
        if quality_metrics.linguistic_score < 0.7:
            validation_result.add_recommendation(
                "Linguistic quality: Consider reviewing grammar, coherence, and natural language flow"
            )
        
        if quality_metrics.readability_score < 0.7:
            validation_result.add_recommendation(
                "Readability: Optimize reading pace, information density, and comprehension ease"
            )
        
        if quality_metrics.translation_score < 0.7:
            validation_result.add_recommendation(
                "Translation quality: Review translation coverage, accuracy, and language balance"
            )
    
    def _add_coverage_recommendations(
        self,
        coverage_metrics: CoverageMetrics,
        validation_result: ValidationResult
    ):
        """Add coverage-specific recommendations."""
        
        if coverage_metrics.subtitle_coverage < 0.6:
            validation_result.add_recommendation(
                "Subtitle coverage: Consider increasing translation coverage across more subtitles"
            )
        
        if coverage_metrics.temporal_coverage < 0.6:
            validation_result.add_recommendation(
                "Temporal coverage: Review translation distribution across video timeline"
            )
        
        if coverage_metrics.content_coverage < 0.6:
            validation_result.add_recommendation(
                "Content coverage: Focus on translating high-importance content segments"
            )
        
        if coverage_metrics.translation_quality < 0.7:
            validation_result.add_recommendation(
                "Translation quality: Review translation accuracy and naturalness"
            )
    
    def generate_quality_report(self, enhanced_stats: EnhancedStatistics) -> Dict[str, Any]:
        """Generate a comprehensive quality report."""
        quality_metrics = enhanced_stats.quality_metrics
        coverage_metrics = enhanced_stats.coverage_metrics
        validation_result = enhanced_stats.validation_result
        
        report = {
            "summary": {
                "overall_quality": quality_metrics.overall_score,
                "quality_grade": quality_metrics.get_grade(),
                "processing_confidence": enhanced_stats.processing_confidence,
                "has_translations": coverage_metrics is not None
            },
            "quality_breakdown": {
                "technical": {
                    "score": quality_metrics.technical_score,
                    "details": quality_metrics.technical_details
                },
                "linguistic": {
                    "score": quality_metrics.linguistic_score,
                    "details": quality_metrics.linguistic_details
                },
                "readability": {
                    "score": quality_metrics.readability_score,
                    "details": quality_metrics.readability_details
                },
                "translation": {
                    "score": quality_metrics.translation_score,
                    "details": quality_metrics.translation_details
                }
            },
            "issues": {
                "total_issues": len(quality_metrics.all_issues),
                "by_category": self._group_issues_by_category(quality_metrics.all_issues)
            },
            "validation": {
                "is_valid": validation_result.is_valid if validation_result else True,
                "warnings": validation_result.warnings if validation_result else [],
                "recommendations": validation_result.recommendations if validation_result else []
            }
        }
        
        if coverage_metrics:
            report["coverage_breakdown"] = {
                "overall_coverage": coverage_metrics.overall_coverage,
                "subtitle_coverage": coverage_metrics.subtitle_coverage,
                "temporal_coverage": coverage_metrics.temporal_coverage,
                "content_coverage": coverage_metrics.content_coverage,
                "translation_quality": coverage_metrics.translation_quality,
                "confidence": coverage_metrics.confidence_level
            }
        
        return report
    
    def _group_issues_by_category(self, issues: List) -> Dict[str, int]:
        """Group issues by category for reporting."""
        categories = {}
        for issue in issues:
            category = getattr(issue, 'category', 'unknown')
            categories[category] = categories.get(category, 0) + 1
        return categories