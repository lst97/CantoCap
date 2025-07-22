"""Terminology term value object for custom vocabulary management."""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class TermPriority(Enum):
    """Priority levels for terminology term resolution."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TermCategory(Enum):
    """Categories of terminology terms."""
    PROPER_NOUN = "proper_nouns"
    BRAND_NAME = "brand_names"
    TECHNICAL_TERM = "technical_terms"
    SLANG_TERM = "slang_terms"
    INDUSTRY_TERM = "industry_terms"
    LOCATION = "locations"
    PERSON_NAME = "person_names"


@dataclass(frozen=True)
class TerminologyTerm:
    """Value object representing a custom terminology term with multiple forms and style preferences."""
    
    id: str
    spoken_forms: List[str]
    written_form: str
    spoken_preference: str
    category: TermCategory
    priority: TermPriority = TermPriority.MEDIUM
    context: Optional[str] = None
    description: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Validate the terminology term after initialization."""
        if not self.id or not self.id.strip():
            raise ValueError("Term ID cannot be empty")
        
        if not self.spoken_forms:
            raise ValueError("At least one spoken form must be provided")
            
        if not self.written_form or not self.written_form.strip():
            raise ValueError("Written form cannot be empty")
            
        if not self.spoken_preference or not self.spoken_preference.strip():
            raise ValueError("Spoken preference cannot be empty")
        
        if self.spoken_preference not in self.spoken_forms:
            raise ValueError("Spoken preference must be one of the spoken forms")
    
    @property
    def all_forms(self) -> List[str]:
        """Get all possible forms of this term including aliases."""
        return list(set(self.spoken_forms + self.aliases))
    
    def matches_form(self, text: str, case_sensitive: bool = False) -> bool:
        """Check if given text matches any form of this term."""
        if not case_sensitive:
            text = text.lower()
            forms = [form.lower() for form in self.all_forms]
        else:
            forms = self.all_forms
        
        return text in forms
    
    def get_replacement_for_style(self, style: str) -> str:
        """Get the appropriate replacement text for the given language style."""
        if style.lower() in ["written", "formal"]:
            return self.written_form
        elif style.lower() in ["colloquial", "spoken", "casual"]:
            return self.spoken_preference
        else:
            # Default to spoken preference for unknown styles
            return self.spoken_preference
    
    def get_priority_score(self) -> int:
        """Get numeric priority score for conflict resolution."""
        priority_scores = {
            TermPriority.HIGH: 3,
            TermPriority.MEDIUM: 2,
            TermPriority.LOW: 1
        }
        return priority_scores.get(self.priority, 1)
    
    def to_dict(self) -> dict:
        """Convert term to dictionary representation."""
        return {
            "id": self.id,
            "spoken_forms": self.spoken_forms,
            "written_form": self.written_form,
            "spoken_preference": self.spoken_preference,
            "category": self.category.value,
            "priority": self.priority.value,
            "context": self.context,
            "description": self.description,
            "aliases": self.aliases
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "TerminologyTerm":
        """Create term from dictionary representation."""
        return cls(
            id=data["id"],
            spoken_forms=data["spoken_forms"],
            written_form=data["written_form"],
            spoken_preference=data["spoken_preference"],
            category=TermCategory(data["category"]),
            priority=TermPriority(data.get("priority", "medium")),
            context=data.get("context"),
            description=data.get("description"),
            aliases=data.get("aliases", [])
        )


@dataclass
class StyleConfiguration:
    """Configuration for language style handling."""
    
    prefer_chinese: bool = True
    convert_english: bool = True
    formal_register: bool = True
    preserve_spoken: bool = False
    natural_mixing: bool = False
    informal_register: bool = False
    
    @classmethod
    def written_style(cls) -> "StyleConfiguration":
        """Create configuration for written/formal style."""
        return cls(
            prefer_chinese=True,
            convert_english=True,
            formal_register=True,
            preserve_spoken=False,
            natural_mixing=False,
            informal_register=False
        )
    
    @classmethod
    def colloquial_style(cls) -> "StyleConfiguration":
        """Create configuration for colloquial/spoken style."""
        return cls(
            prefer_chinese=False,
            convert_english=False,
            formal_register=False,
            preserve_spoken=True,
            natural_mixing=True,
            informal_register=True
        )