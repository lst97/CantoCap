"""
Granular progress management for enhanced IPC communication.
"""

import time
from typing import Dict, Optional, Any
from dataclasses import dataclass

# Import unified ProcessingStage from progress_display to avoid duplication
from .progress_display import ProcessingStage


@dataclass
class StageConfig:
    """Configuration for a processing stage."""
    start_percent: float
    end_percent: float
    substages: Dict[str, float] = None
    
    def __post_init__(self):
        if self.substages is None:
            self.substages = {}


class ProgressManager:
    """Manages granular progress tracking and reporting."""
    
    def __init__(self):
        self.stages = {
            ProcessingStage.VALIDATING: StageConfig(0, 6, {
                "start": 0,
                "file_check": 2,
                "parameter_validation": 4,
                "complete": 6
            }),
            ProcessingStage.INITIALIZING: StageConfig(6, 10, {
                "start": 6,
                "services_init": 8,
                "complete": 10
            }),
            ProcessingStage.EXTRACTING_AUDIO: StageConfig(10, 25, {
                "start": 10,
                "stream_analysis": 15,
                "format_conversion": 20,
                "complete": 25
            }),
            ProcessingStage.PREPARING_MODEL: StageConfig(25, 35, {
                "start": 25,
                "model_selection": 28,
                "config_setup": 32,
                "complete": 35
            }),
            ProcessingStage.LOADING_MODEL: StageConfig(35, 45, {
                "device_setup": 37,
                "model_download": 40,
                "pipeline_init": 43,
                "ready": 45
            }),
            ProcessingStage.TRANSCRIBING: StageConfig(45, 65, {
                "start": 45,
                "audio_processing": 50,
                "model_inference": 55,
                "post_processing": 60,
                "complete": 65
            }),
            ProcessingStage.VALIDATING_TRANSCRIPTION: StageConfig(65, 70, {
                "start": 65,
                "validation": 67,
                "complete": 70
            }),
            ProcessingStage.GENERATING_SUBTITLE_DOCUMENT: StageConfig(70, 75, {
                "start": 70,
                "document_creation": 72,
                "complete": 75
            }),
            ProcessingStage.SUBTITLE_VALIDATION: StageConfig(75, 80, {
                "start": 75,
                "tag_application": 77,
                "complete": 80
            }),
            ProcessingStage.GEMINI_TRANSCRIPTION_REFINEMENT: StageConfig(80, 85, {
                "start": 80,
                "ai_processing": 82,
                "complete": 85
            }),
            ProcessingStage.SUBTITLE_TRANSLATION: StageConfig(85, 90, {
                "start": 85,
                "translation": 87,
                "complete": 90
            }),
            ProcessingStage.FORMATTING_SUBTITLES: StageConfig(90, 95, {
                "start": 90,
                "optimization": 92,
                "complete": 95
            }),
            ProcessingStage.SAVING_FILE: StageConfig(95, 98, {
                "start": 95,
                "file_write": 96,
                "complete": 98
            }),
            ProcessingStage.GENERATING_STATISTICS: StageConfig(98, 100, {
                "start": 98,
                "calculation": 99,
                "complete": 100
            })
        }
        
        self.current_stage: Optional[ProcessingStage] = None
        self.current_substage: Optional[str] = None
        self.stage_start_time: Optional[float] = None
        self.overall_start_time: Optional[float] = None
        self.stage_history: Dict[ProcessingStage, float] = {}
        
    def start_overall_progress(self):
        """Start overall progress tracking."""
        self.overall_start_time = time.time()
        
    def update_progress(self, stage: ProcessingStage, substage: str = None, 
                       custom_percent: float = None, message: str = None) -> Dict[str, Any]:
        """
        Update progress and return progress data for IPC.
        
        Args:
            stage: Current processing stage
            substage: Current substage (optional)
            custom_percent: Override automatic percentage calculation
            message: Custom progress message
            
        Returns:
            Dictionary with progress information for IPC
        """
        # Track stage transitions
        if self.current_stage != stage:
            if self.current_stage and self.stage_start_time:
                stage_duration = time.time() - self.stage_start_time
                self.stage_history[self.current_stage] = stage_duration
                
            self.current_stage = stage
            self.current_substage = None
            self.stage_start_time = time.time()
            
        self.current_substage = substage
        
        # Calculate progress percentage
        if custom_percent is not None:
            percent = custom_percent
        else:
            stage_config = self.stages[stage]
            if substage and substage in stage_config.substages:
                percent = stage_config.substages[substage]
            else:
                percent = stage_config.start_percent
                
        # Generate progress message
        if not message:
            if substage:
                message = f"{stage.value}: {self._format_substage_message(stage, substage)}"
            else:
                message = f"{stage.value}: {self._get_stage_default_message(stage)}"
        
        # Calculate time estimates
        estimated_remaining = self._estimate_remaining_time(percent)
        throughput = self._calculate_throughput(percent)
        
        return {
            "stage": stage.value,
            "percent": round(percent, 1),
            "substage": substage,
            "message": message,
            "estimated_remaining": estimated_remaining,
            "throughput": throughput,
            "elapsed_time": self._get_elapsed_time()
        }
    
    def _format_substage_message(self, stage: ProcessingStage, substage: str) -> str:
        """Format a descriptive message for the substage."""
        substage_messages = {
            # Validation substages
            "start": "Starting validation process",
            "file_check": "Checking input file integrity",
            "parameter_validation": "Validating parameters",
            
            # Model Loading substages
            "device_setup": "Setting up processing device",
            "model_download": "Loading model weights",
            "pipeline_init": "Initializing processing pipeline",
            "ready": "Model ready for transcription",
            
            # Transcription substages
            "audio_processing": "Processing audio chunks",
            "model_inference": "Running model inference",
            "post_processing": "Post-processing transcription",
            
            # Default messages
            "complete": "Completed successfully"
        }
        
        return substage_messages.get(substage, substage.replace("_", " ").title())
    
    def _get_stage_default_message(self, stage: ProcessingStage) -> str:
        """Get default message for a stage."""
        stage_messages = {
            ProcessingStage.VALIDATING: "Validating input file and parameters",
            ProcessingStage.INITIALIZING: "Initializing processing services",
            ProcessingStage.EXTRACTING_AUDIO: "Extracting audio from media file",
            ProcessingStage.PREPARING_MODEL: "Preparing model for transcription",
            ProcessingStage.LOADING_MODEL: "Loading transcription model",
            ProcessingStage.TRANSCRIBING: "Transcribing audio content",
            ProcessingStage.VALIDATING_TRANSCRIPTION: "Validating transcription results",
            ProcessingStage.GENERATING_SUBTITLE_DOCUMENT: "Generating subtitle document",
            ProcessingStage.SUBTITLE_VALIDATION: "Applying validation tags",
            ProcessingStage.GEMINI_TRANSCRIPTION_REFINEMENT: "Refining with AI assistance",
            ProcessingStage.SUBTITLE_TRANSLATION: "Translating to target language",
            ProcessingStage.FORMATTING_SUBTITLES: "Formatting and optimizing",
            ProcessingStage.SAVING_FILE: "Saving subtitle file",
            ProcessingStage.GENERATING_STATISTICS: "Generating statistics",
            ProcessingStage.COMPLETED: "Processing completed"
        }
        
        return stage_messages.get(stage, f"Processing {stage.value}")
    
    def _estimate_remaining_time(self, current_percent: float) -> Optional[float]:
        """Estimate remaining time based on current progress and history."""
        if not self.overall_start_time or current_percent <= 0:
            return None
            
        elapsed = time.time() - self.overall_start_time
        if elapsed <= 0:
            return None
            
        remaining_percent = 100 - current_percent
        estimated_total_time = elapsed * (100 / current_percent)
        remaining_time = estimated_total_time - elapsed
        
        return max(0, remaining_time)
    
    def _calculate_throughput(self, current_percent: float) -> Optional[float]:
        """Calculate processing throughput (percent per second)."""
        if not self.overall_start_time or current_percent <= 0:
            return None
            
        elapsed = time.time() - self.overall_start_time
        if elapsed <= 0:
            return None
            
        return current_percent / elapsed
    
    def _get_elapsed_time(self) -> Optional[float]:
        """Get total elapsed time since start."""
        if not self.overall_start_time:
            return None
        return time.time() - self.overall_start_time
    
    def get_stage_for_message(self, message: str) -> Optional[ProcessingStage]:
        """Determine appropriate stage based on message content."""
        message_lower = message.lower()
        
        # Model loading indicators
        if any(indicator in message_lower for indicator in [
            "loading model", "device:", "pipeline loading", "model loaded"
        ]):
            return ProcessingStage.LOADING_MODEL
            
        # Transcription indicators
        elif any(indicator in message_lower for indicator in [
            "transcription", "inference", "audio processing", "chunk"
        ]):
            return ProcessingStage.TRANSCRIBING
            
        return None