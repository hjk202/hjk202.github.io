import type { Envelope } from '../../src/core/vault/crypto.ts';
export interface CipherRecord { handle: string; revision: string | null; envelope: Envelope | null }
export interface CipherWrite { revision: string; backupCreated: boolean; cleanupPending: boolean }
export type PrivateSelectionMode = 'open' | 'create' | 'export';
export interface DeliveryCandidate {id:string;revision:string;masterRevision:string;publicRevision:string;targetRevision:string|null}
export interface DeliveryResult {revision:string;backupRevision:string|null;cleanupPending:boolean}
export function privateSelection(value: unknown): value is { type: 'studio:private-select'; requestId: string; mode: PrivateSelectionMode } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join() === 'mode,requestId,type' && item.type === 'studio:private-select'
    && typeof item.requestId === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.requestId)
    && (item.mode === 'open' || item.mode === 'create' || item.mode === 'export');
}
