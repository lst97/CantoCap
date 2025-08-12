// ============================================================================
// TYPE DEFINITIONS FOR ZUSTAND STORES
// ============================================================================

export type StepType = 'input' | 'config' | 'processing' | 'review' | 'export';

export enum StepStatus {
  READY = 'ready',
  COMPLETE = 'complete', 
  WARNING = 'warning',
  ERROR = 'error',
  SKIP = 'skip',
  BLOCK = 'block'
}

export type StepStatusType = StepStatus;

// ============================================================================
// APP STATE TYPES
// ============================================================================

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

export interface UIState {
  showAdvanced: boolean;
}

export interface DependencyStatus {
  status: 'checking' | 'available' | 'missing' | 'error';
  available: boolean;
  version?: string;
}

export interface SystemDependencies {
  python: DependencyStatus;
  ffmpeg: DependencyStatus;
}

export interface HardwareInfo {
  checking?: boolean;
  gpuAcceleration?: boolean;
  memoryUsage?: string;
  deviceInfo?: string;
  modelLoadTime?: number;
  processingSpeed?: string;
}

export interface AppState {
  // State
  activeWorkspaceId: string | null;
  recentWorkspaces: string[];
  windowState: WindowState;
  isLoading: boolean;
  ui: UIState;
  appVersion?: string;
  dependencies: SystemDependencies;
  hardware?: HardwareInfo;

  // Actions
  actions: {
    setActiveWorkspace: (id: string) => Promise<void>;
    addRecentWorkspace: (id: string) => void;
    loadAppState: () => Promise<void>;
    updateWindowState: (state: Partial<WindowState>) => Promise<void>;
    clearRecentWorkspaces: () => Promise<void>;
    setLoading: (loading: boolean) => void;
    toggleAdvanced: () => void;
    checkDependencies?: () => Promise<void>;
    checkHardware?: () => Promise<void>;
    showNotification?: (message: string, type?: string) => void;
    setActiveModal?: (modal: string | null) => void;
  };
}

// ============================================================================
// WORKSPACE STATE TYPES
// ============================================================================

export interface WorkspaceMetadata {
  id: string;
  name: string;
  createdAt: string;
  lastAccessed: string;
  group?: WorkspaceGroup | null;
}

export interface WorkspaceState {
  // State
  workspaces: Record<string, WorkspaceMetadata>;
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  _initialized: boolean;
  
  // Pre-computed derived state for stable references
  _workspaceList: WorkspaceMetadata[];
  _groupedWorkspaces: Record<string, { group: WorkspaceGroup | null, workspaces: WorkspaceMetadata[] }>;
  _availableGroups: WorkspaceGroup[];

  // Actions
  actions: {
    createWorkspace: (name: string) => Promise<string>;
    deleteWorkspace: (id: string) => Promise<boolean>;
    switchWorkspace: (id: string) => Promise<void>;
    loadWorkspaces: () => Promise<void>;
    renameWorkspace: (id: string, newName: string) => Promise<boolean>;
    duplicateWorkspace: (id: string, newName: string) => Promise<string | null>;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    
    // Group management methods
    createGroup: (name: string, color?: WorkspaceGroupColor) => Promise<string>;
    deleteGroup: (groupId: string) => Promise<boolean>;
    updateGroup: (groupId: string, updates: Partial<Omit<WorkspaceGroup, 'id' | 'metadata'>>) => Promise<boolean>;
    addWorkspaceToGroup: (workspaceId: string, groupId: string) => Promise<void>;
    removeWorkspaceFromGroup: (workspaceId: string) => Promise<void>;
    
    // Internal helper to recompute derived state
    _recomputeDerivedState: () => void;
  };
}

// ============================================================================
// WORKSPACE UI TYPES - GROUPING AND PANEL MANAGEMENT
// ============================================================================

export type WorkspaceGroupColor = 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'indigo';

export interface WorkspaceGroup {
  id: string;
  name: string;
  color: WorkspaceGroupColor;
  isExpanded: boolean;
  position: number;
  metadata: {
    workspaceCount: number;
    createdAt: Date;
    lastModified: Date;
  };
}

export interface WorkspaceWithGrouping extends WorkspaceMetadata {
  groupId?: string | null;
  position?: number;
  emoji?: string;
  color?: string;
  isActive?: boolean;
}

// Simplified UI state without drag-and-drop complexity
export interface WorkspacePanelState {
  workspaceGroups: WorkspaceGroup[];
  workspaceGroupMappings: Record<string, string | null>;
  groupExpansionState: Record<string, boolean>;
}

