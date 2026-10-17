import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import type { EditorErrorCode } from '../../contracts/think.ts';

/** Author-tool resource boundary, not an additional public website schema rule. */
export const MAX_THINK_SOURCE_BYTES = 16 * 1024 * 1024;

export class ThinkFileError extends Error {
  readonly code: EditorErrorCode;
  cleanupPending = false;
  constructor(code: EditorErrorCode) {
    super(code);
    this.code = code;
  }
}

export const revisionOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export const keyOf = (fileName: string): string => revisionOf(Buffer.from(`think\0${fileName}`, 'utf8'));
const sameFile = (a: fs.BigIntStats, b: fs.BigIntStats): boolean => a.dev === b.dev && a.ino === b.ino;
const errno = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | null)?.code;

/** Apply Windows rules on every host so a repository remains portable. */
export function allowedThinkFileName(name: string): boolean {
  return name.length <= 255 && name.trim() === name && !name.startsWith('.') && name.endsWith('.md')
    && !/[<>:"/\\|?*]/.test(name) && Array.from(name).every(character => character.charCodeAt(0) >= 32) && !/[. ]$/.test(name)
    && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name);
}

export interface ThinkSourceFile {
  fileName: string;
  bytes: Buffer;
  revision: string;
  stat: fs.BigIntStats;
}

/** Trusted backend only: callers supply a repository root, never a content path. */
export class ThinkFiles {
  private readonly root: string;
  private readonly content: string;
  private readonly lock: string;
  private readonly lease = JSON.stringify({ version: 1, pid: process.pid, token: randomUUID() });
  private readonly anchors: { path: string; stat: fs.BigIntStats }[] = [];
  private lockStat: fs.BigIntStats;
  private closed = false;

  constructor(repositoryRoot: string) {
    this.root = resolve(repositoryRoot);
    this.content = join(this.root, 'src', 'modules', 'think', 'content');
    this.lock = join(this.root, '.cache', 'studio', 'think-authoring.lock');
    this.anchor(this.root);
    for (const part of ['src', 'src/modules', 'src/modules/think', 'src/modules/think/content']) this.anchor(join(this.root, part));
    for (const part of ['.cache', '.cache/studio']) {
      this.checkAnchors();
      const directory = join(this.root, part);
      try { fs.mkdirSync(directory); } catch (error) { if (errno(error) !== 'EEXIST') throw error; }
      this.anchor(directory);
    }
    let fd: number;
    try { fd = fs.openSync(this.lock, 'wx', 0o600); }
    catch (error) { if (errno(error) === 'EEXIST') throw new ThinkFileError('AUTHORING_BUSY'); throw error; }
    try { this.lockStat = fs.fstatSync(fd, { bigint: true }); }
    catch {
      fs.closeSync(fd);
      throw Object.assign(new ThinkFileError('FILE_OPERATION_FAILED'), { cleanupPending: true });
    }
    try {
      this.writeAll(fd, Buffer.from(this.lease));
      fs.fsyncSync(fd);
    } catch (error) {
      fs.closeSync(fd);
      this.cleanup(this.lock, this.lockStat);
      throw error;
    }
    fs.closeSync(fd);
  }

  private anchor(path: string): void {
    const stat = fs.lstatSync(path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || relative(path, fs.realpathSync.native(path)) !== '') throw new ThinkFileError('PROTECTED_PATH');
    this.anchors.push({ path, stat });
  }

  private checkAnchors(): void {
    for (const anchor of this.anchors) {
      let stat: fs.BigIntStats;
      try { stat = fs.lstatSync(anchor.path, { bigint: true }); }
      catch { throw new ThinkFileError('PROTECTED_PATH'); }
      if (!stat.isDirectory() || stat.isSymbolicLink() || !sameFile(stat, anchor.stat)
        || relative(anchor.path, fs.realpathSync.native(anchor.path)) !== '') throw new ThinkFileError('PROTECTED_PATH');
    }
  }

  assertLease(): void {
    if (this.closed) throw new ThinkFileError('SERVICE_CLOSED');
    this.checkAnchors();
    const current = this.readRegular(this.lock, 512);
    if (!sameFile(current.stat, this.lockStat) || current.bytes.toString('utf8') !== this.lease) throw new ThinkFileError('AUTHORING_BUSY');
  }

  private target(fileName: string): string {
    this.assertLease();
    if (!allowedThinkFileName(fileName)) throw new ThinkFileError('PROTECTED_PATH');
    const target = join(this.content, fileName);
    if (relative(this.content, target) !== fileName) throw new ThinkFileError('PROTECTED_PATH');
    return target;
  }

  names(): string[] {
    this.assertLease();
    return fs.readdirSync(this.content).sort();
  }

