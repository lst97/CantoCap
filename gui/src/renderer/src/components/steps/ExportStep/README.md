# ExportStep Component Structure

This folder contains the modularized ExportStep component, split into maintainable subcomponents following the project's established patterns.

## Structure

```bash
ExportStep/
├── index.tsx              # Main component export & layout
├── ConfigSection.tsx      # Reusable section wrapper component
├── FormatSelector.tsx     # Export format selection component
├── LanguageOptions.tsx    # Language and metadata options
├── ExportActions.tsx      # Export buttons and actions
├── ExportPreview.tsx      # Syntax-highlighted preview with line numbers
├── ExportHistory.tsx      # Export history management
├── types.ts              # TypeScript type definitions
├── utils.ts              # Shared utility functions
└── README.md             # This documentation file
```

## Components

### `index.tsx`

- Main ExportStep component with two-column layout
- Follows the same pattern as ConfigStep (Step 2)
- Imports and orchestrates all subcomponents

### `ConfigSection.tsx`

- Reusable wrapper component for configuration sections
- Supports `important` variant for visual emphasis
- Uses BaseCard for consistent styling

### `FormatSelector.tsx`

- Radio group for selecting export format
- Includes validation warnings and format descriptions
- Shows format features as chips

### `LanguageOptions.tsx`

- Checkbox options for language inclusion
- Shows statistics for available content
- Includes metadata options (confidence scores, timestamps)

### `ExportActions.tsx`

- Primary export button with progress indication
- Multi-format export dialog
- Keyboard shortcuts (Ctrl+E, Ctrl+P)
- Error handling and success notifications

### `ExportPreview.tsx`

- Syntax-highlighted preview using highlight.js
- Toggleable line numbers with icon
- Fullscreen dialog view
- Copy-to-clipboard functionality
- Increased container height (400-600px)

### `ExportHistory.tsx`

- Grouped export history by date
- Context menu for file operations
- Relative time formatting
- File size and format information

## Utility Functions

### `utils.ts`

- `formatRelativeTime()` - Human-readable time formatting
- `groupHistoryByDate()` - Groups items by Today/Yesterday/Date
- `detectLanguageFromFormat()` - Maps format to syntax highlighting language
- `addLineNumbers()` - Adds line numbers to content
- `createKeyboardHandler()` - Keyboard shortcut handler factory

### `types.ts`

- TypeScript interfaces for component state
- Export-specific type definitions
- Shared data structures

## Features

### Syntax Highlighting

- Uses highlight.js with vs2015 theme
- Supports XML, JSON, and text formats
- Automatic language detection based on export format
- Fallback to plain text if highlighting fails

### Line Numbers

- Toggleable with dedicated icon button
- Proper styling with reduced opacity
- Non-selectable for better UX
- Consistent 3-digit padding

### Design Consistency

- Matches Step 2 (ConfigStep) layout and styling
- Uses BaseCard variants (default, important, subtle)
- Consistent Material-UI components and theming
- Proper accessibility attributes

### Performance

- Memoized computations for expensive operations
- Efficient re-rendering with useCallback hooks
- Utility function reuse across components
- Minimal prop drilling

## Usage

The component maintains the same external API as the original monolithic version:

```tsx
import { ExportStep } from './components/steps/ExportStep'

// Use exactly as before - no breaking changes
<ExportStep />
```

## Maintenance Benefits

1. **Separation of Concerns**: Each component has a single responsibility
2. **Testability**: Individual components can be unit tested
3. **Reusability**: Components like ConfigSection can be reused
4. **Maintainability**: Changes to one feature don't affect others
5. **Code Organization**: Logical grouping of related functionality
6. **Type Safety**: Dedicated types file with proper interfaces
7. **Utility Sharing**: Common functionality extracted to utils
