#!/usr/bin/env python3
"""
Test CLI for CantoSub to validate Phase 2 features without heavy dependencies.
"""

import typer
from pathlib import Path
from typing import Optional

app = typer.Typer(
    name="cantosub-test",
    help="CantoSub Test CLI - Validate Phase 2 features",
    add_completion=False,
    rich_markup_mode="rich"
)

@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    input_file: Optional[Path] = typer.Argument(
        None,
        help="Path to input audio/video file"
    ),
    output_file: Optional[Path] = typer.Option(
        None,
        "--output",
        "-o", 
        help="Output SRT file path"
    ),
    language: str = typer.Option(
        "zh",
        "--language",
        "-l",
        help="Language code for transcription"
    ),
    model: str = typer.Option(
        "openai/whisper-large-v3",
        "--model",
        "-m",
        help="Whisper model to use"
    ),
    # Phase 2 features
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable speaker diarization"
    ),
    written: bool = typer.Option(
        False,
        "--written", 
        help="Convert to written style using LLM"
    ),
    music: bool = typer.Option(
        False,
        "--music",
        help="Enable music detection"
    ),
    charset: str = typer.Option(
        "traditional",
        "--charset",
        help="Character set (traditional/simplified)"
    )
):
    """
    Generate Cantonese subtitles with Phase 2 features.
    
    This test validates the CLI structure and Phase 2 feature flags.
    
    Phase 2 Features:
    - Speaker diarization (--speakers)
    - LLM style conversion (--written)  
    - Music detection (--music)
    - Character set conversion (--charset)
    
    Examples:
        python test_cli.py video.mp4 --speakers --written
        python test_cli.py audio.wav --music --charset simplified
    """
    
    # If no input file, show help
    if input_file is None:
        typer.echo(ctx.get_help())
        return
    
    typer.echo("🎬 CantoSub Phase 2 Test CLI")
    typer.echo("=" * 40)
    
    typer.echo(f"📁 Input file: {input_file}")
    typer.echo(f"📝 Output file: {output_file or 'auto-generated'}")
    typer.echo(f"🌍 Language: {language}")
    typer.echo(f"🤖 Model: {model}")
    
    typer.echo("\n🚀 Phase 2 Features:")
    typer.echo(f"👥 Speaker diarization: {'✅ Enabled' if speakers else '❌ Disabled'}")
    typer.echo(f"✍️  Written style conversion: {'✅ Enabled' if written else '❌ Disabled'}")
    typer.echo(f"🎵 Music detection: {'✅ Enabled' if music else '❌ Disabled'}")
    typer.echo(f"📝 Character set: {charset}")
    
    if speakers or written or music:
        typer.echo("\n🎉 Phase 2 features detected! CLI structure is working correctly.")
    else:
        typer.echo("\n💡 Try adding Phase 2 flags: --speakers --written --music")
    
    typer.echo("\n✅ CLI validation successful!")
    
    return {
        "input_file": str(input_file),
        "phase2_features": {
            "speakers": speakers,
            "written": written, 
            "music": music,
            "charset": charset
        }
    }

if __name__ == "__main__":
    app()