// Extended workspace state with simplified UI features
export interface ExtendedWorkspaceState extends WorkspaceState {
  // UI state for panels
  panelState: WorkspacePanelState;
  
  // Extended actions
  actions: WorkspaceState['actions'] & {
    // Group management via context menu
    createGroup: (name: string, color?: WorkspaceGroupColor) => string;
    deleteGroup: (groupId: string) => Promise<boolean>;
    renameGroup: (groupId: string, newName: string) => Promise<boolean>;
    addWorkspaceToGroup: (workspaceId: string, groupId: string) => void;
    removeWorkspaceFromGroup: (workspaceId: string) => void;
    toggleGroupExpansion: (groupId: string) => void;
  };
}

// ============================================================================
// WORKFLOW STATE TYPES
// ============================================================================

export interface WorkflowState {
  // State
  currentStep: StepType;
  stepStates: Record<StepType, StepStatusType>;
  canNavigate: Record<StepType, boolean>;

  // Actions
  actions: {
    navigateToStep: (step: StepType) => Promise<void>;
    setStepState: (step: StepType, state: StepStatusType) => Promise<void>;
    resetWorkflow: () => Promise<void>;
    canNavigateToStep: (step: StepType) => boolean;
    getNextStep: () => StepType | null;
    getPreviousStep: () => StepType | null;
    completeCurrentStep: () => Promise<void>;
  };
}

// ============================================================================
// STEP CONTENT TYPES
// ============================================================================

// Input Step Types
export interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

export interface VideoMetadata {
  duration?: string;
  resolution?: string;
  size?: string;
  codec?: string;
  bitrate?: string;
  frameRate?: string;
}

export interface InputStepData {
  selectedFiles: string[];
  fileValidation: Record<string, boolean>;
  dragDropState: boolean;
  // Core file selection
  selectedFile?: string | null;
  inputFile?: string | null;
  importedJsonFile?: string | null;
  // Time range selection
  selectedRange?: TimeRange | null;
  startTime?: number | null;
  endTime?: number | null;
  duration?: number;
  // Metadata and timestamps
  mediaMetadata?: VideoMetadata;
  lastModified?: number;
  // Current file being processed
  currentFile?: string;
  fileMetadata?: Record<string, unknown>;
}

// Config Step Types
export type WhisperModel = 
  | 'openai/whisper-small'
  | 'openai/whisper-medium'
  | 'openai/whisper-large-v2'
  | 'openai/whisper-large-v3'
  | 'openai/whisper-large-v3-turbo'
  | 'whisperx/large-v3';

export type ProcessingLanguage = 
  | 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' 
  | 'ar' | 'hi' | 'vi' | 'uk' | 'pl' | 'hu' | 'fi' | 'fa' | 'el' | 'tr' 
  | 'da' | 'he' | 'ur' | 'te' | 'ca' | 'ml' | 'no' | 'nn' | 'sk' | 'sl' 
  | 'hr' | 'ro' | 'eu' | 'gl' | 'ka' | 'lv' | 'tl' | 'nl' | 'cs';

export type TranslationLanguage = 
  | 'en_us' | 'en_uk' | 'en_au' | 'en_ca'
  | 'zh_cn' | 'zh_tw'
  | 'ja_jp' | 'ko_kr'
  | 'es_es' | 'es_mx'
  | 'fr_fr' | 'fr_ca'
  | 'de_de' | 'it_it'
  | 'pt_br' | 'pt_pt'
  | 'ru_ru' | 'ar_sa' | 'hi_in'
  | 'th_th' | 'vi_vn' | 'id_id' | 'ms_my' | 'tl_ph';

export interface ModelSettings {
  whisperModel: WhisperModel;
  geminiModel?: string;
  enableGemini: boolean;
  temperature: number;
}

export interface ApiKeys {
  gemini?: string;
  openai?: string;
}

export interface AdvancedSettings {
  chunkDuration: number;
  numWorkers: number;
  enableSpeakerDiarization: boolean;
  enableMusicDetection: boolean;
}

export interface ConfigStepData {
  // Core configuration fields used by ConfigStep.tsx
  outputFile?: string | null;
  inputFile?: string | null;
  charset?: 'traditional' | 'simplified';
  language?: ProcessingLanguage;
  model?: WhisperModel;
  subtitle?: TranslationLanguage | null; // Translation language code for secondary captions
  geminiKey?: string;
  speakers?: boolean;
  written?: boolean;
  music?: boolean;

