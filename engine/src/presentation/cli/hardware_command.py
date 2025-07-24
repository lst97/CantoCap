"""Hardware capabilities and model recommendation command."""

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ...infrastructure.services.hardware_detector import HardwareDetector, ModelSize
from ...infrastructure.validation import ArgumentValidator, ValidationSeverity

console = Console()


def hardware_command(
    priority: str = typer.Option(
        "balanced",
        "--priority",
        "-p", 
        help="Model selection priority: 'speed', 'quality', or 'balanced'"
    ),
    audio_duration: float = typer.Option(
        10.0,
        "--duration",
        "-d",
        help="Expected audio duration in minutes for estimation"
    )
) -> None:
    """
    Show hardware capabilities and Whisper model recommendations.
    
    This command analyzes your system's hardware and provides recommendations
    for the optimal Whisper model based on available VRAM, CPU, and performance priorities.
    """
    try:
        # Validate arguments
        args_to_validate = {
            'priority': priority,
            'audio_duration': audio_duration
        }
        
        # Validate priority
        priority_result = ArgumentValidator.validate_enum_value(
            priority,
            ['speed', 'quality', 'balanced'],
            field_name='priority'
        )
        
        # Validate audio duration
        duration_result = ArgumentValidator.validate_numeric_range(
            audio_duration,
            min_value=0.1,
            max_value=600.0,  # 10 hours max
            field_name='audio_duration'
        )
        
        # Check for validation errors
        validation_issues = priority_result.issues + duration_result.issues
        
        if validation_issues:
            errors = [issue for issue in validation_issues if issue.severity == ValidationSeverity.ERROR]
            warnings = [issue for issue in validation_issues if issue.severity == ValidationSeverity.WARNING]
            
            # Show errors
            if errors:
                console.print("\n[red]Validation Errors:[/red]")
                for issue in errors:
                    console.print(f"  • {issue.field}: {issue.message}")
                    if issue.suggestion:
                        console.print(f"    [yellow]→ {issue.suggestion}[/yellow]")
            
            # Show warnings
            if warnings:
                console.print("\n[yellow]Warnings:[/yellow]")
                for issue in warnings:
                    console.print(f"  • {issue.field}: {issue.message}")
            
            # Exit if there are errors
            if errors:
                raise typer.Exit(1)
        
        # Use sanitized values
        priority = priority_result.sanitized_value or priority
        audio_duration = duration_result.sanitized_value or audio_duration
        
        detector = HardwareDetector()
        
        # Get hardware profile
        hardware = detector.detect_hardware()
        
        # Get model recommendation
        recommended_model, details = detector.recommend_model(priority, audio_duration)
        
        # Display hardware information
        _display_hardware_info(hardware)
        
        # Display model recommendation
        _display_model_recommendation(recommended_model, details, priority)
        
        # Display model comparison table
        _display_model_comparison(detector, hardware, priority, audio_duration)
        
        # Display performance tips
        _display_performance_tips(details)
        
    except Exception as e:
        console.print(f"[red]Error analyzing hardware: {e}[/red]")
        raise typer.Exit(1)


def _display_hardware_info(hardware) -> None:
    """Display detected hardware information."""
    # Create hardware info table
    hardware_table = Table(title="🖥️ Detected Hardware", show_header=True, header_style="bold blue")
    hardware_table.add_column("Component", style="cyan", width=15)
    hardware_table.add_column("Details", style="white")
    
    # Add hardware rows
    hardware_table.add_row("Device", f"{hardware.device_name} ({hardware.device_type.upper()})")
    hardware_table.add_row("VRAM/Memory", f"{hardware.vram_gb:.1f} GB")
    hardware_table.add_row("System RAM", f"{hardware.ram_gb:.1f} GB")
    hardware_table.add_row("CPU Cores", str(hardware.cpu_cores))
    hardware_table.add_row("CPU Frequency", f"{hardware.cpu_frequency_ghz:.1f} GHz")
    hardware_table.add_row("Platform", hardware.platform_name)
    
    # Performance scores
    gpu_score_color = "green" if hardware.gpu_performance_score >= 0.7 else "yellow" if hardware.gpu_performance_score >= 0.4 else "red"
    cpu_score_color = "green" if hardware.cpu_performance_score >= 0.7 else "yellow" if hardware.cpu_performance_score >= 0.4 else "red"
    overall_color = "green" if hardware.overall_performance_score >= 0.7 else "yellow" if hardware.overall_performance_score >= 0.4 else "red"
    
    hardware_table.add_row("GPU Score", f"[{gpu_score_color}]{hardware.gpu_performance_score:.2f}[/{gpu_score_color}]")
    hardware_table.add_row("CPU Score", f"[{cpu_score_color}]{hardware.cpu_performance_score:.2f}[/{cpu_score_color}]")
    hardware_table.add_row("Overall Score", f"[{overall_color}]{hardware.overall_performance_score:.2f}[/{overall_color}]")
    
    console.print(hardware_table)


