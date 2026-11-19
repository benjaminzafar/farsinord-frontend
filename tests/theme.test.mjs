import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInitialTheme } from '../src/lib/theme.js';

test('resolveInitialTheme honors explicit saved theme and falls back to system preference', () => {
  assert.equal(resolveInitialTheme({ savedTheme: 'dark', prefersDark: false }), 'dark');
  assert.equal(resolveInitialTheme({ savedTheme: 'light', prefersDark: true }), 'light');
  assert.equal(resolveInitialTheme({ savedTheme: null, prefersDark: true }), 'dark');
  assert.equal(resolveInitialTheme({ savedTheme: null, prefersDark: false }), 'light');
  assert.equal(resolveInitialTheme({ savedTheme: 'invalid', prefersDark: true }), 'dark');
});
