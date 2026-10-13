/** Inputs are logical site paths, never paths already prefixed with the deployment base. */
export function withBase(path: string, base = '/'): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path) || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`Invalid logical site path: ${path}`);
  }
  const prefix = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  return `${prefix}${path}`;
}
