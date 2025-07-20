"""CLI commands for CantoSub."""

from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.text import Text
import time

from ...application import GenerateSubtitlesCommand
from ..di.container import Container
from ...infrastructure.error_handling import (
    handle_error, validate_audio_file, safe_execute,
    AudioProcessingError, TranscriptionError, FileSystemError,
    setup_global_error_handler
)
from .progress_display import (
    create_enhanced_progress_context, ProcessingStage, WhisperProgressTracker, ProgressDisplayManager
)
from .ipc_handler import ipc_log, ipc_progress, ipc_result, ipc_error

console = Console()

# Setup global error handler
setup_global_error_handler()


def generate_command(
    input_file: Path = typer.Argument(
        ...,
        help="Path to input audio/video file",
        exists=True,
        file_okay=True,
        dir_okay=False,
        readable=True
    ),
    output_file: Optional[Path] = typer.Option(
        None,
        "--output",
        "-o",
        help="Output SRT file path (default: same directory as input with .srt extension)"
    ),
    language: str = typer.Option(
        "zh",
        "--language",
        "-l",
        help="Language code for transcription (default: zh for Chinese)"
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        "-m",
        help="Whisper model to use (auto-selects optimal model if not specified)"
    ),
    priority: str = typer.Option(
        "balanced",
        "--priority",
        "-p",
        help="Model selection priority: 'speed', 'quality', or 'balanced'"
    ),
    # Phase 2 features
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable speaker diarization to identify different speakers"
    ),
    written: bool = typer.Option(
        False,
        "--written",
        help="Convert colloquial speech to formal written style using LLM"
    ),
    music: bool = typer.Option(
        False,
        "--music", 
        help="Enable music detection and add [music] labels"
    ),
    charset: str = typer.Option(
        "traditional",
        "--charset",
        help="Character set for output (traditional or simplified)"
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        help="Show detailed technical information during processing"
    ),
    ipc_mode: bool = typer.Option(
        False,
        "--ipc-mode",
        help="Enable IPC mode for machine-readable JSON output"
    )
) -> None:
    """
    Generate Cantonese subtitles from audio/video files with intelligent model selection.
    
    This command automatically selects the optimal Whisper model based on your hardware
    capabilities and performance preferences. You can override with --model if needed.
    
    Priority options:
    • speed: Faster processing, may sacrifice some accuracy
    • quality: Best accuracy, slower processing 
    • balanced: Good balance of speed and quality (default)
    """
    try:
        # Validate priority parameter
        if priority not in ["speed", "quality", "balanced"]:
            raise ValueError(f"Invalid priority '{priority}'. Must be 'speed', 'quality', or 'balanced'")
        
        # Validate input file with enhanced error handling
        validated_input = validate_audio_file(input_file)
        
        # Initialize container and get use case
        def init_services():
            container = Container()
            return container.get_generate_subtitles_use_case()
        
        use_case = safe_execute(
            init_services,
            error_message="Failed to initialize subtitle generation services",
            error_type=AudioProcessingError,
            context="Service initialization"
        )
        
        # Create command with Phase 2 features
        def create_command():
            return GenerateSubtitlesCommand(
                input_file_path=str(validated_input),
                output_file_path=str(output_file) if output_file else None,
                language=language,
                model_name=model,  # Will be None for auto-selection
                enable_speakers=speakers,
                enable_written_style=written,
                enable_music_detection=music,
                charset=charset
            )
        
        command = safe_execute(
            create_command,
            error_message="Failed to create processing command",
            error_type=AudioProcessingError,
            context="Command creation"
        )
        
        # Display file information
        _display_file_info(validated_input, output_file, ipc_mode)
        
        # Execute with enhanced progress tracking
        result = _execute_with_enhanced_progress(command, use_case, verbose, model, priority, ipc_mode)
        
        # Display results
        _display_results(result, ipc_mode)
        
        # Handle processing errors
        if not result.success:
            handle_error(
                TranscriptionError(
                    result.error_message or "Unknown processing error",
                    details={
                        'input_file': str(validated_input),
                        'output_file': str(command.get_effective_output_path().path),
                        'processing_time': getattr(result, 'processing_time_seconds', 0)
                    }
                ),
                context="Subtitle generation",
                exit_code=1,
                ipc_mode=ipc_mode
            )
        
    except (AudioProcessingError, TranscriptionError, FileSystemError) as e:
        # These are our custom errors with rich formatting
        handle_error(e, context="Generate command", exit_code=1, ipc_mode=ipc_mode)
        
    except typer.Exit:
        # Re-raise typer exits
        raise
        
    except Exception as e:
        # Handle any unexpected errors
        handle_error(
            AudioProcessingError(
                f"Unexpected error during subtitle generation: {str(e)}",
                details={
                    'input_file': str(input_file),
                    'error_type': type(e).__name__
                }
            ),
            context="Generate command",
            show_traceback=True,
            exit_code=1,
            ipc_mode=ipc_mode
        )


