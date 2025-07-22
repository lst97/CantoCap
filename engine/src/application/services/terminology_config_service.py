"""Terminology configuration service for managing custom vocabulary and language style rules."""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass

from ...domain.value_objects.terminology_term import (
    TerminologyTerm, 
    TermCategory, 
    TermPriority,
    StyleConfiguration
)


@dataclass
class TerminologyMatch:
    """Represents a matched terminology term in text."""
    term: TerminologyTerm
    matched_text: str
    start_pos: int
    end_pos: int
    confidence: float = 1.0


class TerminologyConfigService:
    """Service for loading, managing, and applying custom terminology configurations."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize terminology service with optional configuration file."""
        self.terms: Dict[str, TerminologyTerm] = {}
        self.terms_by_category: Dict[TermCategory, List[TerminologyTerm]] = {}
        self.terms_by_priority: Dict[TermPriority, List[TerminologyTerm]] = {}
        self.style_config: Dict[str, StyleConfiguration] = {}
        self.config_version: str = "1.0"
        self.config_language: str = "cantonese"
        
        # Initialize category and priority indexes
        for category in TermCategory:
            self.terms_by_category[category] = []
        for priority in TermPriority:
            self.terms_by_priority[priority] = []
        
        # Load configuration if provided
        if config_path and config_path.exists():
            self.load_config(config_path)
    
    def load_config(self, config_path: Path) -> None:
        """Load terminology configuration from JSON file."""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            self._validate_config_schema(config_data)
            self._load_terms_from_config(config_data)
            self._load_style_rules_from_config(config_data)
            
            self.config_version = config_data.get("version", "1.0")
            self.config_language = config_data.get("language", "cantonese")
            
        except Exception as e:
            raise RuntimeError(f"Failed to load terminology config from {config_path}: {str(e)}")
    
    def _validate_config_schema(self, config_data: dict) -> None:
        """Validate the configuration data schema."""
        required_fields = ["terminology"]
        for field in required_fields:
            if field not in config_data:
                raise ValueError(f"Missing required field in config: {field}")
        
        if not isinstance(config_data["terminology"], dict):
            raise ValueError("Terminology field must be a dictionary")
    
    def _load_terms_from_config(self, config_data: dict) -> None:
        """Load terminology terms from configuration data."""
        terminology_data = config_data["terminology"]
        
        for category_name, terms_list in terminology_data.items():
            try:
                category = TermCategory(category_name)
            except ValueError:
                # Skip unknown categories with warning
                print(f"Warning: Unknown terminology category '{category_name}' skipped")
                continue
            
            for term_data in terms_list:
                try:
                    # Ensure category is set
                    term_data["category"] = category_name
                    term = TerminologyTerm.from_dict(term_data)
                    self.add_term(term)
                except Exception as e:
                    print(f"Warning: Failed to load term {term_data.get('id', 'unknown')}: {e}")
    
    def _load_style_rules_from_config(self, config_data: dict) -> None:
        """Load style configuration rules from config data."""
        style_rules = config_data.get("style_rules", {})
        
        # Load written style configuration
        written_config = style_rules.get("written", {})
        self.style_config["written"] = StyleConfiguration(
            prefer_chinese=written_config.get("prefer_chinese", True),
            convert_english=written_config.get("convert_english", True),
            formal_register=written_config.get("formal_register", True),
            preserve_spoken=False,
            natural_mixing=False,
            informal_register=False
        )
        
        # Load colloquial style configuration
        colloquial_config = style_rules.get("colloquial", {})
        self.style_config["colloquial"] = StyleConfiguration(
            prefer_chinese=colloquial_config.get("prefer_chinese", False),
            convert_english=colloquial_config.get("convert_english", False),
            formal_register=False,
            preserve_spoken=colloquial_config.get("preserve_spoken", True),
            natural_mixing=colloquial_config.get("natural_mixing", True),
            informal_register=colloquial_config.get("informal_register", True)
        )
    
    def add_term(self, term: TerminologyTerm) -> None:
        """Add a terminology term to the service."""
        self.terms[term.id] = term
        self.terms_by_category[term.category].append(term)
        self.terms_by_priority[term.priority].append(term)
    
    def find_terms_in_text(self, text: str, case_sensitive: bool = False) -> List[TerminologyMatch]:
        """Find all terminology matches in the given text."""
        matches = []
        
        # Sort terms by priority (high to low) and then by length (longest first)
        sorted_terms = sorted(
            self.terms.values(),
            key=lambda t: (-t.get_priority_score(), -max(len(form) for form in t.all_forms))
        )
        
        for term in sorted_terms:
            for form in term.all_forms:
                # Use word boundary regex for exact matching
                if case_sensitive:
                    pattern = rf'\b{re.escape(form)}\b'
                else:
                    pattern = rf'\b{re.escape(form)}\b'
                    flags = re.IGNORECASE
                
                for match in re.finditer(pattern, text, flags if not case_sensitive else 0):
                    # Check if this position is already covered by a higher priority match
                    start, end = match.span()
                    if not self._overlaps_with_existing_matches(matches, start, end):
                        matches.append(TerminologyMatch(
                            term=term,
                            matched_text=match.group(),
                            start_pos=start,
                            end_pos=end,
                            confidence=1.0
                        ))
        
        # Sort matches by position for consistent processing
        return sorted(matches, key=lambda m: m.start_pos)
    
    def _overlaps_with_existing_matches(self, matches: List[TerminologyMatch], start: int, end: int) -> bool:
        """Check if a text span overlaps with existing matches."""
        for match in matches:
            if not (end <= match.start_pos or start >= match.end_pos):
                return True
        return False
    
    def apply_terminology_replacements(self, text: str, language_style: str = "colloquial") -> str:
        """Apply terminology replacements to text based on language style."""
        matches = self.find_terms_in_text(text)
        if not matches:
            return text
        
        # Apply replacements in reverse order to maintain position integrity
        result = text
        for match in reversed(matches):
            replacement = match.term.get_replacement_for_style(language_style)
            result = result[:match.start_pos] + replacement + result[match.end_pos:]
        
        return result
    
    def get_terms_by_category(self, category: TermCategory) -> List[TerminologyTerm]:
        """Get all terms in a specific category."""
        return self.terms_by_category.get(category, [])
    
    def get_terms_by_priority(self, priority: TermPriority) -> List[TerminologyTerm]:
        """Get all terms with a specific priority."""
        return self.terms_by_priority.get(priority, [])
    
    def get_style_configuration(self, style: str) -> Optional[StyleConfiguration]:
        """Get style configuration for a given style."""
        return self.style_config.get(style.lower())
    
    def generate_terminology_summary_for_prompt(self, language_style: str = "colloquial") -> str:
        """Generate a summary of terminology for inclusion in AI prompts."""
        if not self.terms:
            return ""
        
        summary_parts = ["### Custom Terminology Configuration\n"]
        summary_parts.append("You have access to the following custom terminology database:\n")
        
        # Group terms by category
        for category in TermCategory:
            category_terms = self.get_terms_by_category(category)
            if category_terms:
                category_display = category.value.replace('_', ' ').title()
                summary_parts.append(f"\n**{category_display}:**")
                
                for term in category_terms[:10]:  # Limit to first 10 terms per category
                    replacement = term.get_replacement_for_style(language_style)
                    forms_list = ", ".join(f'"{form}"' for form in term.spoken_forms[:3])  # Show first 3 forms
                    summary_parts.append(f"- {forms_list} → \"{replacement}\" (Priority: {term.priority.value})")
                
                if len(category_terms) > 10:
                    summary_parts.append(f"... and {len(category_terms) - 10} more terms")
        
        # Add style-specific instructions
        style_config = self.get_style_configuration(language_style)
        if style_config:
            summary_parts.append(f"\n**Style Rules for {language_style.title()} Mode:**")
            if language_style.lower() == "written":
                summary_parts.append("- Convert English terms to Chinese equivalents when available")
                summary_parts.append("- Use formal written form from terminology database")
                summary_parts.append("- Maintain standard Chinese register")
            else:
                summary_parts.append("- Preserve speaker's actual word choices")
                summary_parts.append("- Use spoken preference from terminology database")
                summary_parts.append("- Maintain natural code-switching patterns")
        
        summary_parts.append("\n**Application Guidelines:**")
        summary_parts.append("1. Apply terminology replacements based on priority (high > medium > low)")
        summary_parts.append("2. Use exact word boundary matching for term recognition")
        summary_parts.append("3. Preserve context and natural flow of conversation")
        summary_parts.append("4. Only replace terms when confident about the match")
        
        return "\n".join(summary_parts)
    
    def get_statistics(self) -> Dict[str, int]:
        """Get statistics about loaded terminology."""
        stats = {
            "total_terms": len(self.terms),
            "by_category": {},
            "by_priority": {}
        }
        
        for category in TermCategory:
            stats["by_category"][category.value] = len(self.get_terms_by_category(category))
        
        for priority in TermPriority:
            stats["by_priority"][priority.value] = len(self.get_terms_by_priority(priority))
        
        return stats
    
    def is_loaded(self) -> bool:
        """Check if terminology configuration is loaded."""
        return len(self.terms) > 0
    
    def export_to_dict(self) -> dict:
        """Export current terminology configuration to dictionary."""
        config = {
            "version": self.config_version,
            "language": self.config_language,
            "terminology": {},
            "style_rules": {}
        }
        
        # Export terms by category
        for category in TermCategory:
            category_terms = self.get_terms_by_category(category)
            if category_terms:
                config["terminology"][category.value] = [
                    term.to_dict() for term in category_terms
                ]
        
        # Export style rules
        for style_name, style_config in self.style_config.items():
            config["style_rules"][style_name] = {
                "prefer_chinese": style_config.prefer_chinese,
                "convert_english": style_config.convert_english,
                "formal_register": style_config.formal_register,
                "preserve_spoken": style_config.preserve_spoken,
                "natural_mixing": style_config.natural_mixing,
                "informal_register": style_config.informal_register
            }
        
        return config