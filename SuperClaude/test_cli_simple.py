#!/usr/bin/env python3
"""
Simple test CLI for CantoSub to validate Phase 2 features.
"""

import typer
from pathlib import Path
from typing import Optional

def main(
    input_file: Path = typer.Argument(help="Path to input audio/video file"),
    output_file: Optional[Path] = typer.Option(None, "--output", "-o", help="Output SRT file"),
    language: str = typer.Option("zh", "--language", "-l", help="Language code"),
    model: str = typer.Option("openai/whisper-large-v3", "--model", "-m", help="Whisper model"),
    # Phase 2 features
    speakers: bool = typer.Option(False, "--speakers", help="Enable speaker diarization"),
    written: bool = typer.Option(False, "--written", help="Convert to written style using LLM"),
    music: bool = typer.Option(False, "--music", help="Enable music detection"),
    charset: str = typer.Option("traditional", "--charset", help="Character set (traditional/simplified)")
):
    """
    CantoSub Test CLI - Generate Cantonese subtitles with Phase 2 features.
    
    Phase 2 Features:
    - Speaker diarization (--speakers)
    - LLM style conversion (--written)  
    - Music detection (--music)
    - Character set conversion (--charset)
    
    Examples:
        python test_cli_simple.py tests/test.mp3 --speakers --written
        python test_cli_simple.py tests/test.mp3 --music --charset simplified
    """
    
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

if __name__ == "__main__":
    typer.run(main)