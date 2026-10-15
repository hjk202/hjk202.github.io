export const MAX_PASSPHRASE_BYTES = 1024;

/** Validate literal password data. Never trim, normalize, truncate or interpret it. */
export function passphraseIssue(password: string): 'empty' | 'too-long' | 'unsupported-character' | undefined {
  if (!password.length) return 'empty';
  // Bound work before encoding; UTF-8 is never shorter than this UTF-16 length.
  if (password.length > MAX_PASSPHRASE_BYTES || new TextEncoder().encode(password).length > MAX_PASSPHRASE_BYTES) return 'too-long';
  // Printable Unicode letters, marks, numbers, punctuation, symbols and spaces.
  if (/[^\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]/u.test(password)) return 'unsupported-character';
}
