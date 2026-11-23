/** Think authoring values only; no filesystem, HTTP or Astro runtime dependencies. */
export interface ThinkDocument {
  metadata: {
    slug: string;
    title?: string;
    summary?: string;
    date?: string;
    createdAt?: string;
    updatedAt?: string;
    published?: boolean;
    kind?: 'article' | 'note';
  };
  body: string;
}

export type { ValidationCode, ValidationIssue, ValidationReport, EditorErrorCode, EditorResult } from './result.ts';
import type { ValidationIssue, ValidationReport } from './result.ts';

export interface ParsedThinkSource {
  document: ThinkDocument;
  validation: ValidationReport;
}

export type SourceRevision = string;

export interface ThinkSummary {
  key: string;
  fileName: string;
  revision: SourceRevision | null;
  slug?: string;
  title?: string;
  date?: string;
  published?: boolean;
  kind?: 'article' | 'note';
  editable: boolean;
  deletable: boolean;
  issues: ValidationIssue[];
}

export interface ThinkReadResult extends ThinkSummary {
  /** Absent for damaged/unsupported files; never substitute an empty document. */
  document?: ThinkDocument;
}

export interface ThinkWriteResult {
  key: string;
  revision: SourceRevision;
  /** The commit succeeded but its owned temporary file could not be removed. */
  cleanupPending: boolean;
}
