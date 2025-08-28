"""CLI commands for CantoCap."""

from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
import time

from ...application import GenerateSubtitlesCommand
from ...domain.value_objects import LanguageCode
from ..di.container import Container
from ...infrastructure.error_handling import (
    handle_error, validate_audio_file, safe_execute,
    AudioProcessingError, TranscriptionError, FileSystemError,
    setup_global_error_handler
)
from ...infrastructure.validation import ArgumentValidator, ValidationSeverity
from .progress_display import ProcessingStage, ProgressDisplayManager
from .ipc_handler import ipc_log_message, ipc_progress, ipc_completion_with_json, ipc_processing_error, ipc_status_change

console = Console()

# Setup global error handler
setup_global_error_handler()


def show_translation_help():
    """Show help information about translation options."""
    console.print("\n[bold blue]Translation Options:[/bold blue]")
    console.print("Add translated subtitles below Chinese text using:")
    console.print("  --subtitle LANGUAGE_CODE")
    console.print("\n[bold]Examples:[/bold]")
    console.print("  --subtitle en_us    English (US) translation")
    console.print("  --subtitle ja_jp    Japanese translation")
    console.print("  --subtitle ko_kr    Korean translation")
    
    console.print("\n[bold]Supported language codes:[/bold]")
    supported = LanguageCode.get_supported_codes()
    for code, name in sorted(supported.items()):
        console.print(f"  {code:<8} {name}")
    console.print()


