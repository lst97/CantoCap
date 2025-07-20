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
    create_enhanced_progress_context, ProcessingStage, WhisperProgressTracker
)

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
        _display_file_info(validated_input, output_file)
        
        # Execute with enhanced progress tracking
        result = _execute_with_enhanced_progress(command, use_case, verbose, model, priority)
        
        # Display results
        _display_results(result)
        
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
                exit_code=1
            )
        
    except (AudioProcessingError, TranscriptionError, FileSystemError) as e:
        # These are our custom errors with rich formatting
        handle_error(e, context="Generate command", exit_code=1)
        
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
            exit_code=1
        )


def _execute_with_enhanced_progress(command, use_case, verbose: bool, model: Optional[str], priority: str):
    """Execute the subtitle generation with enhanced progress tracking."""
    
    def setup_whisper_progress_callback(whisper_service, progress_manager):
        """Set up progress callback for Whisper service."""
        
        def progress_callback(stage: str, progress: float = 0.0, message: str = ""):
            if stage == "model_load_start":
                progress_manager.update_stage(
                    ProcessingStage.LOADING_MODEL,
                    0.0,
                    message or "Loading Whisper model"
                )
            elif stage == "model_load_progress":
                progress_manager.update_stage_progress(progress)
                if message:
                    progress_manager.add_status_message(message)
            elif stage == "model_load_complete":
                progress_manager.update_stage(
                    ProcessingStage.LOADING_MODEL,
                    1.0,
                    message or "Model loaded successfully"
                )
            elif stage == "transcription_start":
                progress_manager.update_stage(
                    ProcessingStage.TRANSCRIBING,
                    0.0,
                    message or "Starting audio transcription"
                )
            elif stage == "transcription_progress":
                progress_manager.update_stage_progress(progress)
                if message:
                    progress_manager.add_status_message(message)
            elif stage == "transcription_complete":
                progress_manager.update_stage(
                    ProcessingStage.TRANSCRIBING,
                    1.0,
                    message or "Transcription completed"
                )
            
            # Update display
            progress_manager.update_display()
        
        # Try to set progress callback if available
        if hasattr(whisper_service, 'set_progress_callback'):
            whisper_service.set_progress_callback(progress_callback)
        if hasattr(whisper_service, 'set_quiet_mode'):
            whisper_service.set_quiet_mode(not verbose)
    
    # Execute with enhanced progress display
    with create_enhanced_progress_context(console) as progress_manager:
        # Configure progress manager
        progress_manager.show_technical_details = verbose
        
        try:
            # Step 1: Validation
            progress_manager.update_stage(
                ProcessingStage.VALIDATING,
                0.0,
                "Validating input file and parameters"
            )
            progress_manager.add_technical_message(f"Checking file format and accessibility for: {command.input_file_path}")
            progress_manager.update_display()
            time.sleep(0.3)
            
            progress_manager.update_stage(
                ProcessingStage.VALIDATING,
                1.0,
                "Input validation completed successfully"
            )
            progress_manager.add_status_message(f"File size: {Path(command.input_file_path).stat().st_size / (1024*1024):.1f} MB")
            progress_manager.update_display()
            
            # Step 2: Initialization
            progress_manager.update_stage(
                ProcessingStage.INITIALIZING,
                0.5,
                "Initializing processing services"
            )
            progress_manager.add_technical_message(f"Setting up Whisper service with priority: {priority}")
            progress_manager.update_display()
            
            # Try to configure Whisper service for progress tracking
            container = Container()
            whisper_service = container.get_whisper_service(model_name=model, priority=priority)
            setup_whisper_progress_callback(whisper_service, progress_manager)
            
            progress_manager.update_stage(
                ProcessingStage.INITIALIZING,
                1.0,
                "Services initialized successfully"
            )
            progress_manager.add_status_message(f"Ready to process with model selection priority: {priority}")
            progress_manager.update_display()
            
            # Step 3: Audio extraction
            input_path = Path(command.input_file_path)
            progress_manager.update_stage(
                ProcessingStage.EXTRACTING_AUDIO,
                0.0,
                "Starting audio extraction from media file"
            )
            progress_manager.add_technical_message(f"Extracting audio from {input_path.suffix.upper()} format")
            progress_manager.update_display()
            time.sleep(0.2)
            
            progress_manager.update_stage(
                ProcessingStage.EXTRACTING_AUDIO,
                0.5,
                "Processing audio stream"
            )
            progress_manager.add_status_message("Converting to Whisper-compatible format (16kHz, mono)")
            progress_manager.update_display()
            time.sleep(0.3)
            
            progress_manager.update_stage(
                ProcessingStage.EXTRACTING_AUDIO,
                1.0,
                "Audio extraction completed"
            )
            progress_manager.add_status_message("Audio stream ready for transcription")
            progress_manager.update_display()
            
            # Step 4: Model preparation
            actual_model = whisper_service.model_name  # Get the actually selected model
            progress_manager.update_stage(
                ProcessingStage.PREPARING_MODEL,
                0.0,
                f"Preparing {actual_model} for transcription"
            )
            progress_manager.add_status_message(f"Selected model: {actual_model} (priority: {priority})")
            progress_manager.add_technical_message(f"Language: {command.language}, Phase 2 features: {command.has_phase2_features()}")
            progress_manager.update_display()
            time.sleep(0.2)
            
            progress_manager.update_stage(
                ProcessingStage.PREPARING_MODEL,
                1.0,
                "Model preparation completed"
            )
            progress_manager.add_status_message("Ready to begin transcription process")
            progress_manager.update_display()
            
            # Step 5-7: Model loading and transcription (handled by Whisper callbacks)
            
            # Execute the main use case
            result = use_case.execute(command)
            
            # Step 8: Subtitle formatting
            progress_manager.update_stage(
                ProcessingStage.FORMATTING_SUBTITLES,
                0.0,
                "Formatting and optimizing subtitles"
            )
            progress_manager.add_status_message(f"Generated {result.subtitle_count} subtitle segments")
            progress_manager.update_display()
            time.sleep(0.2)
            
            progress_manager.update_stage(
                ProcessingStage.FORMATTING_SUBTITLES,
                0.7,
                "Applying timing optimizations"
            )
            progress_manager.add_technical_message("Optimizing timing and line breaks for readability")
            progress_manager.update_display()
            time.sleep(0.1)
            
            progress_manager.update_stage(
                ProcessingStage.FORMATTING_SUBTITLES,
                1.0,
                "Subtitle formatting completed"
            )
            progress_manager.add_status_message(f"Optimized {result.subtitle_count} subtitles for {command.charset} charset")
            progress_manager.update_display()
            
            # Step 9: File saving
            output_path = Path(result.output_file_path)
            progress_manager.update_stage(
                ProcessingStage.SAVING_FILE,
                0.0,
                "Saving subtitle file"
            )
            progress_manager.add_technical_message(f"Writing SRT format to: {output_path.name}")
            progress_manager.update_display()
            time.sleep(0.2)
            
            progress_manager.update_stage(
                ProcessingStage.SAVING_FILE,
                1.0,
                f"Subtitle file saved: {output_path.name}"
            )
            file_size = output_path.stat().st_size if output_path.exists() else 0
            progress_manager.add_status_message(f"Output file size: {file_size / 1024:.1f} KB")
            progress_manager.update_display()
            
            # Step 10: Completion
            progress_manager.update_stage(
                ProcessingStage.COMPLETED,
                1.0,
                f"Processing completed successfully in {result.processing_time_seconds:.1f}s"
            )
            progress_manager.update_display()
            
            return result
            
        except Exception as e:
            progress_manager.update_stage(
                ProcessingStage.ERROR,
                0.0,
                f"Error during processing: {str(e)}"
            )
            progress_manager.update_display()
            raise


def _display_file_info(input_file: Path, output_file: Optional[Path]) -> None:
    """Display input and output file information."""
    # Determine output file path
    if output_file:
        output_path = str(output_file)
    else:
        output_path = str(input_file.with_suffix('.srt'))
    
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


def _display_results(result) -> None:
    """Display processing results."""
    if result.success:
        # Success message
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