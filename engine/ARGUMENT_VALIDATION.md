# CantoCap CLI Argument Validation

## Overview

CantoCap includes comprehensive argument validation to prevent common CLI usage errors and security issues. The validation system checks all arguments before processing and provides clear error messages with suggestions for fixes.

## Validation Features

### 1. File Path Security
- **Dangerous Character Detection**: Prevents shell injection by detecting characters like `$`, `` ` ``, `|`, `&`, `;`, etc.
- **Path Traversal Prevention**: Blocks attempts to access files outside intended directories using `../` patterns
- **Space Handling**: Warns about spaces in paths that may cause shell issues
- **File Existence Checks**: Validates that input files exist and output directories are writable
- **Format Validation**: Ensures file extensions match expected media formats

### 2. Language Code Validation
- **Format Checking**: Ensures language codes follow `language_country` format (e.g., `zh_cn`, `en_us`)
- **Normalization**: Automatically converts hyphens to underscores (`en-US` → `en_us`)
- **Support Verification**: Validates against list of supported languages for translation

### 3. Parameter Range Validation
- **Enum Values**: Validates choices like priority (`speed`, `quality`, `balanced`)
- **Numeric Ranges**: Checks that numeric parameters are within acceptable bounds
- **Model Names**: Validates Whisper model names against supported list

### 4. API Key Security
- **Length Checks**: Warns if API keys appear too short to be valid
- **Placeholder Detection**: Detects common placeholder values like `YOUR_API_KEY`
- **Format Validation**: Checks for common issues like embedded spaces

### 5. FFmpeg Path Validation
- **Executable Detection**: Verifies FFmpeg is accessible either in PATH or at specified location
- **Permission Checks**: Ensures the FFmpeg binary is executable

## Command Line Usage Examples

### Correct Usage (Options First, Input File Last)
```bash
# Basic usage with validation
cantocap --priority speed --language zh_cn --ffmpeg-path ffmpeg input.mp4

# With enhanced features
cantocap --speakers --written --music --gemini-key YOUR_KEY --ffmpeg-path ffmpeg video.mkv

# Hardware analysis
cantocap --priority quality --duration 30 hardware
```

### Validation Error Examples

#### Invalid Priority
```bash
cantocap --priority invalid_priority --ffmpeg-path ffmpeg test.mp4
```
**Error**: `Invalid value 'invalid_priority' for priority → Must be one of: speed, quality, balanced`

#### Dangerous Characters in Path
```bash
cantocap --ffmpeg-path ffmpeg "test$file.mp4"
```
**Error**: `Path contains potentially dangerous characters: ['$'] → Remove special characters from the path`

#### Invalid Language Code
```bash
cantocap --language zh --ffmpeg-path ffmpeg test.mp4
```
**Error**: `Unsupported language code: 'zh' → Supported codes: zh_cn, zh_tw, en_us, ja_jp, ...`

#### Missing Required FFmpeg
```bash
cantocap test.mp4
```
**Error**: `--ffmpeg-path is required for subtitle generation → Use --ffmpeg-path /path/to/ffmpeg or --ffmpeg-path ffmpeg (if in PATH)`

## Validation Severity Levels

### Errors (Block Execution)
- Invalid file paths or formats
- Unsupported language codes
- Invalid parameter values
- Security risks (dangerous characters, path traversal)
- Missing required dependencies

### Warnings (Allow Execution)
- Files with spaces in names
- Large file sizes that may take long to process
- Short API keys that might be incomplete

## Implementation Details

### ArgumentValidator Class
Located in `src/infrastructure/validation/argument_validator.py`, this class provides:

- `validate_file_path()`: Comprehensive file path validation with security checks
- `validate_language_code()`: Language code format and support validation
- `validate_enum_value()`: Choice parameter validation
- `validate_numeric_range()`: Numeric parameter bounds checking
- `validate_api_key()`: API key format and security validation
- `validate_all_arguments()`: Comprehensive validation of all CLI arguments

### Integration Points
- **CLI Commands**: Integrated into `generate_command()` and `hardware_command()`
- **Error Display**: Rich-formatted error messages with suggestions
- **Sanitization**: Returns cleaned/normalized values for safe use

## Security Considerations

### Prevented Attack Vectors
1. **Shell Injection**: Dangerous characters in file paths blocked
2. **Path Traversal**: Directory escape attempts detected and blocked
3. **Command Injection**: Special shell characters filtered out
4. **File System Access**: Validates file permissions and accessibility

### Safe Defaults
- File paths are resolved to absolute paths
- Language codes are normalized to standard format
- API keys are trimmed of whitespace
- Numeric values are range-checked

## Testing

Comprehensive unit tests are provided in `tests/unit/test_argument_validator.py` covering:
- All validation methods
- Security attack scenarios
- Edge cases and error conditions
- Integration with CLI commands

Run tests with:
```bash
./venv/bin/python -m pytest tests/unit/test_argument_validator.py -v
```