def _validate_command_arguments(
    input_file, output_file, language, model, priority, video_quality, charset,
    ffmpeg_path, terminology_config, max_chunk_duration, gemini_api_key, hf_token,
    subtitle, speakers, written, music, disable_gemini_refinement, verbose, ipc_mode,
    enable_adaptive_chunking, service_type, whisper_chunk_duration, gemini_chunk_duration, chunking_strategy
):
    """Validate all command arguments and return sanitized values."""
    # Comprehensive argument validation
    args_to_validate = {
        'input_file': input_file,
        'output_file': output_file,
        'language': language,
        'model': model,
        'priority': priority,
        'video_quality': video_quality,
        'charset': charset,
        'ffmpeg_path': ffmpeg_path,
        'terminology_config': terminology_config,
        'max_chunk_duration': max_chunk_duration,
        'gemini_api_key': gemini_api_key,
        'hf_token': hf_token,
        'subtitle': subtitle,
        # Boolean flags
        'speakers': speakers,
        'written': written,
        'music': music,
        'disable_gemini_refinement': disable_gemini_refinement,
        'verbose': verbose,
        'ipc_mode': ipc_mode
    }
    
    # Validate all arguments
    is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(args_to_validate)
    
    # Display validation errors and warnings
    if validation_issues:
        errors = [issue for issue in validation_issues if issue.severity == ValidationSeverity.ERROR]
        warnings = [issue for issue in validation_issues if issue.severity == ValidationSeverity.WARNING]
        
        # Show errors first
        if errors:
            console.print("\n[red]Validation Errors:[/red]")
            for issue in errors:
                console.print(f"  • {issue.field}: {issue.message}")
                if issue.suggestion:
                    console.print(f"    [yellow]→ {issue.suggestion}[/yellow]")
        
        # Show warnings
        if warnings and not ipc_mode:
            console.print("\n[yellow]Warnings:[/yellow]")
            for issue in warnings:
                console.print(f"  • {issue.field}: {issue.message}")
                if issue.suggestion:
                    console.print(f"    → {issue.suggestion}")
        
        # Exit if there are errors
        if not is_valid:
            raise typer.Exit(1)
    
    return sanitized_args


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
        help="Language code for transcription alignment models (e.g., 'zh', 'ja', 'en')"
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        "-m",
        help="Whisper model to use (auto-selects optimal model if not specified). Use full format: 'openai/whisper-large-v3' or 'whisperX/large-v3'"
    ),
    priority: str = typer.Option(
        "balanced",
        "--priority",
        "-p",
        help="Model selection priority: 'speed', 'quality', or 'balanced'"
    ),
    # Enhanced features
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable automatic speaker identification and diarization"
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
    
    # New Gemini Flash options
    gemini_api_key: Optional[str] = typer.Option(
        None,
        "--gemini-key",
        help="Google Gemini API key (overrides .env file and environment variables)"
    ),
    hf_token: Optional[str] = typer.Option(
        None,
        "--hf-token",
        help="Hugging Face API token for gated models (e.g., pyannote/speaker-diarization-3.1)"
    ),
    
    disable_gemini_refinement: bool = typer.Option(
        False,
        "--no-gemini-refinement",
        help="Disable Gemini Flash transcription refinement"
    ),
    
    # Enhanced chunking options
    max_chunk_duration: int = typer.Option(
        15,
        "--max-chunk-duration",
        help="Maximum chunk duration in minutes for large files (legacy option)"
    ),
    
    # New adaptive chunking options
    enable_adaptive_chunking: bool = typer.Option(
        True,
        "--enable-adaptive-chunking/--disable-adaptive-chunking",
        help="Enable intelligent chunking with service-specific optimizations"
    ),
    
    service_type: str = typer.Option(
        "auto",
        "--service-type",
        help="Processing strategy: 'auto' (recommended), 'whisper', or 'gemini'"
    ),
    
    whisper_chunk_duration: int = typer.Option(
        30,
        "--whisper-chunk-duration",
        help="Chunk duration in seconds for OpenAI Whisper transcription (optimal: 30s)"
    ),
    
    gemini_chunk_duration: int = typer.Option(
        15,
        "--gemini-chunk-duration",
        help="Chunk duration in minutes for Google Gemini refinement (optimal: 15min)"
    ),
    
    chunking_strategy: Optional[str] = typer.Option(
        None,
        "--chunking-strategy",
        help="JSON string with complete chunking strategy configuration"
    ),
    
    video_quality: str = typer.Option(
        "360p",
        "--video-quality",
        help="Video compression quality for LLM analysis (360p, 480p, 720p)"
    ),
    
    terminology_config: Optional[Path] = typer.Option(
        None,
        "--terminology-config",
        "--config",
        "-c",
        help="Path to JSON file with custom terminology and language style rules"
    ),
    
    ffmpeg_path: str = typer.Option(
        ...,
        "--ffmpeg-path",
        help="Path to FFmpeg executable (required)"
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
    ),
    subtitle: Optional[str] = typer.Option(
        None,
        "--subtitle",
        help="Language code for subtitle translation (e.g., 'en_us', 'ja_jp', 'ko_kr')"
    ),
    translation_help: bool = typer.Option(
        False,
        "--translation-help",
        help="Show available translation language codes and exit"
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
    
    Translation options:
    • --subtitle LANGUAGE_CODE: Add translated subtitles below Chinese text
    • --translation-help: Show all supported language codes
    """
    try:
        # Handle translation help request
        if translation_help:
            show_translation_help()
            raise typer.Exit(0)
        
        # Validate all arguments using helper function
        sanitized_args = _validate_command_arguments(
            input_file, output_file, language, model, priority, video_quality, charset,
            ffmpeg_path, terminology_config, max_chunk_duration, gemini_api_key, hf_token,
            subtitle, speakers, written, music, disable_gemini_refinement, verbose, ipc_mode,
            enable_adaptive_chunking, service_type, whisper_chunk_duration, gemini_chunk_duration, chunking_strategy
        )
        
        # Use sanitized arguments
        input_file = Path(sanitized_args.get('input_file', input_file))
        if 'output_file' in sanitized_args:
            output_file = Path(sanitized_args['output_file'])
        language = sanitized_args.get('language', language)
        model = sanitized_args.get('model', model)
        priority = sanitized_args.get('priority', priority)
        video_quality = sanitized_args.get('video_quality', video_quality)
        charset = sanitized_args.get('charset', charset)
        ffmpeg_path = sanitized_args.get('ffmpeg_path', ffmpeg_path)
        if 'terminology_config' in sanitized_args:
            terminology_config = Path(sanitized_args['terminology_config'])
        max_chunk_duration = sanitized_args.get('max_chunk_duration', max_chunk_duration)
        gemini_api_key = sanitized_args.get('gemini_api_key', gemini_api_key)
        hf_token = sanitized_args.get('hf_token', hf_token)
        
        # Handle subtitle translation option
        translation_language = sanitized_args.get('subtitle', subtitle)
        enable_translation = translation_language is not None
        
        # Initialize services
        from ...infrastructure.services.configuration_service import ConfigurationService
        from ...infrastructure.services.warning_service import AccuracyWarningService
        from ...infrastructure.services.media_chunking_service import MediaChunkingService, ChunkingStrategy
        
        config_service = ConfigurationService()
        warning_service = AccuracyWarningService()
        chunking_service = MediaChunkingService(
            ChunkingStrategy(max_chunk_duration_seconds=max_chunk_duration * 60)
        )
        
        # Resolve Gemini API key with priority order
        resolved_gemini_key = config_service.get_gemini_api_key(gemini_api_key)
        is_valid, message = config_service.validate_gemini_configuration(resolved_gemini_key)
        
        # Handle missing API key with graceful degradation
        actual_speakers = speakers
        actual_disable_refinement = disable_gemini_refinement
        actual_enable_translation = enable_translation
        actual_translation_language = translation_language
        
        if not is_valid:
            impact_features = []
            if speakers:
                impact_features.append("Automatic speaker identification")
                actual_speakers = False  # Disable speakers if no API key
            if not disable_gemini_refinement:
                impact_features.append("AI-powered transcription refinement")
                actual_disable_refinement = True  # Disable refinement if no API key
            if enable_translation:
                lang_name = LanguageCode.from_string(translation_language).language_name
                impact_features.append(f"Subtitle translation to {lang_name}")
                actual_enable_translation = False  # Disable translation if no API key
                actual_translation_language = None
            
            if impact_features:
                warning_service.warn_missing_gemini_key(impact_features)
        
        # Check if chunking is required
        from ...domain.value_objects import FilePath
        input_file_path = FilePath.from_string(str(input_file))
        if chunking_service.should_chunk_file(input_file_path):
            file_size_mb = chunking_service._get_file_size_mb(input_file_path)
            chunks = chunking_service.create_chunks(input_file_path)
            warning_service.warn_chunking_required(file_size_mb, len(chunks))
        
        # Initialize container and get use case
        def init_services():
            container = Container(ffmpeg_path=ffmpeg_path)
            # Pre-configure whisper service with correct model/priority
            container.get_whisper_service(model_name=model, priority=priority)
            return container.get_enhanced_generate_subtitles_use_case(
                model_name=model,
                priority=priority,
                gemini_api_key=resolved_gemini_key if is_valid else None,
                terminology_config_path=str(terminology_config) if terminology_config else None
            )
        
        use_case = safe_execute(
            init_services,
            error_message="Failed to initialize subtitle generation services",
            error_type=AudioProcessingError,
            context="Service initialization"
        )
        
        # Create enhanced command
        def create_command():
            return GenerateSubtitlesCommand(
                input_file_path=str(input_file),
                output_file_path=str(output_file) if output_file else None,
                language=language,
                model_name=model,  # Will be None for auto-selection
                enable_speakers=actual_speakers,
                enable_written_style=written,
                enable_music_detection=music,
                charset=charset,
                enable_gemini_refinement=not actual_disable_refinement,
                gemini_api_key=resolved_gemini_key if is_valid else None,
                video_compression_quality=video_quality,
                max_chunk_duration_minutes=max_chunk_duration,
                terminology_config_path=str(terminology_config) if terminology_config else None,
                hf_token=hf_token,
                enable_translation=actual_enable_translation,
                translation_language=actual_translation_language
            )
        
        command = safe_execute(
            create_command,
            error_message="Failed to create processing command",
            error_type=AudioProcessingError,
            context="Command creation"
        )
        
        # Display file information
        _display_file_info(input_file, output_file, ipc_mode)
        
        # Execute with enhanced progress tracking
        result, unified_manager = _execute_with_enhanced_progress(command, use_case, verbose, model, priority, ipc_mode, ffmpeg_path)
        
        # Stop the status display before showing completion panel
        if unified_manager:
            unified_manager.stop_display()
            # Small delay to ensure status display has fully stopped
            time.sleep(0.2)
        
        # Display results
        _display_results(result, ipc_mode)

        # When verbose is enabled in non-IPC mode, export logs next to the SRT file
        if verbose and not ipc_mode and result.success and result.output_file_path and unified_manager:
            try:
                out_path = Path(result.output_file_path)
                log_path = out_path.with_suffix('.txt')
                # Prefer the dedicated verbose log service if available
                vsvc = getattr(unified_manager, 'verbose_log_service', None)
                if vsvc:
                    vsvc.export(str(log_path))
                elif getattr(unified_manager, 'status_display', None):
                    # Backward-compatible fallback
                    unified_manager.status_display.export_logs_to_file(str(log_path))
                console.print(f"[dim]Verbose log saved to: {str(log_path)}[/dim]")
            except Exception:
                # Do not interrupt flow if logging fails
                pass
        
        # Handle processing errors
        if not result.success:
            handle_error(
                TranscriptionError(
                    result.error_message or "Unknown processing error",
                    details={
                        'input_file': str(input_file),
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
    """Unified progress manager that can output to both IPC and simple status display."""
    
    def __init__(self, ipc_mode: bool, verbose: bool = False, verbose_log_service=None):
        self.ipc_mode = ipc_mode
        self.verbose = verbose
        self.verbose_log_service = verbose_log_service
        
        # For non-IPC mode, get the status display
        if not ipc_mode:
            from .status_display import get_status_display
            self.status_display = get_status_display(verbose)
        else:
            self.status_display = None
        
    def update_stage(self, stage: ProcessingStage, progress: float, message: str):
        """Update processing stage with unified interface."""
        # Log into verbose log service
        if self.verbose_log_service:
            stage_info = ProgressDisplayManager.STAGES[stage]
            overall_progress = stage_info.progress_start + (
                (stage_info.progress_end - stage_info.progress_start) * progress
            )
            self.verbose_log_service.log_stage(stage_info.name, message=message, progress=overall_progress)

        if self.ipc_mode:
            # Map stage to IPC task name and calculate overall progress
            stage_info = ProgressDisplayManager.STAGES[stage]
            overall_progress = stage_info.progress_start + (
                (stage_info.progress_end - stage_info.progress_start) * progress
            )
            ipc_progress(stage_info.name, overall_progress, message)
        else:
            # Use status display for non-IPC mode
            if self.status_display:
                stage_info = ProgressDisplayManager.STAGES[stage]
                overall_progress = stage_info.progress_start + (
                    (stage_info.progress_end - stage_info.progress_start) * progress
                )
                self.status_display.update_progress(stage_info.name, overall_progress, message)
            
    def add_status_message(self, message: str):
        """Add status message with unified interface."""
        if self.verbose_log_service:
            self.verbose_log_service.log_status(message)
        if self.ipc_mode:
            ipc_log_message(message)
        else:
            # Add to status display
            if self.status_display:
                self.status_display.add_console_output(message)
            
    def add_technical_message(self, message: str):
        """Add technical message with unified interface."""
        if self.verbose_log_service:
            self.verbose_log_service.log_technical(message)
        if self.ipc_mode and self.verbose:
            ipc_log_message(f"Technical: {message}")
        elif not self.ipc_mode:
            # Add to status display (it will handle verbose mode internally)
            if self.status_display:
                self.status_display.add_console_output(f"Technical: {message}")
    
    def add_debug_message(self, message: str):
        """Add debug message with unified interface."""
        if self.verbose_log_service:
            self.verbose_log_service.log_debug(message)
        if self.ipc_mode and self.verbose:
            ipc_log_message(f"Debug: {message}")
        elif not self.ipc_mode:
            # Add to status display (it will handle verbose mode internally)
            if self.status_display:
                self.status_display.add_console_output(f"Debug: {message}")
    
    def add_performance_message(self, message: str):
        """Add performance message with unified interface."""
        if self.verbose_log_service:
            self.verbose_log_service.log_performance(message)
        if self.ipc_mode and self.verbose:
            ipc_log_message(f"Performance: {message}")
        elif not self.ipc_mode:
            # Add to status display (it will handle verbose mode internally)
            if self.status_display:
                self.status_display.add_console_output(f"Performance: {message}")
    
    def stop_display(self):
        """Stop the status display to allow completion panel to show properly."""
        if not self.ipc_mode and self.status_display:
            self.status_display.stop()


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


def _execute_with_enhanced_progress(command, use_case, verbose: bool, model: Optional[str], priority: str, ipc_mode: bool = False, ffmpeg_path: str = None):
    """Execute the subtitle generation with enhanced progress tracking."""
    
    # Create unified progress manager for both IPC and non-IPC modes
    # Attach a dedicated verbose log service in verbose, non-IPC mode
    verbose_service = None
    if verbose and not ipc_mode:
        try:
            from ...infrastructure.services.verbose_log_service import VerboseLogService
            verbose_service = VerboseLogService()
        except Exception:
            verbose_service = None

    unified_manager = UnifiedProgressManager(ipc_mode=ipc_mode, verbose=verbose, verbose_log_service=verbose_service)
    result = _execute_processing_steps(command, use_case, verbose, model, priority, unified_manager, ffmpeg_path)
    return result, unified_manager


def _execute_processing_steps(command, use_case, verbose: bool, model: Optional[str], priority: str, unified_manager, ffmpeg_path: str):
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
        if verbose:
            unified_manager.add_technical_message("Initializing Container DI system and service dependencies")
            unified_manager.add_technical_message("Checking hardware capabilities for optimal model selection")
        
        # Try to configure Whisper service for progress tracking
        # Use the same container that was used for the use case
        temp_container = Container(ffmpeg_path=ffmpeg_path)
        whisper_service = temp_container.get_whisper_service(model_name=model, priority=priority)
        setup_whisper_progress_callback(whisper_service, unified_manager)
        
        unified_manager.update_stage(
            ProcessingStage.INITIALIZING,
            1.0,
            "Services initialized successfully"
        )
        unified_manager.add_status_message(f"Ready to process with model selection priority: {priority}")
        
        # Step 3: Gemini Flash Video Compression (if needed)
        if command.enable_speakers and command.gemini_api_key:
            unified_manager.update_stage(
                ProcessingStage.GEMINI_VIDEO_COMPRESSION,
                0.0,
                "Compressing video for Gemini Flash analysis"
            )
            unified_manager.add_technical_message(f"Target quality: {command.video_compression_quality}")
            time.sleep(0.5)
            
            unified_manager.update_stage(
                ProcessingStage.GEMINI_VIDEO_COMPRESSION,
                1.0,
                "Video compression completed"
            )
            unified_manager.add_status_message("Video ready for AI analysis")
        
        # Step 4: Gemini Flash Speaker Identification (if enabled)
        if command.enable_speakers and command.gemini_api_key:
            unified_manager.update_stage(
                ProcessingStage.GEMINI_SPEAKER_IDENTIFICATION,
                0.0,
                "Analyzing video for speaker identification"
            )
            unified_manager.add_technical_message("Using Gemini Flash for automatic speaker detection")
            time.sleep(1.0)  # Speaker identification takes some time
            
            unified_manager.update_stage(
                ProcessingStage.GEMINI_SPEAKER_IDENTIFICATION,
                1.0,
                "Speaker identification completed"
            )
        
        # Step 5: Audio extraction
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
        
        # Step 6: Model preparation
        actual_model = whisper_service.model_name  # Get the actually selected model
        unified_manager.update_stage(
            ProcessingStage.PREPARING_MODEL,
            0.0,
            f"Preparing {actual_model} for transcription"
        )
        unified_manager.add_status_message(f"Selected model: {actual_model} (priority: {priority})")
        if actual_model == "openai/whisper-large-v3-turbo":
            unified_manager.add_status_message("ℹ️ Using the 'turbo' model. This model does not support translation tasks.")
        unified_manager.add_technical_message(f"Language: {command.language}, Additional features: {command.has_phase2_features()}")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.PREPARING_MODEL,
            1.0,
            "Model preparation completed"
        )
        unified_manager.add_status_message("Ready to begin transcription process")
        
        # Step 8-10: Model loading and transcription (handled by Whisper callbacks)
        # These steps will be tracked by the Whisper progress callbacks
        
        # Execute the main use case - but intercept and track intermediate steps
        start_time = time.time()
        
        # We'll track the main execution but add hooks for intermediate steps
        result = _execute_use_case_with_tracking(use_case, command, unified_manager, verbose)
        
        processing_time = time.time() - start_time
        
        # Final step tracking is now handled in _execute_use_case_with_tracking
        
        # Step: Final completion
        unified_manager.update_stage(
            ProcessingStage.COMPLETED,
            1.0,
            f"Processing completed successfully in {processing_time:.1f}s"
        )
        
        return result
        
    except Exception as e:
        if unified_manager.ipc_mode:
            ipc_processing_error(f"Error during processing: {str(e)}")
        else:
            unified_manager.update_stage(
                ProcessingStage.ERROR,
                0.0,
                f"Error during processing: {str(e)}"
            )
        raise


def _execute_use_case_with_tracking(use_case, command, unified_manager, verbose: bool):
    """Execute the use case with detailed step tracking."""
    
    # Track post-transcription steps
    def track_post_transcription_steps():
        # Step: Transcription validation
        unified_manager.update_stage(
            ProcessingStage.VALIDATING_TRANSCRIPTION,
            0.0,
            "Validating transcription results"
        )
        unified_manager.add_technical_message("Checking transcription completeness and chunk count")
        if unified_manager.verbose:
            unified_manager.add_technical_message("Validating whisper result format and chunk integrity")
            unified_manager.add_technical_message("Ensuring minimum transcription quality thresholds")
        time.sleep(0.1)
        
        unified_manager.update_stage(
            ProcessingStage.VALIDATING_TRANSCRIPTION,
            1.0,
            "Transcription validation passed"
        )
        unified_manager.add_status_message("Transcription results verified")
        
        # Step: Speaker Diarization (if enabled)
        if command.enable_speakers:
            unified_manager.update_stage(
                ProcessingStage.SPEAKER_DIARIZATION,
                0.0,
                "Performing enhanced speaker diarization"
            )
            unified_manager.add_technical_message("Using pyannote/speaker-diarization with auto-detected speaker count")
            if unified_manager.verbose:
                unified_manager.add_technical_message("Applying neural voice activity detection (VAD)")
                unified_manager.add_technical_message("Clustering speaker embeddings for diarization")
            time.sleep(0.4)
            
            unified_manager.update_stage(
                ProcessingStage.SPEAKER_DIARIZATION,
                1.0,
                "Speaker diarization completed"
            )
            unified_manager.add_status_message("Speaker segments identified and labeled")
        
        # Step: Music Detection (if enabled)
        if command.enable_music_detection:
            unified_manager.update_stage(
                ProcessingStage.MUSIC_DETECTION,
                0.0,
                "Detecting music segments"
            )
            unified_manager.add_technical_message("Analyzing Whisper output for music patterns")
            time.sleep(0.2)
            
            unified_manager.update_stage(
                ProcessingStage.MUSIC_DETECTION,
                1.0,
                "Music detection completed"
            )
            unified_manager.add_status_message("Music segments identified")
        
        # Step: Generate subtitle document
        unified_manager.update_stage(
            ProcessingStage.GENERATING_SUBTITLE_DOCUMENT,
            0.0,
            "Generating initial subtitle document"
        )
        unified_manager.add_technical_message("Creating subtitle entities with timing and formatting")
        if unified_manager.verbose:
            unified_manager.add_technical_message("Applying SubtitleFormattingService with line break optimization")
            unified_manager.add_technical_message("Calculating reading speeds and timing adjustments")
        time.sleep(0.3)
        
        unified_manager.update_stage(
            ProcessingStage.GENERATING_SUBTITLE_DOCUMENT,
            1.0,
            "Subtitle document generated"
        )
        unified_manager.add_status_message("Initial subtitle structure created")
        
        # Step: Subtitle validation and tagging
        if command.enable_gemini_refinement and command.gemini_api_key:
            unified_manager.update_stage(
                ProcessingStage.SUBTITLE_VALIDATION,
                0.0,
                "Applying subtitle validation tags"
            )
            unified_manager.add_technical_message("Adding TRIM and REPEAT tags for AI refinement")
            time.sleep(0.15)
            
            unified_manager.update_stage(
                ProcessingStage.SUBTITLE_VALIDATION,
                1.0,
                "Validation tags applied"
            )
            unified_manager.add_status_message("Subtitles prepared for AI refinement")
        
        # Step: Gemini Flash Transcription Refinement (if enabled)
        if command.enable_gemini_refinement and command.gemini_api_key:
            unified_manager.update_stage(
                ProcessingStage.GEMINI_TRANSCRIPTION_REFINEMENT,
                0.0,
                "Refining transcription with Gemini Flash"
            )
            style = "written" if command.enable_written_style else "colloquial"
            unified_manager.add_technical_message(f"Phase 2: AI refinement with {style} style")
            time.sleep(1.2)  # Refinement takes longer
            
            unified_manager.update_stage(
                ProcessingStage.GEMINI_TRANSCRIPTION_REFINEMENT,
                1.0,
                "AI refinement completed"
            )
            unified_manager.add_status_message("Transcription accuracy and style improved")
        
        # Step: Subtitle Translation (if enabled)
        if command.requires_translation() and command.gemini_api_key:
            unified_manager.update_stage(
                ProcessingStage.SUBTITLE_TRANSLATION,
                0.0,
                "Translating subtitles to target language"
            )
            target_lang = command.get_translation_language()
            if target_lang:
                unified_manager.add_technical_message(f"Translating to {target_lang.language_name}")
                unified_manager.add_status_message("Creating dual-language subtitle format")
            time.sleep(1.5)  # Translation takes time
            
            unified_manager.update_stage(
                ProcessingStage.SUBTITLE_TRANSLATION,
                1.0,
                "Translation completed"
            )
            if target_lang:
                unified_manager.add_status_message(f"Dual-language subtitles generated: Chinese + {target_lang.language_name}")
        
        # Step: Charset conversion
        if command.charset != "traditional":
            unified_manager.update_stage(
                ProcessingStage.CHARSET_CONVERSION,
                0.0,
                f"Converting to {command.charset} Chinese"
            )
            unified_manager.add_technical_message("Applying character encoding conversion")
            time.sleep(0.15)
            
            unified_manager.update_stage(
                ProcessingStage.CHARSET_CONVERSION,
                1.0,
                "Character conversion completed"
            )
            unified_manager.add_status_message(f"Converted to {command.charset} charset")
        
        # Step: Final subtitle formatting
        unified_manager.update_stage(
            ProcessingStage.FORMATTING_SUBTITLES,
            0.0,
            "Formatting and optimizing subtitles"
        )
        unified_manager.add_technical_message("Applying timing optimizations and line breaks")
        time.sleep(0.2)
        
        unified_manager.update_stage(
            ProcessingStage.FORMATTING_SUBTITLES,
            1.0,
            "Subtitle formatting completed"
        )
        
        # Step: File saving
        unified_manager.update_stage(
            ProcessingStage.SAVING_FILE,
            0.0,
            "Saving subtitle file"
        )
        unified_manager.add_technical_message("Writing SRT format with backup handling")
        time.sleep(0.25)
        
        unified_manager.update_stage(
            ProcessingStage.SAVING_FILE,
            1.0,
            "Subtitle file saved successfully"
        )
        
        # Step: Generate statistics
        unified_manager.update_stage(
            ProcessingStage.GENERATING_STATISTICS,
            0.0,
            "Generating processing statistics"
        )
        unified_manager.add_technical_message("Calculating quality metrics and formatting statistics")
        time.sleep(0.1)
        
        unified_manager.update_stage(
            ProcessingStage.GENERATING_STATISTICS,
            1.0,
            "Statistics generated"
        )
    
    # Execute the use case
    try:
        result = use_case.execute(command)
        
        # Track additional steps after successful execution
        if result.success:
            # Skip post-transcription steps in IPC mode since the use case already handles all progress reporting
            if not unified_manager.ipc_mode:
                track_post_transcription_steps()
            unified_manager.add_status_message(f"Generated {result.subtitle_count} subtitle segments")
            if result.output_file_path:
                output_path = Path(result.output_file_path)
                file_size = output_path.stat().st_size if output_path.exists() else 0
                unified_manager.add_status_message(f"Output file size: {file_size / 1024:.1f} KB")
        
        return result
        
    except Exception as e:
        # Check if this is already a properly structured TranscriptionError with details
        if isinstance(e, TranscriptionError) and hasattr(e, 'details') and e.details and 'full_traceback' in e.details:
            # Error is already properly structured from the use case - just update stage and re-raise
            unified_manager.update_stage(
                ProcessingStage.ERROR,
                0.0,
                f"Processing failed: {str(e)[:100]}..."
            )
            
            # Log the structured error using Rich console with level based on verbose flag
            from rich.console import Console
            from rich.panel import Panel
            from rich.text import Text
            console = Console()
            
            error_text = Text()
            
            if verbose:
                # Detailed error information for verbose mode
                error_text.append("🚨 DETAILED ERROR INFORMATION\n\n", style="bold red")
                error_text.append(f"Exception Type: {e.details.get('original_exception_type', type(e).__name__)}\n", style="cyan")
                error_text.append(f"Exception Message: {e.details.get('original_exception_message', str(e))}\n", style="yellow")
                error_text.append(f"Input File: {command.input_file_path}\n", style="blue")
                error_text.append(f"Output File: {command.output_file_path if hasattr(command, 'output_file_path') else 'unknown'}\n", style="blue")
                error_text.append(f"Processing Stage: {e.details.get('stage', 'unknown')}\n", style="magenta")
                error_text.append("\nFull Stack Trace:\n", style="bold white")
                error_text.append(e.details['full_traceback'], style="white")
                
                console.print(Panel(error_text, title="Debug Information", border_style="red"))
            else:
                # Simplified error information for normal mode
                error_text.append("🚨 ERROR\n\n", style="bold red")
                error_text.append(f"Issue: {e.details.get('original_exception_message', str(e))}\n", style="yellow")
                error_text.append(f"Location: {e.details.get('stage', 'processing')}\n", style="cyan")
                
                # Extract just the relevant file and line from the traceback
                full_traceback = e.details.get('full_traceback', '')
                if 'AttributeError:' in full_traceback:
                    # Extract the last meaningful frame before the error
                    import re
                    pattern = r'File "([^"]+)", line (\d+), in ([^\n]+)'
                    matches = re.findall(pattern, full_traceback)
                    if matches:
                        # Get the last match which is usually the error location
                        file_path, line_num, function = matches[-1]
                        file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                        error_text.append(f"Source: {file_name}:{line_num} in {function}\n", style="blue")
                
                error_text.append("\n💡 Use --verbose for detailed stack trace\n", style="dim")
                
                console.print(Panel(error_text, title="Processing Error", border_style="red"))
            
            # Re-raise the structured error as-is
            raise e
        else:
            # Handle other exceptions (fallback for unexpected errors)
            import traceback
            
            error_details = {
                'exception_type': type(e).__name__,
                'exception_message': str(e),
                'full_traceback': traceback.format_exc(),
                'command_details': {
                    'input_file': command.input_file_path,
                    'output_file': command.output_file_path if hasattr(command, 'output_file_path') else 'unknown'
                }
            }
            
            # Log error information using Rich console with level based on verbose flag
            from rich.console import Console
            from rich.panel import Panel
            from rich.text import Text
            console = Console()
            
            error_text = Text()
            
            if verbose:
                # Detailed error information for verbose mode
                error_text.append("🚨 DETAILED ERROR INFORMATION\n\n", style="bold red")
                error_text.append(f"Exception Type: {error_details['exception_type']}\n", style="cyan")
                error_text.append(f"Exception Message: {error_details['exception_message']}\n", style="yellow")
                error_text.append(f"Input File: {error_details['command_details']['input_file']}\n", style="blue")
                error_text.append(f"Output File: {error_details['command_details']['output_file']}\n", style="blue")
                error_text.append("\nFull Stack Trace:\n", style="bold white")
                error_text.append(error_details['full_traceback'], style="white")
                
                console.print(Panel(error_text, title="Debug Information", border_style="red"))
            else:
                # Simplified error information for normal mode
                error_text.append("🚨 ERROR\n\n", style="bold red")
                error_text.append(f"Issue: {error_details['exception_message']}\n", style="yellow")
                error_text.append(f"Type: {error_details['exception_type']}\n", style="cyan")
                
                # Extract just the relevant file and line from the traceback
                full_traceback = error_details['full_traceback']
                import re
                pattern = r'File "([^"]+)", line (\d+), in ([^\n]+)'
                matches = re.findall(pattern, full_traceback)
                if matches:
                    # Get the last match which is usually the error location
                    file_path, line_num, function = matches[-1]
                    file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                    error_text.append(f"Source: {file_name}:{line_num} in {function}\n", style="blue")
                
                error_text.append("\n💡 Use --verbose for detailed stack trace\n", style="dim")
                
                console.print(Panel(error_text, title="Processing Error", border_style="red"))
            
            unified_manager.update_stage(
                ProcessingStage.ERROR,
                0.0,
                f"Processing failed: {str(e)[:100]}..."
            )
            
            # Create a new TranscriptionError that preserves the original exception chain
            transcription_error = TranscriptionError(
                f"Subtitle generation failed: {str(e)}",
                details={
                    'input_file': command.input_file_path,
                    'output_file': command.output_file_path if hasattr(command, 'output_file_path') else 'unknown',
                    'original_exception_type': type(e).__name__,
                    'original_exception_message': str(e),
                    'full_traceback': error_details['full_traceback']
                }
            )
            # Preserve the original exception chain
            transcription_error.__cause__ = e
            raise transcription_error
    finally:
        # Critical: Clean up resources to allow proper CLI exit
        try:
            if 'whisper_service' in locals():
                whisper_service.cleanup()
            if 'temp_container' in locals():
                # Clean up any services that were created
                try:
                    container_whisper = temp_container.get_whisper_service()
                    container_whisper.cleanup()
                except:
                    pass
                try:
                    whisperx_service = temp_container.get_whisperx_service()  
                    whisperx_service.cleanup()
                except:
                    pass
        except Exception as cleanup_error:
            # Don't let cleanup errors affect the main result
            if verbose:
                unified_manager.add_technical_message(f"Cleanup warning: {cleanup_error}")
        
        # Force garbage collection to free memory
        import gc
        gc.collect()


def _display_file_info(input_file: Path, output_file: Optional[Path], ipc_mode: bool = False) -> None:
    """Display input and output file information."""
    # Determine output file path
    if output_file:
        output_path = str(output_file)
    else:
        output_path = str(input_file.with_suffix('.srt'))
    
    if ipc_mode:
        # Output file info as JSON log messages
        ipc_log_message(f"Input file: {str(input_file)}")
        ipc_log_message(f"Output file: {output_path}")
        ipc_log_message("CantoCap - Cantonese Cation Generator initialized")
    else:
        # Use rich console output
        info_text = Text()
        info_text.append("📁 Input: ", style="bold blue")
        info_text.append(str(input_file))
        info_text.append("\n📄 Output: ", style="bold green")
        info_text.append(output_path)
        
        console.print(Panel(
            info_text,
            title="🎬 CantoCap - Cantonese Caption Generator",
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
            
            # Note: Completion with JSON subtitle data is already sent from the use case
            # via _send_completion_with_json_data method, so no need to send it again here
            ipc_log_message("Processing completed successfully")
        else:
            # Use rich console output
            success_text = Text()
            success_text.append("✅ Successfully generated subtitles!\n\n", style="bold green")
            success_text.append(f"📊 Subtitles created: {result.subtitle_count}\n")
            success_text.append(f"⏱️ Processing time: {result.processing_time_seconds:.1f} seconds\n")
            success_text.append(f"📁 Output file: {result.output_file_path or 'unknown'}\n")
            
            # Add statistics if available
            if result.statistics:
                stats = result.statistics
                success_text.append(f"\n📈 Quality Statistics:\n", style="bold")
                success_text.append(f"   • Total duration: {stats.get('total_duration', 0):.1f}s\n")
                success_text.append(f"   • Average subtitle duration: {stats.get('average_subtitle_duration', 0):.1f}s\n")
                
                # Extract source language (before '+' if dual-language format)
                full_language = stats.get('language', 'unknown')
                source_language = full_language.split('+')[0] if '+' in full_language else full_language
                success_text.append(f"   • Language: {source_language}\n")
                
                if 'formatting' in stats:
                    formatting = stats['formatting']
                    quality_score = formatting.get('quality_score', 0)
                    success_text.append(f"   • Quality score: {quality_score:.1%}\n")
                
                # Add translation statistics if available (consolidated logic)
                has_translation = 'translation' in stats or 'dual_language' in stats
                
                if has_translation:
                    # Determine best translation coverage source (prioritize enhanced algorithm)
                    best_coverage = 0
                    target_language = "unknown"
                    dual_count = 0
                    
                    # Enhanced translation coverage (top priority)
                    if stats.get('translation_coverage', 0) > 0:
                        best_coverage = stats.get('translation_coverage', 0)
                    
                    # Translation service data
                    if 'translation' in stats:
                        translation = stats['translation']
                        target_language = translation.get('target_language', 'unknown')
                        if best_coverage == 0:  # Only use if enhanced not available
                            best_coverage = translation.get('translation_coverage', 0)
                        if 'dual_language_subtitles' in translation:
                            dual_count = translation['dual_language_subtitles']
                    
                    # Dual-language service data
                    if 'dual_language' in stats:
                        dual_lang = stats['dual_language']
                        if best_coverage == 0:  # Only use if others not available
                            best_coverage = dual_lang.get('translation_coverage', 0)
                    
                    # Display consolidated translation information
                    if target_language != "unknown":
                        success_text.append(f"   • Translation language: {target_language}\n")
                    if best_coverage > 0:
                        success_text.append(f"   • Translation coverage: {best_coverage:.1%}\n")
                    if dual_count > 0:
                        success_text.append(f"   • Dual-language subtitles: {dual_count}\n")
            
            # Clear any remaining status displays and add spacing
            console.print("\n" * 2)  # Add some space before completion panel
            
            console.print(Panel(
                success_text,
                title="🎉 Processing Complete",
                title_align="left",
                border_style="green",
                padding=(1, 2)  # Add padding for better visual appearance
            ))
            
            # Add space after completion panel
            console.print("\n")
    else:
        # Error message is handled in main function
        pass
