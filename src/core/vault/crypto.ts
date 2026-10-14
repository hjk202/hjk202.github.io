import { object, opaqueId } from './validation.ts';

export const MAX_PLAIN = 8 * 1024 * 1024;
export const MAX_ENVELOPE = 12 * 1024 * 1024;
export interface Envelope { version: 1; iterations: number; salt: string; iv: string; ciphertext: string }
export interface VaultAsset { type: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
export interface VaultPayload { version: 1; modules: Record<string, unknown>; assets: Record<string, VaultAsset> }
export function encodeBase64(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result);
}
export function decodeBase64(value: unknown, maximum = MAX_PLAIN + 16): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length % 4 !== 0 || value.length > Math.ceil(maximum / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid Vault encoding');
  const binary = atob(value);
  const result = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (result.length > maximum || encodeBase64(result) !== value) throw new Error('Invalid Vault encoding');
  return result;
}
export function parseEnvelope(value: unknown): Envelope {
  const data = object(value, ['version','iterations','salt','iv','ciphertext']);
  if (data.version !== 1 || !Number.isInteger(data.iterations) || Number(data.iterations) < 600000 || Number(data.iterations) > 1000000 || decodeBase64(data.salt,16).length !== 16 || decodeBase64(data.iv,12).length !== 12 || decodeBase64(data.ciphertext).length < 16) throw new Error('Invalid Vault envelope');
  return data as unknown as Envelope;
}
export function readEnvelope(source: string): Envelope {
  if (source.length > MAX_ENVELOPE) throw new Error('Vault envelope too large');
  return parseEnvelope(JSON.parse(source));
}
export function validatePayload(value: unknown): VaultPayload {
  const data = object(value,['version','modules','assets']);
  if (data.version !== 1 || !data.modules || typeof data.modules !== 'object' || Array.isArray(data.modules) || !data.assets || typeof data.assets !== 'object' || Array.isArray(data.assets)) throw new Error('Invalid Vault payload');
  const modules = data.modules as Record<string,unknown>;
  if (Object.keys(modules).length > 16 || Object.keys(modules).some(id => !/^[a-z][a-z0-9-]*$/.test(id))) throw new Error('Invalid Vault modules');
  const assets: Record<string,VaultAsset> = {};
  if (Object.keys(data.assets).length > 8) throw new Error('Too many Vault assets');
  for (const [id,value] of Object.entries(data.assets)) {
    opaqueId(id);
    const asset = object(value,['type','data']);
    const bytes = decodeBase64(asset.data, 512 * 1024);
    const hex = [...bytes.slice(0,12)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const valid = asset.type === 'image/png' ? hex.startsWith('89504e470d0a1a0a') : asset.type === 'image/jpeg' ? hex.startsWith('ffd8ff') : asset.type === 'image/webp' && hex.startsWith('52494646') && hex.slice(16,24) === '57454250';
    if (!valid) throw new Error('Unsupported Vault asset');
    assets[id] = asset as unknown as VaultAsset;
  }
  return { version:1, modules, assets };
}
function passwordBytes(password: string, creating: boolean) {
  const bytes = new TextEncoder().encode(password);
  if (!bytes.length || bytes.length > 1024 || (creating && [...password].length < 16)) throw new Error('Invalid Vault passphrase length');
  return bytes;
}
export function associatedData(envelope: Envelope): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(['personal-space-vault',1,envelope.iterations,envelope.salt,envelope.iv]));
}
async function derive(password: string, envelope: Envelope, usage: 'encrypt'|'decrypt') {
  const bytes = passwordBytes(password, usage === 'encrypt');
  try {
    const material = await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
    return await crypto.subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256',salt:decodeBase64(envelope.salt,16),iterations:envelope.iterations },material,{name:'AES-GCM',length:256},false,[usage]);
  } finally { bytes.fill(0); }
}
export async function encryptVault(value: unknown, password: string): Promise<Envelope> {
  const payload = validatePayload(value);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > MAX_PLAIN) throw new Error('Vault payload too large');
  const envelope: Envelope = { version:1,iterations:600000,salt:encodeBase64(crypto.getRandomValues(new Uint8Array(16))),iv:encodeBase64(crypto.getRandomValues(new Uint8Array(12))),ciphertext:'' };
  try {
    const key = await derive(password,envelope,'encrypt');
    const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv:decodeBase64(envelope.iv,12),additionalData:associatedData(envelope),tagLength:128},key,bytes);
    envelope.ciphertext = encodeBase64(new Uint8Array(ciphertext));
    return envelope;
  } finally { bytes.fill(0); }
}
export async function decryptVault(value: unknown, password: string): Promise<VaultPayload> {
  const envelope = parseEnvelope(value);
  let bytes: Uint8Array | undefined;
  try {
    const key = await derive(password,envelope,'decrypt');
    const decrypted = await crypto.subtle.decrypt({name:'AES-GCM',iv:decodeBase64(envelope.iv,12),additionalData:associatedData(envelope),tagLength:128},key,decodeBase64(envelope.ciphertext));
    bytes = new Uint8Array(decrypted);
    if (bytes.length > MAX_PLAIN) throw new Error('Vault payload too large');
    return validatePayload(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  } catch { throw new Error('Vault verification failed'); }
  finally { bytes?.fill(0); }
}
