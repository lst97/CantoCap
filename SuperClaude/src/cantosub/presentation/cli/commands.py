"""CLI commands for CantoSub."""

from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.text import Text
import time

from ...application import GenerateSubtitlesCommand, GenerateSubtitlesUseCase
from ..di.container import Container

console = Console()


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
    model: str = typer.Option(
        "openai/whisper-large-v3",
        "--model",
        "-m",
        help="Whisper model to use for transcription"
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
    )
) -> None:
    """
    Generate Cantonese subtitles from audio/video files.
    
    This command extracts audio from the input file, transcribes it using
    OpenAI Whisper, and generates an SRT subtitle file with proper timing.
    """
    try:
        # Initialize container and get use case
        container = Container()
        use_case = container.get_generate_subtitles_use_case()
        
        # Create command with Phase 2 features
        command = GenerateSubtitlesCommand(
            input_file_path=str(input_file),
            output_file_path=str(output_file) if output_file else None,
            language=language,
            model_name=model,
            enable_speakers=speakers,
            enable_written_style=written,
            enable_music_detection=music,
            charset=charset
        )
        
        # Display file information
        _display_file_info(input_file, command.get_effective_output_path().path)
        
        # Execute with progress tracking
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=False
        ) as progress:
            
            # Add main task
            main_task = progress.add_task("🎬 Processing media file...", total=100)
            
            # Show initial validation
            progress.update(main_task, description="📋 Validating input file...", completed=10)
            time.sleep(0.5)  # Brief pause for user to see status
            
            # Show audio extraction
            progress.update(main_task, description="🎵 Extracting audio...", completed=25)
            
            # Show model loading
            progress.update(main_task, description="🧠 Loading Whisper model...", completed=40)
            
            # Show transcription (this will take the longest)
            progress.update(main_task, description="🗣️ Transcribing audio...", completed=50)
            
            # Execute the use case
            result = use_case.execute(command)
            
            # Show subtitle generation
            progress.update(main_task, description="📝 Generating subtitles...", completed=85)
            
            # Show file saving
            progress.update(main_task, description="💾 Saving SRT file...", completed=95)
            
            # Complete
            progress.update(main_task, description="✅ Processing complete!", completed=100)
        
        # Display results
        _display_results(result)
        
        # Handle errors
        if not result.success:
            console.print(f"\n❌ [red]Error:[/red] {result.error_message}")
            raise typer.Exit(code=1)
        
    except Exception as e:
        console.print(f"\n❌ [red]Unexpected error:[/red] {str(e)}")
        raise typer.Exit(code=1)


def _display_file_info(input_file: Path, output_file: str) -> None:
    """Display input and output file information."""
    info_text = Text()
    info_text.append("📁 Input: ", style="bold blue")
    info_text.append(str(input_file))
    info_text.append("\n📄 Output: ", style="bold green")
    info_text.append(output_file)
    
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