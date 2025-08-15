"""
Enhanced quality metrics value objects for comprehensive subtitle analysis.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class QualityDimension(Enum):
    """Quality assessment dimensions."""
    TECHNICAL = "technical"
    LINGUISTIC = "linguistic" 
    READABILITY = "readability"
    TRANSLATION = "translation"


class IssueSeverity(Enum):
    """Issue severity levels."""
    LOW = 0.3
    MEDIUM = 0.6
    HIGH = 0.8
    CRITICAL = 1.0


@dataclass
class QualityIssue:
    """Represents a quality issue with metadata."""
    category: str
    issue_type: str
    severity: float
    subtitle_index: Optional[int] = None
    description: Optional[str] = None
    suggested_fix: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "category": self.category,
            "issue_type": self.issue_type,
            "severity": self.severity,
            "subtitle_index": self.subtitle_index,
            "description": self.description,
            "suggested_fix": self.suggested_fix
        }


@dataclass
class QualityIssues:
    """Collection of quality issues with scoring capability."""
    issues: List[QualityIssue] = field(default_factory=list)
    
    def add_issue(self, category: str, issue_type: str, severity: float, 
                  subtitle_index: Optional[int] = None, description: Optional[str] = None):
        """Add a quality issue."""
        self.issues.append(QualityIssue(
            category=category,
            issue_type=issue_type, 
            severity=severity,
            subtitle_index=subtitle_index,
            description=description
        ))
    
    def calculate_weighted_score(self, total_items: int) -> float:
        """Calculate weighted quality score based on issues."""
        if total_items == 0:
            return 0.0
            
        total_severity = sum(issue.severity for issue in self.issues)
        max_possible_severity = total_items * 1.0  # Maximum severity per item
        
        score = 1.0 - (total_severity / max_possible_severity)
        return max(0.0, min(1.0, score))
    
    def get_issues_by_category(self, category: str) -> List[QualityIssue]:
        """Get issues by category."""
        return [issue for issue in self.issues if issue.category == category]


@dataclass
class CoverageMetrics:
    """Comprehensive translation coverage metrics."""
    # Quantitative metrics
    subtitle_coverage: float  # 0.0-1.0
    temporal_coverage: float  # 0.0-1.0 
    content_coverage: float   # 0.0-1.0
    
    # Qualitative metrics
    translation_quality: float    # 0.0-1.0
    completeness_score: float    # 0.0-1.0
    
    # Advanced metrics
    semantic_coherence: float     # 0.0-1.0
    linguistic_consistency: float # 0.0-1.0
    
    # Overall weighted score
    overall_coverage: float = 0.0
    confidence_level: float = 0.0
    
    def __post_init__(self):
        """Calculate overall coverage score."""
        self.overall_coverage = (
            self.subtitle_coverage * 0.25 +
            self.temporal_coverage * 0.20 +
            self.content_coverage * 0.25 +
            self.translation_quality * 0.15 +
            self.completeness_score * 0.10 +
            self.semantic_coherence * 0.03 +
            self.linguistic_consistency * 0.02
        )


@dataclass
class QualityMetrics:
    """Comprehensive quality assessment metrics."""
    # Dimension scores (0.0-1.0)
    technical_score: float
    linguistic_score: float
    readability_score: float
    translation_score: float
    
    # Overall weighted score
    overall_score: float = 0.0
    confidence_level: float = 0.0
    
    # Detailed breakdowns
    technical_details: Dict[str, float] = field(default_factory=dict)
    linguistic_details: Dict[str, float] = field(default_factory=dict)
    readability_details: Dict[str, float] = field(default_factory=dict)
    translation_details: Dict[str, float] = field(default_factory=dict)
    
    # Issues tracking
    all_issues: List[QualityIssue] = field(default_factory=list)
    
    def __post_init__(self):
        """Calculate overall quality score."""
        self.overall_score = (
            self.technical_score * 0.25 +
            self.linguistic_score * 0.30 +
            self.readability_score * 0.20 +
            self.translation_score * 0.25
        )
    
    def get_grade(self) -> str:
        """Get letter grade for quality score."""
        if self.overall_score >= 0.95:
            return "A+"
        elif self.overall_score >= 0.90:
            return "A"
        elif self.overall_score >= 0.85:
            return "A-"
        elif self.overall_score >= 0.80:
            return "B+"
        elif self.overall_score >= 0.75:
            return "B"
        elif self.overall_score >= 0.70:
            return "B-"
        elif self.overall_score >= 0.65:
            return "C+"
        elif self.overall_score >= 0.60:
            return "C"
        else:
            return "D"


@dataclass
class ValidationResult:
    """Result of quality metric validation."""
    is_valid: bool = True
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def add_warning(self, message: str):
        """Add a validation warning."""
        self.warnings.append(message)
    
    def add_error(self, message: str):
        """Add a validation error."""
        self.errors.append(message)
        self.is_valid = False
    
    def add_recommendation(self, message: str):
        """Add a recommendation."""
        self.recommendations.append(message)


@dataclass
class EnhancedStatistics:
    """Enhanced statistics combining all quality metrics."""
    # Original statistics
    basic_stats: Dict[str, Any]
    
    # Enhanced metrics
    quality_metrics: QualityMetrics
    coverage_metrics: Optional[CoverageMetrics] = None
    validation_result: Optional[ValidationResult] = None
    
    # Processing metadata
    processing_confidence: float = 0.0
    analysis_timestamp: str = ""
    algorithm_version: str = "1.0"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for backward compatibility."""
        result = {
            **self.basic_stats,
            "quality_score": self.quality_metrics.overall_score,
            "quality_grade": self.quality_metrics.get_grade(),
            "quality_confidence": self.quality_metrics.confidence_level,
            "quality_breakdown": {
                "technical": self.quality_metrics.technical_score,
                "linguistic": self.quality_metrics.linguistic_score,
                "readability": self.quality_metrics.readability_score,
                "translation": self.quality_metrics.translation_score
            }
        }
        
        if self.coverage_metrics:
            result["translation_coverage"] = self.coverage_metrics.overall_coverage
            result["coverage_confidence"] = self.coverage_metrics.confidence_level
            result["coverage_breakdown"] = {
                "subtitle_coverage": self.coverage_metrics.subtitle_coverage,
                "temporal_coverage": self.coverage_metrics.temporal_coverage,
                "content_coverage": self.coverage_metrics.content_coverage,
                "translation_quality": self.coverage_metrics.translation_quality
            }
        
        if self.validation_result:
            result["validation"] = {
                "is_valid": self.validation_result.is_valid,
                "warnings": self.validation_result.warnings,
                "recommendations": self.validation_result.recommendations
            }
        
        result["processing_confidence"] = self.processing_confidence
        result["algorithm_version"] = self.algorithm_version
        
        # Add quality issues if available
        if self.quality_metrics.all_issues:
            result["quality_issues"] = [
                issue.to_dict() for issue in self.quality_metrics.all_issues
            ]
        
        return result