export interface CodePreview {
  lines: string[];
  lineNumbers?: number[];
  lineCount?: number;
  truncated?: boolean;
}

export interface MapPreviewPage {
  files: Record<string, CodePreview>;
  next: number | null;
  total: number;
  tooLarge: boolean;
}