class UnifiedProgressManager:
    """Unified progress manager that can output to both IPC and rich console."""
    
    def __init__(self, ipc_mode: bool, rich_manager=None, verbose: bool = False):
        self.ipc_mode = ipc_mode
        self.rich_manager = rich_manager
        self.verbose = verbose
        
    def update_stage(self, stage: ProcessingStage, progress: float, message: str):
        """Update processing stage with unified interface."""
        if self.ipc_mode:
            # Map stage to IPC task name and calculate overall progress
            stage_info = ProgressDisplayManager.STAGES[stage]
            overall_progress = stage_info.progress_start + (
                (stage_info.progress_end - stage_info.progress_start) * progress
            )
            ipc_progress(stage_info.name, overall_progress, message)
        else:
            self.rich_manager.update_stage(stage, progress, message)
            self.rich_manager.update_display()
            
    def add_status_message(self, message: str):
        """Add status message with unified interface."""
        if self.ipc_mode:
            ipc_log(message)
        else:
            self.rich_manager.add_status_message(message)
            self.rich_manager.update_display()
            
    def add_technical_message(self, message: str):
        """Add technical message with unified interface."""
        if self.ipc_mode and self.verbose:
            ipc_log(f"Technical: {message}", "debug")
        elif not self.ipc_mode:
            self.rich_manager.add_technical_message(message)
            self.rich_manager.update_display()


def setup_whisper_progress_callback(whisper_service, unified_manager):
    """Set up progress callback for Whisper service."""
    
    def progress_callback(stage: str, progress: float = 0.0, message: str = ""):
        if stage == "model_load_start":
            unified_manager.update_stage(
                ProcessingStage.LOADING_MODEL,
                0.0,
                message or "Loading Whisper model"
            )
        elif stage == "model_load_progress":
            if unified_manager.ipc_mode:
                # For IPC mode, update with current progress within the stage
                stage_info = ProgressDisplayManager.STAGES[ProcessingStage.LOADING_MODEL]
                overall_progress = stage_info.progress_start + (
                    (stage_info.progress_end - stage_info.progress_start) * progress
                )
                ipc_progress("Loading Model", overall_progress, message)
            else:
                unified_manager.rich_manager.update_stage_progress(progress)
                if message:
                    unified_manager.add_status_message(message)
        elif stage == "model_load_complete":
            unified_manager.update_stage(
                ProcessingStage.LOADING_MODEL,
                1.0,
                message or "Model loaded successfully"
            )
        elif stage == "transcription_start":
            unified_manager.update_stage(
                ProcessingStage.TRANSCRIBING,
                0.0,
                message or "Starting audio transcription"
            )
        elif stage == "transcription_progress":
            if unified_manager.ipc_mode:
                # For IPC mode, update with current progress within the stage
                stage_info = ProgressDisplayManager.STAGES[ProcessingStage.TRANSCRIBING]
                overall_progress = stage_info.progress_start + (
                    (stage_info.progress_end - stage_info.progress_start) * progress
                )
                ipc_progress("Transcribing", overall_progress, message)
            else:
                unified_manager.rich_manager.update_stage_progress(progress)
                if message:
                    unified_manager.add_status_message(message)
        elif stage == "transcription_complete":
            unified_manager.update_stage(
                ProcessingStage.TRANSCRIBING,
                1.0,
                message or "Transcription completed"
            )
    
    # Try to set progress callback if available
    if hasattr(whisper_service, 'set_progress_callback'):
        whisper_service.set_progress_callback(progress_callback)
    if hasattr(whisper_service, 'set_quiet_mode'):
        whisper_service.set_quiet_mode(not unified_manager.verbose)


