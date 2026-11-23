/** Finite, content-free lifecycle messages. No credentials or native general-purpose bridge. */
export type PrepareClose = { type: 'studio:prepare-close'; requestId: string };
export type CloseResult = { type: 'studio:close-result'; requestId: string; status: 'ready' | 'cancel' };
export type CloseFailed = { type: 'studio:close-failed'; requestId: string };
export function closeFailed(value: unknown): value is CloseFailed {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && 'type' in value && value.type === 'studio:close-failed'
    && prepareClose({ ...value, type: 'studio:prepare-close' });
}
export function prepareClose(value: unknown): value is PrepareClose {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join() === 'requestId,type' && item.type === 'studio:prepare-close'
    && typeof item.requestId === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.requestId);
}
