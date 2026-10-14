export function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Invalid Vault object');
  return value as Record<string, unknown>;
}
export function text(value: unknown, limit = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('Invalid Vault text');
  return value;
}
export function array(value: unknown, limit = 200): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid Vault collection');
  return value;
}
export function strings(value: unknown, limit = 200): string[] { return array(value, limit).map(item => text(item)); }
export function opaqueId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) throw new Error('Invalid Vault identifier');
  return value;
}
export function date(value: unknown): string {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) throw new Error('Invalid Vault date');
  return result;
}
export function httpUrl(value: unknown): string {
  const result = text(value, 4000);
  const url = new URL(result);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid Vault URL');
  return url.href;
}
export function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate Vault identifier');
  return items;
}
