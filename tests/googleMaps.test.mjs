import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeGoogleMapsKey,
  buildGoogleMapsQuery,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
} from '../src/lib/googleMaps.js';

test('sanitizeGoogleMapsKey accepts valid AIza keys and rejects malformed or injected keys', () => {
  const valid = 'AIzaSyD-1234567890_abcdefghijklmno';
  assert.equal(sanitizeGoogleMapsKey(`  ${valid}\n\u200B `), valid);
  assert.equal(sanitizeGoogleMapsKey(''), '');
  assert.equal(sanitizeGoogleMapsKey('not-a-google-key'), '');
  assert.equal(sanitizeGoogleMapsKey('AIzaTooShort'), '');
  assert.equal(sanitizeGoogleMapsKey(`${valid}&evil=1`), '');
});

test('buildGoogleMapsQuery combines area, city, and English country name cleanly without duplication', () => {
  assert.equal(
    buildGoogleMapsQuery({ area: 'Södermalm', city: 'Stockholm', country: 'se' }),
    'Södermalm, Stockholm, Sweden'
  );
  assert.equal(
    buildGoogleMapsQuery({ area: 'Stockholm Centrum', city: 'Stockholm', country: 'se' }),
    'Stockholm Centrum, Sweden'
  );
  assert.equal(
    buildGoogleMapsQuery({ area: '', city: 'Göteborg', country: 'se' }),
    'Göteborg, Sweden'
  );
  assert.equal(
    buildGoogleMapsQuery({ area: '<script>\nKista\r\n', city: 'Stockholm', country: 'se' }),
    'script Kista, Stockholm, Sweden'
  );
});

test('buildGoogleMapsEmbedUrl honors kill-switch, zero-key free fallback, and official Embed API v1', () => {
  assert.equal(
    buildGoogleMapsEmbedUrl({
      query: 'Stockholm, Sweden',
      country: 'se',
      hasArea: false,
      settings: { enabled: false, embedApiKey: '' },
    }),
    null
  );

  const freeUrl = buildGoogleMapsEmbedUrl({
    query: 'Södermalm, Stockholm, Sweden',
    country: 'se',
    hasArea: true,
    settings: { enabled: true, embedApiKey: '', defaultZoom: 15 },
  });
  const parsedFree = new URL(freeUrl);
  assert.equal(parsedFree.origin, 'https://maps.google.com');
  assert.equal(parsedFree.searchParams.get('q'), 'Södermalm, Stockholm, Sweden');
  assert.equal(parsedFree.searchParams.get('output'), 'embed');
  assert.equal(parsedFree.searchParams.get('z'), '15');

  const key = 'AIzaSyD-1234567890_abcdefghijklmno';
  const officialUrl = buildGoogleMapsEmbedUrl({
    query: 'Stockholm, Sweden',
    country: 'se',
    hasArea: false,
    settings: { enabled: true, embedApiKey: key, defaultZoom: 15 },
  });
  const parsedOfficial = new URL(officialUrl);
  assert.equal(parsedOfficial.origin, 'https://www.google.com');
  assert.equal(parsedOfficial.pathname, '/maps/embed/v1/place');
  assert.equal(parsedOfficial.searchParams.get('key'), key);
  assert.equal(parsedOfficial.searchParams.get('region'), 'SE');
  assert.equal(parsedOfficial.searchParams.get('zoom'), '12'); // City-only caps zoom to 12
});

test('buildGoogleMapsSearchUrl encodes query safely via URLSearchParams', () => {
  const searchUrl = buildGoogleMapsSearchUrl('Södermalm & Vasastan, Stockholm, Sweden');
  const parsed = new URL(searchUrl);
  assert.equal(parsed.origin, 'https://www.google.com');
  assert.equal(parsed.pathname, '/maps/search/');
  assert.equal(parsed.searchParams.get('api'), '1');
  assert.equal(parsed.searchParams.get('query'), 'Södermalm & Vasastan, Stockholm, Sweden');
});
