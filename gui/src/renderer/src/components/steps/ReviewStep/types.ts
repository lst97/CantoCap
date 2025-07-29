export interface VideoPreviewSectionProps {}

export interface SubtitleEditorProps {}

export interface SubtitleListPanelProps {}

export interface ModificationChipProps {
  modificationType: "added" | "modified" | "deleted";
  children?: React.ReactNode;
}

export interface DiffPart {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface DiffOperation {
  type: "added" | "removed" | "unchanged";
  char: string;
}