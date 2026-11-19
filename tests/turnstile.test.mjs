import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDFLARE_TEST_SITEKEY,
  sanitizeTurnstileSiteKey,
  validateTurnstileLiveSiteKey,
  resolveTurnstileSiteKey,
  formatTurnstileError,
} from '../src/lib/turnstileConfig.js';

test('sanitizeTurnstileSiteKey strips whitespace and invisible zero-width chars', () => {
  const dirty = '  \u200B0x4AAAAAAGHicCBbrB3mLQbs\uFEFF\n ';
  assert.equal(sanitizeTurnstileSiteKey(dirty), '0x4AAAAAAGHicCBbrB3mLQbs');
});

test('validateTurnstileLiveSiteKey accepts valid 24-char Site Key and rejects Secret Key or empty', () => {
  const valid = validateTurnstileLiveSiteKey(' 0x4AAAAAAGHicCBbrB3mLQbs ');
  assert.equal(valid.ok, true);
  assert.equal(valid.cleaned, '0x4AAAAAAGHicCBbrB3mLQbs');

  const secretLike = validateTurnstileLiveSiteKey('0x4AAAAAAGHicCE1234567890abcdefghijk');
  assert.equal(secretLike.ok, false);
  assert.match(secretLike.error, /کلید محرمانه|Secret Key/);

  const empty = validateTurnstileLiveSiteKey('   ');
  assert.equal(empty.ok, false);

  const garbage = validateTurnstileLiveSiteKey('bad key!');
  assert.equal(garbage.ok, false);
});

test('resolveTurnstileSiteKey ignores stale localStorage when mode is explicit', () => {
  const staleStored = { mode: 'live', siteKey: '0x4OLD_STALE_KEY_123456' };

  assert.equal(
    resolveTurnstileSiteKey({
      mode: 'test',
      siteKey: '0x4AAAAAAGHicCBbrB3mLQbs',
      storedSettings: staleStored,
    }),
    CLOUDFLARE_TEST_SITEKEY
  );

  assert.equal(
    resolveTurnstileSiteKey({
      mode: 'live',
      siteKey: ' 0x4AAAAAAGHicCBbrB3mLQbs\u200B ',
      storedSettings: staleStored,
    }),
    '0x4AAAAAAGHicCBbrB3mLQbs'
  );

  assert.equal(
    resolveTurnstileSiteKey({
      mode: 'live',
      siteKey: '',
      storedSettings: staleStored,
    }),
    ''
  );
});

test('formatTurnstileError surfaces clear Persian explanations for Cloudflare codes', () => {
  assert.match(formatTurnstileError('110200'), /Hostname Management/);
  assert.match(formatTurnstileError('400020'), /400020/);
  assert.match(formatTurnstileError('110100'), /110100/);
});
