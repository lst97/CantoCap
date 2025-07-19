# Makefile for CantoSub development

.PHONY: install install-dev test test-unit test-integration test-e2e lint format typecheck clean build help

# Default target
help:
	@echo "CantoSub Development Commands:"
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
	pytest --cov=src/cantosub --cov-report=html --cov-report=term-missing

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

# Development workflow
dev-setup: install-dev install-local
	@echo "Development environment ready!"

dev-test: format quality test
	@echo "All development checks passed!"