def _execute_with_enhanced_progress(command, use_case, verbose: bool, model: Optional[str], priority: str, ipc_mode: bool = False):
    """Execute the subtitle generation with enhanced progress tracking."""
    
    # Create unified progress manager based on mode
    if ipc_mode:
        unified_manager = UnifiedProgressManager(ipc_mode=True, verbose=verbose)
        return _execute_processing_steps(command, use_case, verbose, model, priority, unified_manager)
    else:
        # Use rich console mode with context manager
        with create_enhanced_progress_context(console) as rich_manager:
            rich_manager.show_technical_details = verbose
            unified_manager = UnifiedProgressManager(ipc_mode=False, rich_manager=rich_manager, verbose=verbose)
            
            return _execute_processing_steps(command, use_case, verbose, model, priority, unified_manager)


def _execute_processing_steps(command, use_case, verbose: bool, model: Optional[str], priority: str, unified_manager):
    """Execute the processing steps with unified progress tracking."""
    try:
        # Step 1: Validation
        unified_manager.update_stage(
            ProcessingStage.VALIDATING,
            0.0,
            "Validating input file and parameters"
        )
        unified_manager.add_technical_message(f"Checking file format and accessibility for: {command.input_file_path}")
        time.sleep(0.3)
        
        file_size_mb = Path(command.input_file_path).stat().st_size / (1024*1024)
        unified_manager.update_stage(
            ProcessingStage.VALIDATING,
            1.0,
            "Input validation completed successfully"
        )
        unified_manager.add_status_message(f"File size: {file_size_mb:.1f} MB")
        
        # Step 2: Initialization
        unified_manager.update_stage(
            ProcessingStage.INITIALIZING,
            0.5,
            "Initializing processing services"
        )
        unified_manager.add_technical_message(f"Setting up Whisper service with priority: {priority}")
        
        # Try to configure Whisper service for progress tracking
        container = Container()
        whisper_service = container.get_whisper_service(model_name=model, priority=priority)
        setup_whisper_progress_callback(whisper_service, unified_manager)
        
        unified_manager.update_stage(
            ProcessingStage.INITIALIZING,
            1.0,
            "Services initialized successfully"
        )
        unified_manager.add_status_message(f"Ready to process with model selection priority: {priority}")
        
        # Step 3: Audio extraction
        input_path = Path(command.input_file_path)
        unified_manager.update_stage(
            ProcessingStage.EXTRACTING_AUDIO,
            0.0,
            "Starting audio extraction from media file"
        )
        unified_manager.add_technical_message(f"Extracting audio from {input_path.suffix.upper()} format")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.EXTRACTING_AUDIO,
            0.5,
            "Processing audio stream"
        )
        unified_manager.add_status_message("Converting to Whisper-compatible format (16kHz, mono)")
        time.sleep(0.3)
        
        unified_manager.update_stage(
            ProcessingStage.EXTRACTING_AUDIO,
            1.0,
            "Audio extraction completed"
        )
        unified_manager.add_status_message("Audio stream ready for transcription")
        
        # Step 4: Model preparation
        actual_model = whisper_service.model_name  # Get the actually selected model
        unified_manager.update_stage(
            ProcessingStage.PREPARING_MODEL,
            0.0,
            f"Preparing {actual_model} for transcription"
        )
        unified_manager.add_status_message(f"Selected model: {actual_model} (priority: {priority})")
        unified_manager.add_technical_message(f"Language: {command.language}, Phase 2 features: {command.has_phase2_features()}")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.PREPARING_MODEL,
            1.0,
            "Model preparation completed"
        )
        unified_manager.add_status_message("Ready to begin transcription process")
        
        # Step 5-7: Model loading and transcription (handled by Whisper callbacks)
        
        # Execute the main use case
        result = use_case.execute(command)
        
        # Step 8: Subtitle formatting
        unified_manager.update_stage(
            ProcessingStage.FORMATTING_SUBTITLES,
            0.0,
            "Formatting and optimizing subtitles"
        )
        unified_manager.add_status_message(f"Generated {result.subtitle_count} subtitle segments")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.FORMATTING_SUBTITLES,
            0.7,
            "Applying timing optimizations"
        )
        unified_manager.add_technical_message("Optimizing timing and line breaks for readability")
        time.sleep(0.1)
        
        unified_manager.update_stage(
            ProcessingStage.FORMATTING_SUBTITLES,
            1.0,
            "Subtitle formatting completed"
        )
        unified_manager.add_status_message(f"Optimized {result.subtitle_count} subtitles for {command.charset} charset")
        
        # Step 9: File saving
        output_path = Path(result.output_file_path)
        unified_manager.update_stage(
            ProcessingStage.SAVING_FILE,
            0.0,
            "Saving subtitle file"
        )
        unified_manager.add_technical_message(f"Writing SRT format to: {output_path.name}")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.SAVING_FILE,
            1.0,
            f"Subtitle file saved: {output_path.name}"
        )
        file_size = output_path.stat().st_size if output_path.exists() else 0
        unified_manager.add_status_message(f"Output file size: {file_size / 1024:.1f} KB")
        
        # Step 10: Completion
        unified_manager.update_stage(
            ProcessingStage.COMPLETED,
            1.0,
            f"Processing completed successfully in {result.processing_time_seconds:.1f}s"
        )
        
        return result
        
    except Exception as e:
        if unified_manager.ipc_mode:
            ipc_error(f"Error during processing: {str(e)}")
        else:
            unified_manager.update_stage(
                ProcessingStage.ERROR,
                0.0,
                f"Error during processing: {str(e)}"
            )
        raise


