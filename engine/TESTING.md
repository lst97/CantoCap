# CantoCap Testing Guide

## Overview

This document provides instructions for running the comprehensive test suite for the CantoCap project. The test suite includes **650 tests** across unit, integration, and end-to-end (E2E) test categories.

## Prerequisites

### 1. Environment Setup

Ensure you have the virtual environment activated:

```bash
source venv/bin/activate
```

### 2. API Keys Configuration

For integration and E2E tests that use AI services, you need to configure API keys in the `.env` file:

```bash
# Create/edit .env file in the engine directory
cp .env.example .env  # if available
```

Add the following keys to `/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_AUTH_TOKEN=your_huggingface_token_here
```

**Note**: The test suite uses `ConfigurationService` to automatically load these keys from the `.env` file. Tests that require API keys will be skipped if keys are not available.

### 3. Test Dependencies

Ensure all test dependencies are installed:

```bash
pip install -r requirements.txt
# Install additional test dependencies if needed
pip install pytest pytest-cov pytest-mock
```

### 4. Test Video File

The E2E tests use a test video file located at:
```
/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/tests/test-keep-talking.mp4
```

If this file is missing, those tests will be automatically skipped.

## Test Categories

### Unit Tests (568 tests)
- **Domain Layer**: Value objects and entities
- **Application Layer**: Commands and services  
- **Infrastructure Layer**: Validation and CLI components
- **Presentation Layer**: IPC handlers

### Integration Tests (66 tests)
- **CLI Integration**: Command-line interface functionality
- **FFmpeg Integration**: Audio/video processing
- **Whisper Integration**: Speech transcription (uses real AI models)
- **Processing Pipeline**: End-to-end processing workflows

### End-to-End Tests (16 tests)
- **Complete Workflows**: Full subtitle generation using real test video
- **Production Scenarios**: Batch processing, memory constraints
- **Error Handling**: Resource cleanup and interruption handling

## Running Tests

### Quick Start - Run All Tests

```bash
# Run complete test suite (may take 10-15 minutes)
python -m pytest tests/ -v
```

### Run Tests by Category

```bash
# Fast unit tests only (~30 seconds)
python -m pytest tests/unit/ -v

# Integration tests (~2-3 minutes)
python -m pytest tests/integration/ -v

# End-to-end tests (~5-10 minutes - includes AI model processing)
python -m pytest tests/e2e/ -v
```

### Run Tests with Coverage

```bash
# Generate coverage report
python -m pytest tests/ --cov=src --cov-report=html --cov-report=term-missing

# View coverage report
open htmlcov/index.html
```

### Run Specific Test Types

```bash
# Run only fast tests (exclude slow AI model tests)
python -m pytest tests/ -v -m "not slow"

# Run only slow tests (AI model processing)
python -m pytest tests/ -v -m "slow"

# Run specific test file
python -m pytest tests/unit/domain/test_timestamp.py -v

# Run specific test method
python -m pytest tests/e2e/test_complete_workflow_comprehensive.py::TestCompleteWorkflowE2E::test_basic_transcription_workflow -v
```

### Test Runner Script

Use the provided test runner for convenient execution:

```bash
# Run different test types
python run_tests.py --type unit
python run_tests.py --type integration  
python run_tests.py --type e2e
python run_tests.py --type all

# Run with coverage
python run_tests.py --type all --coverage

# Run with verbose output
python run_tests.py --type unit --verbose

# Stop on first failure
python run_tests.py --type unit --fail-fast

# Run tests matching pattern
python run_tests.py --type unit --pattern "timestamp"
```

## Test Execution Times

**Expected execution times**:

- **Unit Tests**: ~30 seconds
- **Integration Tests**: ~2-3 minutes  
- **E2E Tests**: ~5-10 minutes (includes real AI model loading and processing)
- **Full Suite**: ~10-15 minutes

**Important**: E2E and some integration tests use real AI models (Whisper) which require ~5 minutes for model loading and processing. **Do not terminate these tests while AI models are running** as it may leave processes in an inconsistent state.

## Test Configuration

### Test Markers

Tests are marked with pytest markers for selective execution:

- `@pytest.mark.unit` - Fast unit tests
- `@pytest.mark.integration` - Integration tests requiring external services
- `@pytest.mark.e2e` - End-to-end workflow tests
- `@pytest.mark.slow` - Tests involving AI model processing (~5 minutes)

### Environment Variables

Tests automatically handle environment configuration:

- **Development**: Uses `.env` file for API keys
- **CI/CD**: Uses environment variables directly
- **Missing Keys**: Tests are automatically skipped with clear messages

### Test Data

- **Test Video**: `/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/tests/test-keep-talking.mp4`
- **Whisper Model**: Tests use `openai/whisper-small` for consistent, fast results
- **Temporary Files**: All tests use temporary directories and clean up automatically

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure `.env` file contains valid `GEMINI_API_KEY` and `HUGGINGFACE_AUTH_TOKEN`

2. **Test Video Missing**: E2E tests will skip if test video file is not found

3. **Model Loading Timeout**: Whisper model loading may take time on first run - be patient

4. **Import Errors**: Ensure virtual environment is activated and dependencies installed

### Test Failures

```bash
# Run with detailed error output
python -m pytest tests/ -v --tb=long

# Stop on first failure for debugging
python -m pytest tests/ -x

# Run only failed tests from last run
python -m pytest tests/ --lf
```

### Performance Issues

```bash
# Skip slow AI model tests
python -m pytest tests/ -m "not slow"

# Run tests in parallel (if pytest-xdist installed)
python -m pytest tests/ -n auto
```

## Feature Testing

The test suite comprehensively tests feature toggles:

### Core Features
- ✅ Speaker diarization (enabled/disabled)
- ✅ Music detection (enabled/disabled) 
- ✅ Gemini refinement (enabled/disabled)
- ✅ Translation (enabled/disabled)
- ✅ IPC mode (enabled/disabled)
- ✅ Written style (enabled/disabled)

### Configuration Options
- ✅ Charset options (traditional/simplified)
- ✅ Priority modes (speed/quality/balanced)
- ✅ Video quality settings
- ✅ Model selection (auto/manual)
- ✅ Hardware detection and optimization

### Error Scenarios
- ✅ Missing files and invalid formats
- ✅ Network failures and API errors
- ✅ Resource constraints and cleanup
- ✅ Interruption handling

## Continuous Integration

For CI/CD environments:

```bash
# Run tests with XML output for CI reporting
python -m pytest tests/ --junitxml=test-results.xml

# Run with coverage for CI
python -m pytest tests/ --cov=src --cov-report=xml

# Skip tests requiring external resources in CI
python -m pytest tests/ -m "not slow and not e2e"
```

## Contributing

When adding new tests:

1. **Unit Tests**: Place in appropriate `tests/unit/` subdirectory
2. **Integration Tests**: Place in `tests/integration/` 
3. **E2E Tests**: Place in `tests/e2e/`
4. **Use Markers**: Add appropriate `@pytest.mark.*` decorators
5. **Follow Patterns**: Use existing test patterns and fixtures
6. **Document**: Update this guide for new test categories

## Support

For test-related issues:

1. Check this documentation
2. Examine existing test patterns
3. Ensure environment is properly configured
4. Run tests with verbose output for debugging