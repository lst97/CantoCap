# CantoCap Project Overview

This document provides a comprehensive overview of the CantoCap project, its structure, and how to work with it.

## Project Overview

CantoCap is a command-line tool for generating accurate Cantonese subtitles from audio and video files. It leverages OpenAI's Whisper for speech-to-text transcription and Google's Gemini for AI-powered enhancements, such as speaker diarization and transcription refinement.

The project is written in Python and uses a clean architecture approach, separating the domain, application, and infrastructure layers.

### Key Technologies

* **CLI Framework:** Typer
* **Transcription:** OpenAI Whisper, WhisperX
* **AI Enhancements:** Google Gemini
* **Build System:** setuptools
* **Testing:** pytest
* **Code Quality:** black, isort, mypy, flake8

## Building and Running

The project uses a `Makefile` to simplify common development tasks.

### Installation

1. **Create a virtual environment:**

    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

2. **Install dependencies:**

    ```bash
    make install-dev
    ```

### Running the Application

To generate subtitles, use the `cantocap` command:

```bash
python -m src.presentation.cli.main <input_file> --ffmpeg-path <path_to_ffmpeg>
```

For a full list of options, run:

```bash
python -m src.presentation.cli.main --help
```

### Running Tests

The project has a comprehensive test suite. To run all tests, use:

```bash
make test
```

You can also run specific types of tests:

* `make test-unit`
* `make test-integration`
* `make test-e2e`

## Development Conventions

### Code Style

The project uses `black` for code formatting and `isort` for import sorting. To format the code, run:

```bash
make format
```

### Type Checking

The project uses `mypy` for static type checking. To run the type checker, use:

```bash
make typecheck
```

### Linting

The project uses `flake8` for linting. To run the linter, use:

```bash
make lint
```

### Commits

Commit messages should follow the Conventional Commits specification.

## Project Structure

The project follows a clean architecture pattern, with the code organized into the following layers:

* `src/domain`: Contains the core business logic and entities.
* `src/application`: Contains the application-specific business logic and use cases.
* `src/infrastructure`: Contains the implementations of external services, such as the database and APIs.
* `src/presentation`: Contains the user interface, in this case, the CLI.
* `tests`: Contains the unit, integration, and end-to-end tests.
