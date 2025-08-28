"""Service for collecting and exporting verbose logs to a text file.

This service follows the engine's infrastructure/services pattern and
is decoupled from console rendering. It aggregates structured messages
throughout processing and can export them to a .txt file.
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional


@dataclass
class VerboseLogEntry:
    timestamp: datetime
    level: str
    category: str
    message: str
    details: Optional[str] = None


class VerboseLogService:
    """Aggregates verbose log entries and exports them as text."""

    def __init__(self) -> None:
        self._entries: List[VerboseLogEntry] = []

    def _add(self, level: str, message: str, category: str = "process", details: Optional[str] = None) -> None:
        if not message:
            return
        self._entries.append(
            VerboseLogEntry(
                timestamp=datetime.now(),
                level=level.upper(),
                category=category,
                message=message,
                details=details,
            )
        )

    def log_status(self, message: str, details: Optional[str] = None) -> None:
        self._add("info", message, "process", details)

    def log_technical(self, message: str) -> None:
        self._add("debug", message, "system")

    def log_debug(self, message: str) -> None:
        self._add("debug", message, "debug")

    def log_performance(self, message: str) -> None:
        self._add("debug", message, "performance")

    def log_stage(self, stage: str, message: Optional[str] = None, progress: Optional[float] = None) -> None:
        parts = [f"Stage: {stage}"]
        if progress is not None:
            parts.append(f"progress={progress:.0f}%")
        if message:
            parts.append(f"message={message}")
        self._add("info", ", ".join(parts), "stage")

    def export(self, file_path: str) -> None:
        """Export the collected log to a text file."""
        try:
            lines: List[str] = []
            lines.append("CantoCap Verbose Log")
            lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            lines.append("=== Entries ===")
            if not self._entries:
                lines.append("(no entries)")
            else:
                for e in self._entries:
                    ts = e.timestamp.strftime('%H:%M:%S')
                    base = f"[{ts}] [{e.level}] [{e.category}] {e.message}".rstrip()
                    lines.append(base)
                    if e.details and e.details != e.message:
                        lines.append(f"    Details: {e.details}")

            content = "\n".join(lines) + "\n"
            dest = Path(file_path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
        except Exception:
            # Best-effort: don't propagate export failures
            pass

