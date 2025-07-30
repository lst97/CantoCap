// Export Step specific types
export interface HighlightConfig {
  language: string
  showLineNumbers: boolean
}

export interface ExportPreviewState {
  fullscreenOpen: boolean
  copySnackbar: boolean
  showLineNumbers: boolean
}

export interface ExportActionsState {
  showMultiFormatDialog: boolean
  selectedFormats: string[]
  snackbarOpen: boolean
}

export interface ValidationIssues {
  [formatId: string]: string[]
}

export interface HistoryGrouping {
  [groupKey: string]: Array<{
    id: string
    fileName: string
    filePath: string
    format: string
    size: number
    timestamp: number
  }>
}