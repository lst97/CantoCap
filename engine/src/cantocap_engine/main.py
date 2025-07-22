"""Entry point for CantoCap Engine CLI."""

import sys
import os
import typer
from typing import Optional
from pathlib import Path
from rich.console import Console

# Add the src directory to Python path so we can import from the package structure
src_path = os.path.join(os.path.dirname(os.path.dirname(__file__)))
if src_path not in sys.path:
    sys.path.insert(0, src_path)

console = Console()

# Import all required modules after setting up the path
from application import GenerateSubtitlesCommand
from domain.value_objects import LanguageCode
from presentation.di.container import Container
from infrastructure.error_handling import validate_file_path, ValidationError, handle_error
from infrastructure.services.hardware_detector import HardwareDetector

# Create the main Typer application
app = typer.Typer(
    name="cantocap-engine",
    help="Generate accurate Cantonese subtitles from audio/video files using OpenAI Whisper",
    add_completion=False,
    no_args_is_help=True,
)

@app.command()
def generate(
    input_file: Path = typer.Argument(..., help="Path to the input audio/video file"),
    output_file: Optional[Path] = typer.Option(None, "--output", "-o", help="Output SRT file path (default: input_file.srt)"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="Whisper model to use"),
    language: str = typer.Option("zh", "--language", "-l", help="Language code for transcription"),
    priority: str = typer.Option("balanced", "--priority", "-p", help="Optimization priority"),
    device: Optional[str] = typer.Option(None, "--device", "-d", help="Device to use (auto, cpu, cuda, mps)"),
    speaker_diarization: bool = typer.Option(False, "--speaker-diarization", "-s", help="Enable speaker diarization"),
    music_detection: bool = typer.Option(False, "--music-detection", help="Enable music detection and processing"),
    style_conversion: bool = typer.Option(False, "--style-conversion", help="Enable LLM-based style conversion"),
    dual_language: bool = typer.Option(False, "--dual-language", help="Generate dual-language subtitles"),
    target_language: str = typer.Option("en", "--target-language", help="Target language for translation"),
    charset: str = typer.Option("utf-8", "--charset", help="Output character encoding"),
    ipc_mode: bool = typer.Option(False, "--ipc-mode", help="Enable IPC mode for machine-readable output"),
    gemini_api_key: Optional[str] = typer.Option(None, "--gemini-api-key", help="Google Gemini API key"),
    openai_api_key: Optional[str] = typer.Option(None, "--openai-api-key", help="OpenAI API key"),
    hf_token: Optional[str] = typer.Option(None, "--hf-token", help="Hugging Face token for gated models"),
):
    """Generate Cantonese subtitles from audio/video files."""
    try:
        # Validate input file
        validated_path = validate_file_path(input_file)
        
        # Initialize the container with IPC mode
        container = Container(ipc_mode=ipc_mode)
        
        # Create the command
        command = GenerateSubtitlesCommand(
            input_file=validated_path,
            output_file=output_file,
            model=model,
            language=LanguageCode(language),
            priority=priority,
            device=device,
            speaker_diarization=speaker_diarization,
            music_detection=music_detection,
            style_conversion=style_conversion,
            dual_language=dual_language,
            target_language=LanguageCode(target_language) if dual_language else None,
            charset=charset,
            gemini_api_key=gemini_api_key,
            openai_api_key=openai_api_key,
            hf_token=hf_token,
        )
        
        # Execute the use case
        use_case = container.get_generate_subtitles_use_case()
        use_case.execute(command)
        
    except ValidationError as e:
        handle_error(e, console, ipc_mode)
        raise typer.Exit(1)
    except Exception as e:
        handle_error(e, console, ipc_mode)
        raise typer.Exit(1)

@app.command()
def hardware(
    priority: str = typer.Option("balanced", "--priority", "-p", help="Optimization priority"),
    duration: Optional[float] = typer.Option(None, "--duration", "-d", help="Expected audio duration in minutes for timing estimates"),
):
    """Analyze hardware capabilities and provide model recommendations."""
    try:
        detector = HardwareDetector()
        detector.analyze_and_recommend(priority=priority, expected_duration_minutes=duration)
        
    except Exception as e:
        console.print(f"[red]Error analyzing hardware: {e}[/red]")
        raise typer.Exit(1)

def main():
    """Main entry point for the CLI application."""
    app()

if __name__ == "__main__":
    main()