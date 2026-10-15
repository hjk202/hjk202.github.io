import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passphraseIssue } from '../../src/core/vault/passphrase.ts';
import { encryptVault, decryptVault } from '../../src/core/vault/crypto.ts';

test('passphrases preserve ordinary Unicode, symbols and spaces within the UTF-8 byte limit', () => {
  for (const value of ['Letters0123456789', 'punctuation-_<script>"\'!@#$%^&*()', '  spaced words  ', '中文口令与😀符号', 'e\u0301', 'a'.repeat(1024), '界'.repeat(341)]) {
    assert.equal(passphraseIssue(value), undefined);
  }
  assert.equal(passphraseIssue(''), 'empty');
  for (const value of ['a'.repeat(1025), '界'.repeat(342)]) assert.equal(passphraseIssue(value), 'too-long');
});

test('controls, invisible formatting, separators and lone surrogates are rejected rather than stripped', () => {
  for (const value of ['\0', '\t', '\r', '\n', '\u001b', '\u007f', '\u0085', '\u200b', '\u202e', '\u2028', '\u2029', '\ud800']) {
    assert.equal(passphraseIssue(`safe${value}text`), 'unsupported-character');
  }
});

test('crypto boundary rejects unsupported inputs and preserves literal punctuation and whitespace', async () => {
  const payload = { version: 1, modules: {}, assets: {} };
  const password = '  <script>!literal-字面口令  ';
  const envelope = await encryptVault(payload, password);
  assert.deepEqual(await decryptVault(envelope, password), payload);
  await assert.rejects(decryptVault(envelope, password.trim()));
  for (const value of ['bad\0input-with-length', 'invisible-\u200b-secret', 'a'.repeat(1025), '界'.repeat(342)]) {
    await assert.rejects(encryptVault(payload, value));
    await assert.rejects(decryptVault(envelope, value));
  }
});