def _display_model_recommendation(recommended_model, details, priority) -> None:
    """Display the recommended model and reasoning."""
    model_info = details['model_info']
    
    # Create recommendation panel
    rec_text = Text()
    rec_text.append("🤖 Recommended Model: ", style="bold blue")
    rec_text.append(f"{recommended_model.value}\n\n", style="bold green")
    
    rec_text.append("📊 Reason: ", style="bold blue")
    rec_text.append(f"{details['reason']}\n\n", style="white")
    
    rec_text.append("📈 Model Statistics:\n", style="bold blue")
    rec_text.append(f"  • Quality Score: {model_info['quality_score']:.1%}\n", style="white")
    rec_text.append(f"  • Speed Multiplier: {model_info['speed_multiplier']:.1f}x\n", style="white")
    rec_text.append(f"  • VRAM Usage: {model_info['vram_usage_gb']:.1f} GB\n", style="white")
    rec_text.append(f"  • RAM Usage: {model_info['ram_usage_gb']:.1f} GB\n", style="white")
    
    if details.get('estimated_processing_time_minutes'):
        rec_text.append(f"\n⏱️ Estimated Speed: {details['estimated_processing_time_minutes']:.1f} min per audio minute", style="yellow")
    
    console.print(Panel(
        rec_text,
        title=f"🎯 Model Recommendation (Priority: {priority.title()})",
        title_align="left",
        border_style="green"
    ))


def _display_model_comparison(detector, hardware, priority, audio_duration) -> None:
    """Display comparison table of all compatible models."""
    # Get all models and their compatibility
    compatible_models = detector._get_compatible_models(hardware)
    
    if not compatible_models:
        console.print("[red]⚠️ No models are compatible with your hardware configuration[/red]")
        return
    
    # Create comparison table
    comparison_table = Table(title="📊 Model Comparison", show_header=True, header_style="bold blue")
    comparison_table.add_column("Model", style="cyan", width=20)
    comparison_table.add_column("Quality", justify="center", width=8)
    comparison_table.add_column("Speed", justify="center", width=8)
    comparison_table.add_column("VRAM", justify="center", width=8)
    comparison_table.add_column("RAM", justify="center", width=8)
    comparison_table.add_column("Est. Time", justify="center", width=10)
    comparison_table.add_column("Compatible", justify="center", width=10)
    
    # Get recommended model for highlighting
    recommended_model, _ = detector.recommend_model(priority, audio_duration)
    
    # Add rows for each model
    for model in ModelSize:
        requirements = detector.MODEL_REQUIREMENTS[model]
        is_compatible = model in compatible_models
        is_recommended = model == recommended_model
        
        # Style based on recommendation and compatibility
        if is_recommended:
            model_style = "bold green"
            compatible_icon = "✅ Recommended"
        elif is_compatible:
            model_style = "white"
            compatible_icon = "✅ Yes"
        else:
            model_style = "dim"
            compatible_icon = "❌ No"
        
        # Estimate processing time
        if is_compatible and audio_duration > 0:
            base_multiplier = 1.0 / requirements.estimated_speed_multiplier
            if hardware.device_type == "cuda":
                device_multiplier = 0.3
            elif hardware.device_type == "mps":
                device_multiplier = 0.5
            else:
                device_multiplier = 2.0
            est_time = audio_duration * base_multiplier * device_multiplier
            time_str = f"{est_time:.1f}min"
        else:
            time_str = "N/A"
        
        # Simplify model names for display
        model_display_name = model.value.split('/')[-1]
        if model_display_name == "whisper-large-v2":
            model_display_name = "large-v2"
        elif model_display_name == "whisper-large-v3":
            model_display_name = "large-v3"
        elif model_display_name == "whisper-large-v3-turbo":
            model_display_name = "turbo"
        elif model.value == "whisperx/large-v3":
            model_display_name = "whisperX/large-v3"
        elif model_display_name.startswith("whisper-"):
            model_display_name = model_display_name.replace("whisper-", "")
        
        comparison_table.add_row(
            f"[{model_style}]{model_display_name}[/{model_style}]",
            f"[{model_style}]{requirements.quality_score:.1%}[/{model_style}]",
            f"[{model_style}]{requirements.estimated_speed_multiplier:.1f}x[/{model_style}]",
            f"[{model_style}]{requirements.min_vram_gb:.1f}GB[/{model_style}]",
            f"[{model_style}]{requirements.min_ram_gb:.1f}GB[/{model_style}]",
            f"[{model_style}]{time_str}[/{model_style}]",
            compatible_icon
        )
    
    console.print(comparison_table)


def _display_performance_tips(details) -> None:
    """Display performance optimization tips."""
    tips = details.get('performance_tips', [])
    
    if not tips:
        return
    
    tips_text = Text()
    tips_text.append("💡 Performance Tips:\n\n", style="bold yellow")
    
    for i, tip in enumerate(tips, 1):
        tips_text.append(f"  {i}. {tip}\n", style="white")
    
    console.print(Panel(
        tips_text,
        title="🚀 Optimization Suggestions",
        title_align="left",
        border_style="yellow"
    ))