  private readRegular(path: string, limit: number): { bytes: Buffer; stat: fs.BigIntStats } {
    const before = fs.lstatSync(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || relative(path, fs.realpathSync.native(path)) !== '') throw new ThinkFileError('PROTECTED_PATH');
    if (before.size > BigInt(limit)) throw new ThinkFileError('UNSUPPORTED_FORMAT');
    const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fs.fstatSync(fd, { bigint: true });
      if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1n) throw new ThinkFileError('PROTECTED_PATH');
      const bytes = Buffer.alloc(Number(before.size) + 1);
      let length = 0;
      while (length < bytes.length) {
        const read = fs.readSync(fd, bytes, length, bytes.length - length, null);
        if (!read) break;
        length += read;
      }
      const after = fs.fstatSync(fd, { bigint: true });
      const named = fs.lstatSync(path, { bigint: true });
      if (!sameFile(before, after) || !sameFile(before, named) || named.isSymbolicLink() || after.nlink !== 1n
        || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(length) !== after.size) throw new ThinkFileError('REVISION_CONFLICT');
      return { bytes: bytes.subarray(0, length), stat: after };
    } finally { fs.closeSync(fd); }
  }

  read(fileName: string): ThinkSourceFile {
    const target = this.target(fileName);
    const value = this.readRegular(target, MAX_THINK_SOURCE_BYTES);
    this.assertLease();
    return { fileName, ...value, revision: revisionOf(value.bytes) };
  }

  private assertTarget(expected: ThinkSourceFile): void {
    let current: ThinkSourceFile;
    try { current = this.read(expected.fileName); }
    catch (error) { if (errno(error) === 'ENOENT') throw new ThinkFileError('REVISION_CONFLICT'); throw error; }
    if (current.revision !== expected.revision || !sameFile(current.stat, expected.stat)) throw new ThinkFileError('REVISION_CONFLICT');
  }

  private writeAll(fd: number, bytes: Buffer): void {
    let offset = 0;
    while (offset < bytes.length) {
      const length = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!length) throw new ThinkFileError('FILE_OPERATION_FAILED');
      offset += length;
    }
  }

  /** Never follow a replaced directory/link while cleaning an owned temporary. */
  private cleanup(path: string, owned: fs.BigIntStats): boolean {
    try {
      this.checkAnchors();
      const stat = fs.lstatSync(path, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || !sameFile(stat, owned)) return false;
      fs.unlinkSync(path);
      return true;
    } catch (error) { return errno(error) === 'ENOENT'; }
  }

  write(fileName: string, text: string, expected: ThinkSourceFile | null, finalCheck: () => void): boolean {
    if (expected && expected.fileName !== fileName) throw new ThinkFileError('PROTECTED_PATH');
    const target = this.target(fileName);
    const bytes = Buffer.from(text, 'utf8');
    if (bytes.length > MAX_THINK_SOURCE_BYTES) throw new ThinkFileError('UNSUPPORTED_FORMAT');
    if (expected && bytes.equals(expected.bytes)) {
      finalCheck();
      this.assertTarget(expected);
      return false;
    }
    const temporary = join(this.content, `.studio-think-${randomUUID()}.tmp`);
    const fd = fs.openSync(temporary, 'wx', expected ? Number(expected.stat.mode & 0o777n) : 0o600);
    let owned: fs.BigIntStats;
    try { owned = fs.fstatSync(fd, { bigint: true }); }
    catch {
      fs.closeSync(fd);
      throw Object.assign(new ThinkFileError('FILE_OPERATION_FAILED'), { cleanupPending: true });
    }
    let committed = false;
    let failure: unknown;
    try {
      try { this.writeAll(fd, bytes); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      finalCheck();
      this.assertLease();
      const staged = this.readRegular(temporary, MAX_THINK_SOURCE_BYTES);
      if (!sameFile(staged.stat, owned) || !staged.bytes.equals(bytes)) throw new ThinkFileError('REVISION_CONFLICT');
      this.assertLease();
      if (expected) {
        this.assertTarget(expected);
        fs.renameSync(temporary, target);
      } else {
        // Hard-link creation is atomic and fails if any target already exists.
        fs.linkSync(temporary, target);
      }
      committed = true;
    } catch (error) { failure = error; }
    const cleaned = this.cleanup(temporary, owned);
    if (!committed) {
      const error = failure instanceof ThinkFileError ? failure : new ThinkFileError(errno(failure) === 'EEXIST' ? 'FILE_EXISTS' : 'FILE_OPERATION_FAILED');
      error.cleanupPending = !cleaned;
      throw error;
    }
    return !cleaned;
  }

  remove(expected: ThinkSourceFile, finalCheck: () => void): void {
    finalCheck();
    this.assertTarget(expected);
    fs.unlinkSync(this.target(expected.fileName));
  }

  close(): void {
    if (this.closed) return;
    this.assertLease();
    fs.unlinkSync(this.lock);
    this.closed = true;
  }
}
