"""Main CLI application for CantoCap."""

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
    name="cantocap",
    help="CantoCap - Generate Cantonese subtitles from audio/video files",
    add_completion=False,
    rich_markup_mode="rich"
)

# Add the hardware capabilities command
app.command(name="hardware")(hardware_command)

# Generate command is now the default action (no explicit registration needed)

# Main callback that handles both direct file processing and subcommands
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
        help="Language code for transcription alignment models (e.g., 'zh', 'ja', 'en')"
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        "-m",
        help="Whisper model to use (auto-selects optimal model if not specified). Use 'whisperX/large-v3' for WhisperX"
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
    
    disable_gemini_refinement: bool = typer.Option(
        False,
        "--no-gemini-refinement",
        help="Disable Gemini Flash transcription refinement"
    ),
    
    # Enhanced chunking options
    max_chunk_duration: int = typer.Option(
        15,
        "--max-chunk-duration",
        help="Maximum chunk duration in minutes for large files"
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
    
    ffmpeg_path: Optional[str] = typer.Option(
        None,
        "--ffmpeg-path",
        help="Full path to FFmpeg executable (required for subtitle generation, e.g., /usr/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe)"
    ),
    
    hf_token: Optional[str] = typer.Option(
        None,
        "--hf-token",
        help="Hugging Face token for accessing gated models"
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
    ),
    duration: float = typer.Option(
        10.0,
        "--duration",
        "-d",
        help="Expected audio duration in minutes for hardware estimation"
    )
) -> None:
    """
    CantoCap - Generate Cantonese subtitles with intelligent model selection.
    
    This tool automatically selects the optimal Whisper model based on your hardware
    capabilities and extracts audio from video/audio files to generate accurate
    Cantonese subtitles using OpenAI Whisper speech recognition.
    
    Examples:
    
        # Basic usage (auto-selects optimal model) - requires FFmpeg path
        cantocap video.mp4 --ffmpeg-path /usr/bin/ffmpeg
        
        # On Windows
        cantocap video.mp4 --ffmpeg-path "C:\\ffmpeg\\bin\\ffmpeg.exe"
        
        # Prioritize speed over quality
        cantocap video.mp4 --priority speed --ffmpeg-path /usr/bin/ffmpeg
        
        # Prioritize quality over speed  
        cantocap video.mp4 --priority quality --ffmpeg-path /usr/bin/ffmpeg
        
        # Override with specific model
        cantocap video.mp4 --model openai/whisper-medium --ffmpeg-path /usr/bin/ffmpeg
        
        # Use WhisperX with enhanced features
        cantocap video.mp4 --model whisperX/large-v3 --ffmpeg-path /usr/bin/ffmpeg
        
        # Check hardware capabilities
        cantocap hardware
        
        # Enhanced features with Gemini Flash
        cantocap movie.mkv --speakers --written --music --gemini-key YOUR_API_KEY --ffmpeg-path /usr/bin/ffmpeg
        
        # Custom terminology configuration
        cantocap video.mp4 --terminology-config my_terms.json --written --ffmpeg-path /usr/bin/ffmpeg
    """
    # Set global IPC mode for error handling
    from ...infrastructure.error_handling import set_global_ipc_mode
    set_global_ipc_mode(ipc_mode)
    
    if version:
        from ... import __version__
        console.print(f"""
[bold blue]CantoCap[/bold blue] version [green]{__version__}[/green]

[bold]Cantonese To Caption[/bold] 

To eliminate the time-consuming and tedious process of creating subtitles, allowing creators to focus on their content specially for Hong Kong and Cantonese community.
License: Free and open-source. Use your own API key. Paid services may be available in the future for users how want more seamless experience.

整字幕嘥時間又麻煩, 純粹想 YouTuber 可以專心搞好啲片, 特別為香港同講廣東話嘅朋友整。
授權: 費用全免, 而且係開源嘅。用返你自己條 API Key 就得。將來可能會出收費服務, 畀啲手殘想撳個掣就用到嘅朋友仔。

[bold]Author:[/bold] lst97 - SIO TOU (Nelson) LAI
[bold]Website:[/bold] https://www.lst97.dev
[bold]LinkedIn:[/bold] https://www.linkedin.com/in/lst97
[bold]Email:[/bold] contact@lst97.dev
[bold]Feedback:[/bold] https://github.com/lst97/canto-cap
""")
        return
    
    # Handle translation help request
    if translation_help:
        from .commands import show_translation_help
        show_translation_help()
        return
    
    # Check if we're in a subcommand context
    if ctx.invoked_subcommand is not None:
        return
    
    # Check if the input_file is actually a command name that should be handled as a subcommand
    if input_file is not None and str(input_file) == 'hardware':
        # This means the user typed 'hardware' but it was parsed as input_file
        # Manually invoke the hardware command with available options
        from .hardware_command import hardware_command
        
        # Use the priority and duration options if they were provided
        hardware_command(priority=priority, audio_duration=duration)
        
        # Note: If users want to use hardware-specific options like --duration,
        # they should use: cantocap --duration 30 --priority speed hardware
        return
    
    # If no input file provided, show help
    if input_file is None:
        console.print(ctx.get_help())
        return
    
    # Validate FFmpeg path is provided for file processing
    if ffmpeg_path is None:
        console.print("[red]Error:[/red] --ffmpeg-path is required for subtitle generation")
        console.print("Provide the full path to FFmpeg executable (e.g., /usr/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe)")
        raise typer.Exit(1)
        
    # Call generate command directly
    generate_command(
        input_file=input_file,
        output_file=output_file,
        language=language,
        model=model,
        priority=priority,
        speakers=speakers,
        written=written,
        music=music,
        charset=charset,
        gemini_api_key=gemini_api_key,
        disable_gemini_refinement=disable_gemini_refinement,
        max_chunk_duration=max_chunk_duration,
        video_quality=video_quality,
        terminology_config=terminology_config,
        ffmpeg_path=ffmpeg_path,
        hf_token=hf_token,
        verbose=verbose,
        ipc_mode=ipc_mode,
        subtitle=subtitle,
        translation_help=translation_help
    )


if __name__ == "__main__":
    app()