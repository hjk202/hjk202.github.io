export class PrivateError extends Error {
  cleanupPending = false;
  constructor(code: string) { super(code); }
}
