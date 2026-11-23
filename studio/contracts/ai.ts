export const AI_OPERATIONS = ['polish', 'rewrite', 'summarize', 'generateTitle', 'generateSummary'] as const;
export type AiOperation = typeof AI_OPERATIONS[number];
export interface ThinkTextInput { operation: AiOperation; input: string }
export interface ThinkTextSuggestion { operation: AiOperation; text: string }
export interface ThinkAiStatus {
  service: '阿里云百炼' | 'Google Gemini';
  model: 'deepseek-v4.1-flash' | 'gemini-3.5-flash-lite';
  available: boolean;
  bailianAvailable?: boolean;
  issue: 'AI_NOT_CONFIGURED' | 'AI_CONFIG_INVALID' | 'AI_INITIALIZING' | 'AI_CONFIG_UNAVAILABLE' | null;
}
export const AI_MODEL = 'deepseek-v4.1-flash';
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const AI_MAX_INPUT_BYTES = 32 * 1024;
export const AI_MAX_OUTPUT_BYTES = 32 * 1024;
export const AI_MAX_RESPONSE_BYTES = 128 * 1024;
export const AI_MAX_REQUEST_BYTES = 128 * 1024;
export const AI_TIMEOUT_MS = 60_000;
