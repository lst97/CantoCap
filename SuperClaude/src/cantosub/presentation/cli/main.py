"""Main CLI application for CantoSub."""

import typer
from typing import Optional
from pathlib import Path

from .commands import generate_command

# Create the main Typer application
app = typer.Typer(
    name="cantosub",
    help="CantoSub - Generate Cantonese subtitles from audio/video files",
    add_completion=False,
    rich_markup_mode="rich"
)

# Add the generate command as the default command
app.command(name="generate")(generate_command)

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
    ),
    version: bool = typer.Option(
        False,
        "--version",
        "-v",
        help="Show version information"
    )
) -> None:
    """
    CantoSub - Generate Cantonese subtitles from audio/video files.
    
    This tool extracts audio from video/audio files and generates accurate
    Cantonese subtitles using OpenAI Whisper speech recognition.
    
    Phase 2 features include speaker diarization, music detection, 
    LLM-based style conversion, and character set conversion.
    
    Examples:
    
        # Basic usage
        cantosub video.mp4
        
        # Specify output file
        cantosub video.mp4 --output subtitles.srt
        
        # Enable speaker identification
        cantosub interview.mp4 --speakers
        
        # Convert to written style with simplified characters
        cantosub podcast.wav --written --charset simplified
        
        # Full Phase 2 features
        cantosub movie.mkv --speakers --written --music --charset traditional
        
        # Use different Whisper model
        cantosub video.mkv --model openai/whisper-medium
    """
    if version:
        from ... import __version__
        typer.echo(f"CantoSub version {__version__}")
        return
    
    # If no subcommand and no input file, show help
    if ctx.invoked_subcommand is None:
        if input_file is None:
            typer.echo(ctx.get_help())
            return
        
        # Validate input file exists
        if not input_file.exists():
            typer.echo(f"Error: Input file does not exist: {input_file}")
            raise typer.Exit(code=1)
        
        if not input_file.is_file():
            typer.echo(f"Error: Input path is not a file: {input_file}")
            raise typer.Exit(code=1)
        
        # Call generate command directly
        generate_command(
            input_file=input_file,
            output_file=output_file,
            language=language,
            model=model,
            speakers=speakers,
            written=written,
            music=music,
            charset=charset
        )


if __name__ == "__main__":
    app()