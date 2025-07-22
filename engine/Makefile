# Makefile for CantoCap development

.PHONY: install install-dev test test-unit test-integration test-e2e lint format typecheck clean build build-executable package-all help

# Default target
help:
	@echo "CantoCap Development Commands:"
	@echo ""
	@echo "Setup:"
	@echo "  install       Install production dependencies"
	@echo "  install-dev   Install development dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  test         Run all tests"
	@echo "  test-unit    Run unit tests only"
	@echo "  test-integration  Run integration tests only"
	@echo "  test-e2e     Run end-to-end tests only"
	@echo "  test-cov     Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint         Run linting (flake8)"
	@echo "  format       Format code (black + isort)"
	@echo "  typecheck    Run type checking (mypy)"
	@echo "  quality      Run all quality checks"
	@echo ""
	@echo "Build:"
	@echo "  clean        Clean build artifacts"
	@echo "  build        Build distribution packages"
	@echo "  build-executable Build single executable with PyInstaller"
	@echo "  package-all  Build and package executable for distribution"
	@echo "  install-local Install in development mode"

# Installation
install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements-dev.txt

install-local:
	pip install -e .

# Testing
test:
	pytest

test-unit:
	pytest tests/unit/

test-integration:
	pytest tests/integration/ -m integration

test-e2e:
	pytest tests/e2e/ -m e2e

test-cov:
	pytest --cov=src/cantocap --cov-report=html --cov-report=term-missing

# Code Quality
lint:
	flake8 src/ tests/

format:
	black src/ tests/
	isort src/ tests/

typecheck:
	mypy src/

quality: lint typecheck
	@echo "All quality checks passed!"

# Build
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf htmlcov/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	python -m build

# Executable Build Targets
build-executable: clean
	@echo "Building CantoCap Engine executable..."
	pip install pyinstaller
	pyinstaller cantocap-engine.spec
	@echo "Executable created: dist/cantocap-engine"

build-windows:
	@echo "Building Windows executable..."
	pip install pyinstaller
	pyinstaller --onefile --console \
		--name cantocap-engine \
		--add-data "src:cantocap" \
		--hidden-import torch \
		--hidden-import transformers \
		--hidden-import typer \
		--hidden-import rich \
		--hidden-import srt \
		--hidden-import openai \
		--hidden-import google.generativeai \
		--hidden-import pyannote.audio \
		--hidden-import whisperx \
		--exclude-module matplotlib \
		--exclude-module tkinter \
		--exclude-module jupyter \
		src/presentation/cli/main.py

build-macos:
	@echo "Building macOS executable..."
	pip install pyinstaller
	pyinstaller --onefile --console \
		--name cantocap-engine \
		--add-data "src:cantocap" \
		--hidden-import torch \
		--hidden-import transformers \
		--hidden-import typer \
		--hidden-import rich \
		--hidden-import srt \
		--hidden-import openai \
		--hidden-import google.generativeai \
		--hidden-import pyannote.audio \
		--hidden-import whisperx \
		--exclude-module matplotlib \
		--exclude-module tkinter \
		--exclude-module jupyter \
		src/presentation/cli/main.py

build-linux:
	@echo "Building Linux executable..."
	pip install pyinstaller
	pyinstaller --onefile --console \
		--name cantocap-engine \
		--add-data "src:cantocap" \
		--hidden-import torch \
		--hidden-import transformers \
		--hidden-import typer \
		--hidden-import rich \
		--hidden-import srt \
		--hidden-import openai \
		--hidden-import google.generativeai \
		--hidden-import pyannote.audio \
		--hidden-import whisperx \
		--exclude-module matplotlib \
		--exclude-module tkinter \
		--exclude-module jupyter \
		src/presentation/cli/main.py

package-all: build-executable
	@echo "Packaging executable for distribution..."
	mkdir -p dist/releases
	cp dist/cantocap-engine dist/releases/ 2>/dev/null || cp dist/cantocap-engine.exe dist/releases/ 2>/dev/null || true
	@echo "Creating platform-specific archive..."
	@if [ -f "dist/cantocap-engine" ]; then \
		tar -czf dist/releases/cantocap-engine-$$(uname -s)-$$(uname -m).tar.gz \
			-C dist cantocap-engine; \
		echo "Created: dist/releases/cantocap-engine-$$(uname -s)-$$(uname -m).tar.gz"; \
	elif [ -f "dist/cantocap-engine.exe" ]; then \
		cd dist && zip releases/cantocap-engine-Windows-x86_64.zip cantocap-engine.exe; \
		echo "Created: dist/releases/cantocap-engine-Windows-x86_64.zip"; \
	fi

test-executable:
	@echo "Testing executable functionality..."
	@if [ -f "dist/cantocap-engine-lite" ]; then \
		echo "Testing version display:"; \
		./dist/cantocap-engine-lite --version; \
		echo "Testing hardware command:"; \
		./dist/cantocap-engine-lite hardware; \
		echo "Testing IPC mode with hardware:"; \
		./dist/cantocap-engine-lite hardware --ipc-mode; \
		echo "Testing demo processing:"; \
		./dist/cantocap-engine-lite demo.mp4 --ipc-mode --output demo.srt; \
	elif [ -f "dist/cantocap-engine" ]; then \
		echo "Testing version display:"; \
		./dist/cantocap-engine --version; \
		echo "Testing hardware command:"; \
		./dist/cantocap-engine hardware; \
		echo "Testing IPC mode:"; \
		./dist/cantocap-engine hardware --ipc-mode; \
	elif [ -f "dist/cantocap-engine.exe" ]; then \
		echo "Testing version display:"; \
		./dist/cantocap-engine.exe --version; \
		echo "Testing hardware command:"; \
		./dist/cantocap-engine.exe hardware; \
		echo "Testing IPC mode:"; \
		./dist/cantocap-engine.exe hardware --ipc-mode; \
	else \
		echo "No executable found. Run 'make build-executable' first."; \
		exit 1; \
	fi

clean-executable:
	rm -rf build/
	rm -rf dist/
	rm -rf *.spec.bak

# Development workflow
dev-setup: install-dev install-local
	@echo "Development environment ready!"

dev-test: format quality test
	@echo "All development checks passed!"

# Executable workflow
executable-setup: install build-executable test-executable
	@echo "Executable build and test complete!"