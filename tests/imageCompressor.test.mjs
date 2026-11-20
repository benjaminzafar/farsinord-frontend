import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  DEFAULT_TARGET_BYTES,
  computeScaledDimensions,
  chooseBestCompressedCandidate,
  compressImageForUpload,
} from '../src/lib/imageCompressor.js';
import handler, {
  MAX_FILE_BYTES,
  createR2PresignedPutUrl,
} from '../api/upload.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

test('enforces strict 1 MB constant across compressor and upload endpoint', () => {
  assert.equal(MAX_IMAGE_BYTES, 1048576);
  assert.equal(MAX_FILE_BYTES, 1048576);
  assert.equal(DEFAULT_TARGET_BYTES, 280 * 1024);
});

test('computeScaledDimensions scales down proportionally without upscaling', () => {
  assert.deepEqual(computeScaledDimensions(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(computeScaledDimensions(3000, 6000, 1600), { width: 800, height: 1600 });
  assert.deepEqual(computeScaledDimensions(1200, 900, 1600), { width: 1200, height: 900 });
});

test('chooseBestCompressedCandidate enforces <= 1 MB and prefers best quality under targetBytes', () => {
  const picked = chooseBestCompressedCandidate([
    { size: 1_500_000, width: 1600, height: 1200, quality: 0.9, mimeType: 'image/webp' },
    { size: 220_000, width: 1600, height: 1200, quality: 0.78, mimeType: 'image/webp' },
    { size: 150_000, width: 1280, height: 960, quality: 0.72, mimeType: 'image/webp' },
  ]);
  assert.equal(picked.size, 220_000);

  const smallestUnderMax = chooseBestCompressedCandidate([
    { size: 1_200_000, width: 1600, height: 1200, quality: 0.84, mimeType: 'image/webp' },
    { size: 920_000, width: 1280, height: 960, quality: 0.74, mimeType: 'image/webp' },
    { size: 610_000, width: 960, height: 720, quality: 0.58, mimeType: 'image/webp' },
  ]);
  assert.equal(smallestUnderMax.size, 610_000);

  const allOverMax = chooseBestCompressedCandidate([
    { size: 1_048_577, width: 960, height: 720, quality: 0.5 },
  ]);
  assert.equal(allOverMax, null);
});

test('compressImageForUpload rejects non-images and enforces 1 MB on SVG/icon passthrough', async () => {
  const nonImage = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
  await assert.rejects(() => compressImageForUpload(nonImage), /فقط فایل‌های تصویری/);

  const bigSvg = new File([new Uint8Array(MAX_IMAGE_BYTES + 50)], 'big.svg', { type: 'image/svg+xml' });
  await assert.rejects(
    () => compressImageForUpload(bigSvg, { allowVectorPassthrough: true }),
    /۱ مگابایت/
  );

  const smallSvg = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
  const passed = await compressImageForUpload(smallSvg, { allowVectorPassthrough: true });
  assert.equal(passed, smallSvg);
});

test('createR2PresignedPutUrl signs content-length;content-type;host when contentLength is provided', () => {
  const signedUrl = createR2PresignedPutUrl({
    accountId: 'acc123',
    accessKeyId: 'key123',
    secretAccessKey: 'sec123',
    bucketName: 'farsinord',
    objectKey: 'ads/2026/11/test.webp',
    contentType: 'image/webp',
    contentLength: 245760,
  });
  const parsed = new URL(signedUrl);
  assert.equal(parsed.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  assert.ok(parsed.searchParams.get('X-Amz-Signature'));
});

test('upload handler rejects file sizes above 1 MB or non-integer sizes with HTTP 400', async () => {
  const overRes = createMockRes();
  await handler(
    {
      method: 'POST',
      headers: { origin: 'https://www.linksho.eu' },
      body: { contentType: 'image/webp', fileSize: MAX_FILE_BYTES + 1 },
    },
    overRes
  );
  assert.equal(overRes.statusCode, 400);
  assert.equal(overRes.body.ok, false);

  const floatRes = createMockRes();
  await handler(
    {
      method: 'POST',
      headers: { origin: 'https://www.linksho.eu' },
      body: { contentType: 'image/webp', fileSize: 1234.5 },
    },
    floatRes
  );
  assert.equal(floatRes.statusCode, 400);
  assert.equal(floatRes.body.ok, false);

  const bigB64Res = createMockRes();
  const oversizedBase64 = Buffer.alloc(MAX_FILE_BYTES + 10).toString('base64');
  await handler(
    {
      method: 'POST',
      headers: { origin: 'https://www.linksho.eu' },
      body: { contentType: 'image/webp', fileBase64: oversizedBase64 },
    },
    bigB64Res
  );
  assert.equal(bigB64Res.statusCode, 400);
  assert.equal(bigB64Res.body.ok, false);
});
