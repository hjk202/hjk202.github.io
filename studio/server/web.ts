import fs from 'node:fs';
import { join, resolve } from 'node:path';

export interface StudioWeb {
  template: string;
  assets: ReadonlyMap<string, { bytes: Buffer; contentType: string }>;
}

/** Trusted build directory only. Read three explicit ordinary files; never serve a directory tree. */
export function loadStudioWeb(directory: string): StudioWeb {
  const root = resolve(directory);
  const directoryStat = fs.lstatSync(root);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory() || fs.realpathSync(root) !== root) throw new Error('Studio Web build unavailable');
  function read(name: string): Buffer {
    const path = join(root, name), stat = fs.lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 2 * 1024 * 1024 || fs.realpathSync(path) !== path) throw new Error('Studio Web build unavailable');
    return fs.readFileSync(path);
  }
  const template = read('index.html').toString('utf8');
  if (template.split('<!--studio-session-->').length !== 2) throw new Error('Studio Web build unavailable');
  return { template, assets: new Map([
    ['/studio-assets/main.js', { bytes: read('main.js'), contentType: 'text/javascript; charset=utf-8' }],
    ['/studio-assets/style.css', { bytes: read('style.css'), contentType: 'text/css; charset=utf-8' }],
  ]) };
}