def _display_file_info(input_file: Path, output_file: Optional[Path], ipc_mode: bool = False) -> None:
    """Display input and output file information."""
    # Determine output file path
    if output_file:
        output_path = str(output_file)
    else:
        output_path = str(input_file.with_suffix('.srt'))
    
    if ipc_mode:
        # Output file info as JSON log messages
        ipc_log(f"Input file: {str(input_file)}")
        ipc_log(f"Output file: {output_path}")
        ipc_log("CantoSub - Cantonese Subtitle Generator initialized")
    else:
        # Use rich console output
        info_text = Text()
        info_text.append("📁 Input: ", style="bold blue")
        info_text.append(str(input_file))
        info_text.append("\n📄 Output: ", style="bold green")
        info_text.append(output_path)
        
        console.print(Panel(
            info_text,
            title="🎬 CantoSub - Cantonese Subtitle Generator",
            title_align="left",
            border_style="blue"
        ))


def _display_results(result, ipc_mode: bool = False) -> None:
    """Display processing results."""
    if result.success:
        if ipc_mode:
            # Output results as JSON
            result_data = {
                'subtitle_count': result.subtitle_count,
                'processing_time': result.processing_time_seconds
            }
            
            # Add statistics if available
            if result.statistics:
                result_data['statistics'] = result.statistics
            
            ipc_result(result.output_file_path, success=True, **result_data)
            ipc_log("Processing completed successfully")
        else:
            # Use rich console output
            success_text = Text()
            success_text.append("✅ Successfully generated subtitles!\n\n", style="bold green")
            success_text.append(f"📊 Subtitles created: {result.subtitle_count}\n")
            success_text.append(f"⏱️ Processing time: {result.processing_time_seconds:.1f} seconds\n")
            success_text.append(f"📁 Output file: {result.output_file_path}\n")
            
            # Add statistics if available
            if result.statistics:
                stats = result.statistics
                success_text.append(f"\n📈 Quality Statistics:\n", style="bold")
                success_text.append(f"   • Total duration: {stats.get('total_duration', 0):.1f}s\n")
                success_text.append(f"   • Average subtitle duration: {stats.get('average_subtitle_duration', 0):.1f}s\n")
                success_text.append(f"   • Language: {stats.get('language', 'unknown')}\n")
                
                if 'formatting' in stats:
                    formatting = stats['formatting']
                    quality_score = formatting.get('quality_score', 0)
                    success_text.append(f"   • Quality score: {quality_score:.1%}\n")
            
            console.print(Panel(
                success_text,
                title="🎉 Processing Complete",
                title_align="left",
                border_style="green"
            ))
    else:
        # Error message is handled in main function
        pass