  // Additional CLI args fields
  priority?: 'balanced' | 'speed' | 'quality';
  noGeminiRefinement?: boolean;
  maxChunkDuration?: number;
  videoQuality?: '360p' | '720p' | '1080p';
  terminologyConfig?: string;
  ffmpegPath?: string;
  verbose?: boolean;

  // Structured settings (for more advanced configuration)
  modelSettings: ModelSettings;
  apiKeys: ApiKeys;
  advancedSettings: AdvancedSettings;

  // Validation and state
  isValid: boolean;
  validationErrors: string[];
  lastModified?: number;
}

// Processing Step Types
export interface HardwareInfo {
  gpuAcceleration?: boolean;
  memoryUsage?: string;
  deviceInfo?: string;
  modelLoadTime?: number;
  processingSpeed?: string;
}

export interface QualityBreakdown {
  technical: number;
  linguistic: number;
  readability: number;
  translation: number;
}

export interface CoverageBreakdown {
  subtitle_coverage: number;
  temporal_coverage: number;
  content_coverage: number;
  translation_quality: number;
}

export interface ProcessingStatistics {
  quality_score?: number;
  quality_grade?: string;
  quality_confidence?: number;
  quality_breakdown?: QualityBreakdown;
  translation_coverage?: number;
  coverage_confidence?: number;
  coverage_breakdown?: CoverageBreakdown;
  processing_time?: number;
  word_count?: number;
  subtitle_count?: number;
}

export interface ProcessingStepData {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  currentPhase?: string;
  logs: string[];
  hardwareInfo?: HardwareInfo;
  startTime?: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  statistics?: ProcessingStatistics;
  timeElapsed?: number; // Calculated field for display
}

// ============================================================================
// SUBTITLE EDITING TYPES - CENTRALIZED
// ============================================================================

export interface Subtitle {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  text: string;
  translation?: string;
  speaker?: string;
  confidence?: number;
}

export interface EditAction {
  type: 'update' | 'add' | 'delete' | 'split' | 'merge';
  subtitleId: string;
  data: Record<string, unknown>;
  timestamp: Date;
  description: string;
}

export interface WorkspaceSubtitleData {
  workspaceId: string;
  videoPath: string;
  currentSubtitles: Subtitle[];
  originalSubtitles: Subtitle[];
  editHistory: {
    undoStack: EditAction[];
    redoStack: EditAction[];
  };
  metadata: {
    lastSaved: string;
    subtitleCount: number;
  };
}

export interface SubtitleEditState {
  // Subtitle data
  subtitles: Subtitle[];
  originalSubtitles: Subtitle[];
  
  // Workspace context
  workspaceId: string | null;
  videoPath: string | null;
  
  // Selection and playback state
  selectedSubtitleId: string | null;
  currentTime: number;
  isVideoPlaying: boolean;
  videoDuration: number;
  
  // Edit history
  undoStack: EditAction[];
  redoStack: EditAction[];
  
  // Save state
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSaved: Date | null;
  
  // Actions
  actions: {
    // Workspace management
    loadSubtitlesForWorkspace: (workspaceId: string, videoPath: string, subtitles: Subtitle[]) => Promise<void>;
    clearWorkspace: () => void;
    
    // Subtitle editing
    updateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
    addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => void;
    deleteSubtitle: (id: string) => void;
    splitSubtitle: (id: string, splitTime: number) => void;
    mergeSubtitles: (id1: string, id2: string) => void;
    
    // Selection and playback
    setSelectedSubtitle: (id: string | null) => void;
    setCurrentTime: (time: number) => void;
    setVideoPlaying: (playing: boolean) => void;
    setVideoDuration: (duration: number) => void;
    jumpToSubtitle: (id: string) => void;
    
    // Edit history
    undo: () => void;
    redo: () => void;
    
    // Persistence
    saveToWorkspace: () => Promise<void>;
    restoreFromOriginal: () => void;
  };
}

export interface EditState {
  subtitleId: string;
  field: 'text' | 'startTime' | 'endTime' | 'speaker';
  originalValue: string | number | undefined;
  newValue: string | number | undefined;
}

export interface ReviewStepData {
  subtitles: Subtitle[];
  currentEdit?: EditState;
  playbackPosition: number;
  selectedSubtitleIndex?: number;
  searchQuery?: string;
  filteredSubtitles: Subtitle[];
  hasUnsavedChanges: boolean;
}

// Export Step Types
export interface ExportSettings {
  includeTimecodes: boolean;
  charset: string;
  translation: boolean;
  lineBreaks: 'auto' | 'manual';
  maxLineLength?: number;
}

