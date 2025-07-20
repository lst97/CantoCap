"""Main CLI application for CantoSub."""

import typer
from typing import Optional
from pathlib import Path
from rich.console import Console

from .commands import generate_command
from .hardware_command import hardware_command
from ...infrastructure.error_handling import validate_file_path, ValidationError, handle_error

console = Console()

# Create the main Typer application
app = typer.Typer(
    name="cantosub",
    help="CantoSub - Generate Cantonese subtitles from audio/video files",
    add_completion=False,
    rich_markup_mode="rich"
)

# Add the generate command as the default command
app.command(name="generate")(generate_command)

# Add the hardware capabilities command
app.command(name="hardware")(hardware_command)

# Also make it available without the "generate" subcommand for convenience
@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    input_file: Optional[Path] = typer.Argument(
        None,
        help="Path to input audio/video file",
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
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version information"
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
    CantoSub - Generate Cantonese subtitles with intelligent model selection.
    
    This tool automatically selects the optimal Whisper model based on your hardware
    capabilities and extracts audio from video/audio files to generate accurate
    Cantonese subtitles using OpenAI Whisper speech recognition.
    
    Examples:
    
        # Basic usage (auto-selects optimal model)
        cantosub video.mp4
        
        # Prioritize speed over quality
        cantosub video.mp4 --priority speed
        
        # Prioritize quality over speed  
        cantosub video.mp4 --priority quality
        
        # Override with specific model
        cantosub video.mp4 --model openai/whisper-medium
        
        # Check hardware capabilities
        cantosub hardware
        
        # Phase 2 features
        cantosub movie.mkv --speakers --written --music
    """
    # Set global IPC mode for error handling
    from ...infrastructure.error_handling import set_global_ipc_mode
    set_global_ipc_mode(ipc_mode)
    
    if version:
        from ... import __version__
        console.print(f"[bold blue]CantoSub[/bold blue] version [green]{__version__}[/green]")
        return
    
    # If no subcommand and no input file, show help
    if ctx.invoked_subcommand is None:
        if input_file is None:
            console.print(ctx.get_help())
            return
        
        # Validate input file with enhanced error handling
        try:
            validated_input = validate_file_path(
                input_file, 
                must_exist=True, 
                must_be_file=True, 
                readable=True
            )
        except ValidationError as e:
            handle_error(e, context="Input file validation", exit_code=1, ipc_mode=ipc_mode)
        
        # Call generate command directly
        generate_command(
            input_file=validated_input,
            output_file=output_file,
            language=language,
            model=model,
            priority=priority,
            speakers=speakers,
            written=written,
            music=music,
            charset=charset,
            verbose=verbose,
            ipc_mode=ipc_mode
        )


if __name__ == "__main__":
    app()