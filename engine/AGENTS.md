# Repository Guidelines

## Project Structure & Module Organization

- src/: Application code using clean architecture.
  - presentation/: CLI entry (`presentation/cli/main.py`).
  - application/: Use cases and commands.
  - domain/: Entities, value objects, repositories, services.
  - infrastructure/: Adapters (FFmpeg, Whisper/WhisperX, Gemini, storage, validation).
- tests/: Unit, integration, and e2e tests with sample media.
- logs/, htmlcov/: Runtime and coverage artifacts (ignored in CI).

## Build, Test, and Development Commands

- `make install`: Install production deps from `requirements.txt`.
- `make install-local`: Editable install for local dev.
- `make test`: Run all tests with coverage.
- `make test-unit` | `make test-integration` | `make test-e2e`: Scoped suites.
- `make lint` | `make typecheck` | `make format`: flake8, mypy, black+isort.
- `make build`: Build distribution packages.
- Run CLI locally: `python -m src input.mp4 --ffmpeg-path /usr/bin/ffmpeg`.

## Coding Style & Naming Conventions

- Python 3.9–3.12; Black line length 88; isort profile “black”.
- Mypy strict mode enabled; prefer typed defs and explicit returns.
- Modules/functions: snake_case; classes: PascalCase; constants: UPPER_SNAKE.
- Keep layers pure: domain has no framework deps; presentation wires CLI only.

## Testing Guidelines

- Pytest with markers: `unit`, `integration`, `e2e`, `slow`, `requires_*`.
- Coverage: threshold 80%, HTML report in `htmlcov/`.
- Name tests `tests/**/test_*.py`; keep unit tests fast and isolated.
- Examples:
  - Run integration: `pytest -m integration`.
  - Focus a file: `pytest tests/unit/presentation/test_cli_commands.py -q`.

## Commit & Pull Request Guidelines

- Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:` …).
- PRs must include: purpose/summary, linked issues, key screenshots/logs when relevant (CLI output), and test plan.
- Before opening PR: `make format && make quality && make test` must pass.

## Security & Configuration Tips

- Do not commit secrets. Use `.env` for `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc.
- FFmpeg is required; pass `--ffmpeg-path` or set a valid path per platform.
- Large-model/GPU paths vary; see `GPU_SETUP_GUIDE.md` if applicable.

## Architecture Overview

- Ports-and-adapters around domain logic; application coordinates use cases; infrastructure provides concrete services; presentation exposes a Typer-based CLI (`cantocap`). Keep dependencies flowing inward.