export interface ExportRecord {
  id: string;
  format: string;
  outputPath: string;
  exportedAt: string;
  fileSize?: number;
  subtitleCount?: number;
}

// UI State Types for Export Step
export interface HighlightConfig {
  language: string;
  showLineNumbers: boolean;
}

export interface ExportPreviewState {
  fullscreenOpen: boolean;
  copySnackbar: boolean;
  showLineNumbers: boolean;
}

export interface ExportActionsState {
  showMultiFormatDialog: boolean;
  selectedFormats: string[];
  snackbarOpen: boolean;
}

export interface ValidationIssues {
  [formatId: string]: string[];
}

export interface HistoryGrouping {
  [groupKey: string]: Array<{
    id: string;
    fileName: string;
    filePath: string;
    format: string;
    size: number;
    timestamp: number;
  }>;
}

export interface ExportStepData {
  // Core Export Configuration
  format: string;
  outputPath?: string;
  exportSettings: ExportSettings;
  exportHistory: ExportRecord[];
  isExporting: boolean;
  exportProgress?: number;
  lastExportError?: string;
  
  // UI State Management
  previewState: ExportPreviewState;
  actionsState: ExportActionsState;
  highlightConfig: HighlightConfig;
  validationIssues: ValidationIssues;
  historyGrouping: HistoryGrouping;
  
  // Generated Content
  previewContent?: string;
  lastGenerated?: number;
  
  // Persistent User Selections
  selectedLanguages: string[];
  includeMetadata: boolean;
  showTimestamps: boolean;
  customOutputPath?: string;
  lastModified?: number;
}

// ============================================================================
// STEP STORE STATE
// ============================================================================

export interface StepContentState {
  // Step Data
  inputStep: InputStepData;
  configStep: ConfigStepData;
  processingStep: ProcessingStepData;
  reviewStep: ReviewStepData;
  exportStep: ExportStepData;

  // General State
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  currentWorkspaceId: string | null;

  // Actions
  actions: {
    updateStepContent: <T>(step: StepType, content: Partial<T>, workspaceId?: string) => Promise<void>;
    getStepContent: (step: StepType) => any;
    resetStepContent: (step: StepType, workspaceId?: string) => Promise<void>;
    loadStepContent: (workspaceId: string, step: StepType) => Promise<void>;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    markUnsavedChanges: (hasChanges: boolean) => void;
    saveAllChanges: () => Promise<void>;
    discardChanges: () => Promise<void>;
    getConfigAsCliArgs: () => string[];
    cancelTranscription: () => Promise<void>;
    
    // Export-specific actions
    updateExportFormat: (format: string) => void;
    updateExportSettings: (settings: Partial<ExportStepData['exportSettings']>) => void;
    updatePreviewState: (previewState: Partial<ExportStepData['previewState']>) => void;
    updateActionsState: (actionsState: Partial<ExportStepData['actionsState']>) => void;
    updateHighlightConfig: (highlightConfig: Partial<ExportStepData['highlightConfig']>) => void;
    setPreviewContent: (content: string) => void;
    updateUserSelections: (selections: {
      selectedLanguages?: string[];
      includeMetadata?: boolean;
      showTimestamps?: boolean;
      customOutputPath?: string;
    }) => void;
    addExportRecord: (record: Omit<ExportStepData['exportHistory'][0], 'id'>) => void;
    removeExportRecord: (recordId: string) => void;
    removeFromHistory: (index: number) => void;
    clearHistory: () => void;
    setExportingState: (isExporting: boolean, progress?: number, error?: string) => void;
    generatePreviewContent: () => Promise<void>;
  };
}

// ============================================================================
// EVENT TYPES FOR IPC COMMUNICATION
// ============================================================================

export interface AppStateUpdateEvent {
  activeWorkspaceId: string | null;
  recentWorkspaces: string[];
  windowState: WindowState;
}

export interface WorkspaceCreatedEvent {
  id: string;
  workspace: WorkspaceMetadata;
}

export interface WorkspaceUpdatedEvent {
  id: string;
  workspace: WorkspaceMetadata;
}

export interface WorkspaceDeletedEvent {
  id: string;
}

export interface StepContentUpdatedEvent {
  workspaceId: string;
  stepName: string;
  content: any;
}

export interface WorkflowStepChangedEvent {
  workspaceId: string;
  currentStep: StepType;
}

export interface WorkflowStepStateChangedEvent {
  workspaceId: string;
  step: StepType;
  state: StepStatusType;
}
