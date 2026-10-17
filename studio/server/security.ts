import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { STUDIO_TOKEN_HEADER } from '../contracts/http.ts';

export const newSessionToken = (): string => randomBytes(32).toString('hex');

/** Reject duplicates instead of relying on Node's header merging/discarding rules. */
export function singleHeader(request: IncomingMessage, name: string): string | undefined {
  const values: string[] = [];
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    if (request.rawHeaders[i]!.toLowerCase() === name.toLowerCase()) values.push(request.rawHeaders[i + 1]!);
  }
  return values.length === 1 ? values[0] : undefined;
}

export function allowedSource(request: IncomingMessage, origin: string): boolean {
  for (const field of ['host', 'origin', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest']) {
    if (request.rawHeaders.filter((name, i) => i % 2 === 0 && name.toLowerCase() === field).length > 1) return false;
  }
  if (singleHeader(request, 'host') !== origin.slice('http://'.length)) return false;
  const hasOrigin = request.rawHeaders.some((name, i) => i % 2 === 0 && name.toLowerCase() === 'origin');
  if (hasOrigin && singleHeader(request, 'origin') !== origin) return false;
  const site = singleHeader(request, 'sec-fetch-site');
  return site === undefined || site === 'none' || site === 'same-origin';
}

export function authenticated(request: IncomingMessage, token: string): boolean {
  const supplied = singleHeader(request, STUDIO_TOKEN_HEADER);
  return typeof supplied === 'string' && /^[a-f0-9]{64}$/.test(supplied)
    && timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(token, 'hex'));
}

/** A pairing document, never a cross-site resource or embedded frame. No CORS is granted. */
export function allowedPairing(request: IncomingMessage): boolean {
  const site = singleHeader(request, 'sec-fetch-site');
  const mode = singleHeader(request, 'sec-fetch-mode');
  const dest = singleHeader(request, 'sec-fetch-dest');
  // Node fetch sends mode:cors but no site/dest. Local programmatic pairing remains usable.
  return (site === undefined && dest === undefined) || (mode === 'navigate' && dest === 'document');
}
