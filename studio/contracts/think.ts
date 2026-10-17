/** Think authoring values only; no filesystem, HTTP or Astro runtime dependencies. */
export interface ThinkDocument {
  metadata: {
    slug: string;
    title?: string;
    summary?: string;
    date?: string;
    published?: boolean;
    kind?: 'article' | 'note';
  };
  body: string;
}

export type ValidationCode =
  | 'INVALID_TYPE' | 'UNKNOWN_FIELD' | 'INVALID_SLUG' | 'REQUIRED_FIELD'
  | 'INVALID_DATE' | 'INVALID_KIND' | 'INVALID_FRONTMATTER' | 'UNSUPPORTED_YAML'
  | 'DUPLICATE_SLUG' | 'INVALID_FILENAME' | 'FILE_EXISTS' | 'SLUG_IMMUTABLE'
  | 'SOURCE_UNAVAILABLE' | 'SOURCE_TOO_LARGE' | 'DIRECTORY_INVALID';

export interface ValidationIssue {
  field: string;
  code: ValidationCode;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationReport {
  canSave: boolean;
  publishReady: boolean;
  issues: ValidationIssue[];
}

export type EditorErrorCode =
  | 'VALIDATION_FAILED' | 'UNSUPPORTED_FORMAT' | 'INVALID_REQUEST' | 'NOT_FOUND'
  | 'REVISION_CONFLICT' | 'DUPLICATE_SLUG' | 'FILE_EXISTS' | 'PROTECTED_PATH'
  | 'DIRECTORY_INVALID' | 'AUTHORING_BUSY' | 'SERVICE_CLOSED' | 'FILE_OPERATION_FAILED'
  | 'PREVIEW_NOT_READY' | 'PREVIEW_FAILED' | 'PREVIEW_TIMEOUT' | 'PREVIEW_CANCELLED'
  | 'PREVIEW_RESOURCE_BLOCKED' | 'PREVIEW_TOO_LARGE'
  | 'AI_NOT_CONFIGURED' | 'AI_CONFIG_INVALID' | 'AI_INPUT_TOO_LARGE' | 'AI_AUTH_FAILED'
  | 'AI_RATE_LIMITED' | 'AI_FAILED' | 'AI_TIMEOUT' | 'AI_CANCELLED' | 'AI_INVALID_RESPONSE' | 'AI_TOO_LARGE';

export type EditorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: EditorErrorCode; message: string; issues: ValidationIssue[]; cleanupPending?: boolean } };

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
