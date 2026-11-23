import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { dirname, basename, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { MAX_ENVELOPE, parseEnvelope, readEnvelope } from '../../../src/core/vault/crypto.ts';
import type { Envelope } from '../../../src/core/vault/crypto.ts';
import type { CipherRecord, CipherWrite, PrivateSelectionMode } from '../../contracts/private.ts';
import { PrivateError } from '../../private/error.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const same = (left: fs.BigIntStats, right: fs.BigIntStats) => left.dev === right.dev && left.ino === right.ino;
type Anchor = { path: string; stat: fs.BigIntStats };
type Bound = { path: string; anchors: Anchor[]; existed?: boolean };
function exists(path: string) { try { return fs.lstatSync(path, { bigint: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; } }
function within(root: string, path: string) { const part = relative(root, path); return part === '' || !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep); }

/** Trusted native selection only. HTTP callers receive opaque handles, never paths. Ciphertext only. */
export class CipherFiles {
  #root: string;
  #bound = new Map<string, Bound>();
  #closed = false;
  #bundle = false;
  constructor(repositoryRoot: string) { this.#root = fs.realpathSync(resolve(repositoryRoot)); }
  /** Internal fixed delivery target only. Its caller must back up old ciphertext outside the repository. */
  static forBundle(repositoryRoot:string) { const files=new CipherFiles(repositoryRoot);files.#bundle=true;return files; }
  #check(bound: Bound) {
    for (const { path, stat } of bound.anchors) {
      const now = fs.lstatSync(path, { bigint: true });
      if (!now.isDirectory() || now.isSymbolicLink() || !same(stat, now) || relative(path, fs.realpathSync.native(path)) !== '') throw new PrivateError('PRIVATE_FILE_UNSAFE');
    }
  }
  #selection(input: string): Bound {
    if (!isAbsolute(input) || input.includes('\0') || input.startsWith('\\\\') || input.length > 32768) throw new PrivateError('PRIVATE_FILE_UNSAFE');
    const path = resolve(input), name = basename(path);
    if ((this.#bundle ? path!==join(this.#root,'public/vault/bundle.json') : within(this.#root, path)) || !/\.json$/i.test(name) || name.length > 128 || /[<>:"/\\|?*]/.test(name) || /[. ]$/.test(name)
      || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)
      || path.slice(parse(path).root.length).includes(':') || [...path].some(char => char.charCodeAt(0) < 32)) throw new PrivateError('PRIVATE_FILE_UNSAFE');
    const anchors: Anchor[] = [];
    for (let part = dirname(path); ; part = dirname(part)) {
      const stat = fs.lstatSync(part, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || relative(part, fs.realpathSync.native(part)) !== '') throw new PrivateError('PRIVATE_FILE_UNSAFE');
      anchors.push({ path: part, stat }); if (dirname(part) === part) break;
    }
    return { path, anchors };
  }
  #read(bound: Bound) {
    this.#check(bound); const before = exists(bound.path); if (!before) return undefined;
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(MAX_ENVELOPE)
      || relative(bound.path, fs.realpathSync.native(bound.path)) !== '') throw new PrivateError('PRIVATE_FILE_UNSAFE');
    const fd = fs.openSync(bound.path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fs.fstatSync(fd, { bigint: true }); if (!same(before, opened)) throw new PrivateError('PRIVATE_CONFLICT');
      const bytes = Buffer.alloc(Number(before.size) + 1); let length = 0;
      while (length < bytes.length) { const size = fs.readSync(fd, bytes, length, bytes.length - length, null); if (!size) break; length += size; }
      const after = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(bound.path, { bigint: true }); this.#check(bound);
      if (!same(before, after) || !same(before, named) || named.isSymbolicLink() || after.nlink !== 1n || before.size !== after.size
        || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(length) !== after.size) throw new PrivateError('PRIVATE_CONFLICT');
      const source = bytes.subarray(0, length);
      let envelope: Envelope;
      try { envelope = readEnvelope(new TextDecoder('utf-8', { fatal: true }).decode(source)); }
      catch { throw new PrivateError('PRIVATE_ENVELOPE_INVALID'); }
      return { bytes: source, revision: hash(source), stat: after, envelope };
    } finally { fs.closeSync(fd); }
  }
  #handle(id: unknown) {
    if (this.#closed || typeof id !== 'string' || !this.#bound.has(id)) throw new PrivateError('PRIVATE_HANDLE_INVALID');
    return this.#bound.get(id)!;
  }
  bind(path: string, mode: Exclude<PrivateSelectionMode,'export'>): CipherRecord {
    if (this.#closed || !['open', 'create'].includes(mode)) throw new PrivateError('PRIVATE_HANDLE_INVALID');
    const bound = this.#selection(path), current = this.#read(bound);
    if (mode === 'open' && !current || mode === 'create' && current) throw new PrivateError('PRIVATE_FILE_SELECTION_INVALID');
    bound.existed = !!current;
    const handle = randomUUID(); this.#bound.clear(); this.#bound.set(handle, bound);
    return { handle, revision: current?.revision ?? null, envelope: current?.envelope ?? null };
  }
  read(handle: unknown): CipherRecord {
    const bound = this.#handle(handle), current = this.#read(bound);
    if (bound.existed && !current) throw new PrivateError('PRIVATE_CONFLICT');
    if(current)bound.existed=true;
    return { handle: handle as string, revision: current?.revision ?? null, envelope: current?.envelope ?? null };
  }
  snapshotCiphertext(handle:unknown) {
    const bound=this.#handle(handle),current=this.#read(bound);if(!current)throw new PrivateError('PRIVATE_CONFLICT');bound.existed=true;
    return {revision:current.revision,envelope:current.envelope,bytes:Buffer.from(current.bytes)};
  }
  backupDelivery(handle:unknown,bytes:Buffer,guard:()=>void) {
    if(this.#bundle)throw new PrivateError('PRIVATE_FILE_UNSAFE');
    const bound=this.#handle(handle);guard();if(!this.#read(bound))throw new PrivateError('PRIVATE_CONFLICT');
    try { if(bytes.length>MAX_ENVELOPE)throw new Error();readEnvelope(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }catch{throw new PrivateError('PRIVATE_ENVELOPE_INVALID');}
    const revision=hash(bytes),backup={...bound,path:join(dirname(bound.path),`.studio-delivery-backup-${revision}.json`)},previous=this.#read(backup);
    if(previous&&previous.revision!==revision)throw new PrivateError('PRIVATE_BACKUP_INVALID');
    if(!previous&&this.#atomic(backup,bytes,null,guard))throw Object.assign(new PrivateError('PRIVATE_BACKUP_INVALID'),{cleanupPending:true});
    return revision;
  }
  #atomic(bound: Bound, bytes: Buffer, revision: string | null, guard: () => void = () => {}) {
    this.#check(bound);
    const temporary = join(dirname(bound.path), `.studio-private-${randomUUID()}.tmp`);
    let owned: fs.BigIntStats | undefined;
    let fd: number | undefined;
    let committed = false, failure: unknown;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600);
      owned = fs.fstatSync(fd, { bigint: true }); let offset = 0;
      while (offset < bytes.length) { const count = fs.writeSync(fd, bytes, offset, bytes.length - offset); if (!count) throw new PrivateError('PRIVATE_WRITE_FAILED'); offset += count; }
      fs.fsyncSync(fd);
      fs.closeSync(fd); fd = undefined;
      this.#check(bound); const current = this.#read(bound);
      if ((current?.revision ?? null) !== revision) throw new PrivateError('PRIVATE_CONFLICT');
      const staged = fs.lstatSync(temporary, { bigint: true });
      if (!owned || !same(owned, staged) || staged.isSymbolicLink() || staged.nlink !== 1n || !fs.readFileSync(temporary).equals(bytes)) throw new PrivateError('PRIVATE_FILE_UNSAFE');
      guard();
      if (revision === null) fs.linkSync(temporary, bound.path); else fs.renameSync(temporary, bound.path);
      committed = true;
    } catch (error) { failure = error; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
    let cleaned: boolean;
    try {
      this.#check(bound); const left = exists(temporary);
      if (left) { if (!owned || !same(owned, left) || left.isSymbolicLink()) throw new PrivateError('PRIVATE_FILE_UNSAFE'); fs.unlinkSync(temporary); }
      cleaned = true;
    } catch { cleaned = false; }
    if (!committed) {
      const error = failure instanceof PrivateError ? failure : new PrivateError('PRIVATE_WRITE_FAILED');
      error.cleanupPending = !cleaned; throw error;
    }
    return !cleaned;
  }
  save(handle: unknown, expectedRevision: unknown, value: unknown, guard: () => void = () => {}): CipherWrite {
    const bound = this.#handle(handle); guard();
    if (expectedRevision !== null && (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision))) throw new PrivateError('PRIVATE_CONFLICT');
    let bytes: Buffer;
    try { bytes = Buffer.from(JSON.stringify(parseEnvelope(value)), 'utf8'); } catch { throw new PrivateError('PRIVATE_ENVELOPE_INVALID'); }
    if (bytes.length > MAX_ENVELOPE) throw new PrivateError('PRIVATE_ENVELOPE_INVALID');
    const current = this.#read(bound);
    if (bound.existed && !current) throw new PrivateError('PRIVATE_CONFLICT');
    if ((current?.revision ?? null) !== expectedRevision) throw new PrivateError('PRIVATE_CONFLICT');
    if (current && !this.#bundle) {
      const backup: Bound = { ...bound, path: join(dirname(bound.path), `.studio-vault-backup-${current.revision}.json`) };
      const previous = this.#read(backup);
      if (previous && previous.revision !== current.revision) throw new PrivateError('PRIVATE_BACKUP_INVALID');
      if (!previous && this.#atomic(backup, current.bytes, null)) throw Object.assign(new PrivateError('PRIVATE_BACKUP_INVALID'), { cleanupPending: true });
    }
    const cleanupPending = this.#atomic(bound, bytes, expectedRevision as string | null, guard);
    bound.existed = true;
    return { revision: hash(bytes), backupCreated: !!current&&!this.#bundle, cleanupPending };
  }
  close() { this.#closed = true; this.#bound.clear(); }
}
