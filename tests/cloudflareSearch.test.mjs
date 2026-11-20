import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUsableAdChunk,
  mapCloudflareChunkToAd,
  searchWithCloudflareAi,
  clearCloudflareSearchCache,
  CLOUDFLARE_SEARCH_ENDPOINT,
} from '../src/lib/cloudflareSearch.js';

const MOCK_AD_CHUNK = {
  id: 'chunk_vanak_1',
  type: 'text',
  score: 0.98,
  text: '---\ntitle: رستوران ایرانی ونک (Restaurang Vanak) – شیستا استکهلم\ndescription: انواع کباب ایرانی، چلوکباب کوبیده و غذای خانگی با گوشت حلال در محیطی دلنشین.\nimage: https://images.unsplash.com/photo-1544025162-d76694265947\n---\n\n# رستوران ایرانی ونک\n\nکشور: سوئد | شهر: استکهلم | دسته‌بندی: رستوران\n\nانواع کباب ایرانی...',
  item: {
    key: 'https://www.linksho.eu/?c=se&cat=restaurang&city=Stockholm&ad=SP-2611-1002',
    timestamp: 1795140000000,
    metadata: {
      title: 'رستوران ایرانی ونک (Restaurang Vanak) | سوئد | لینک شو',
      description: 'انواع کباب ایرانی، چلوکباب کوبیده و غذای خانگی با گوشت حلال در محیطی دلنشین.',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947',
      chunk_modality: 'text',
    },
  },
};

const MOCK_HOMEPAGE_CHUNK = {
  id: 'chunk_home_1',
  type: 'text',
  score: 0.85,
  text: '# نیازمندی‌های فارسی‌زبانان سوئد\nمسکن، رستوران، خدمات و کاریابی در سراسر سوئد',
  item: {
    key: 'https://www.linksho.eu/',
    metadata: {
      title: 'لینک شو سوئد | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در سوئد',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در سوئد',
    },
  },
};

const MOCK_SITEMAP_CHUNK = {
  id: 'chunk_sitemap_1',
  type: 'text',
  score: 0.5,
  text: 'https://www.linksho.eu/sitemap-static.xml',
  item: {
    key: 'https://www.linksho.eu/sitemap-index.xml',
  },
};

test('isUsableAdChunk accepts valid ad chunks and rejects homepage & sitemaps', () => {
  assert.equal(isUsableAdChunk(MOCK_AD_CHUNK), true);
  assert.equal(isUsableAdChunk(MOCK_HOMEPAGE_CHUNK), false);
  assert.equal(isUsableAdChunk(MOCK_SITEMAP_CHUNK), false);
  assert.equal(isUsableAdChunk(null), false);
  assert.equal(isUsableAdChunk({}), false);
});

test('mapCloudflareChunkToAd correctly transforms Cloudflare chunk into Linksho ad structure', () => {
  const ad = mapCloudflareChunkToAd(MOCK_AD_CHUNK);
  assert.ok(ad);
  assert.equal(ad.id, 'SP-2611-1002');
  assert.equal(ad.reference_number, 'SP-2611-1002');
  assert.equal(ad.title, 'رستوران ایرانی ونک (Restaurang Vanak)');
  assert.equal(ad.category, 'restaurang');
  assert.equal(ad.city, 'Stockholm');
  assert.equal(ad.country, 'se');
  assert.equal(ad.images.length, 1);
  assert.equal(ad.images[0], 'https://images.unsplash.com/photo-1544025162-d76694265947');
  assert.equal(ad._isSummary, true);
  assert.equal(ad._source, 'cloudflare_ai');
});

test('mapCloudflareChunkToAd respects country and category filters', () => {
  // Matching filters pass
  assert.ok(mapCloudflareChunkToAd(MOCK_AD_CHUNK, { country: 'se', category: 'restaurang' }));

  // Mismatched country rejects
  assert.equal(mapCloudflareChunkToAd(MOCK_AD_CHUNK, { country: 'no' }), null);

  // Mismatched category rejects
  assert.equal(mapCloudflareChunkToAd(MOCK_AD_CHUNK, { category: 'bostad' }), null);

  // 'all' passes
  assert.ok(mapCloudflareChunkToAd(MOCK_AD_CHUNK, { country: 'all', category: 'all' }));
});

test('searchWithCloudflareAi returns null on empty query, network failure, or HTTP errors', async () => {
  clearCloudflareSearchCache();

  // 1. Empty or whitespace query
  assert.equal(await searchWithCloudflareAi({ query: '' }), null);
  assert.equal(await searchWithCloudflareAi({ query: '   ' }), null);

  // 2. HTTP Error (e.g. simulated 500)
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Server error', { status: 500 });
    const res500 = await searchWithCloudflareAi({ query: 'کباب', timeoutMs: 100 });
    assert.equal(res500, null);

    // 3. Rate limiting (429)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
    const res429 = await searchWithCloudflareAi({ query: 'کباب', timeoutMs: 100 });
    assert.equal(res429, null);

    // 4. Network throw / AbortError
    globalThis.fetch = async () => { throw new Error('Network offline'); };
    const resNetErr = await searchWithCloudflareAi({ query: 'کباب', timeoutMs: 100 });
    assert.equal(resNetErr, null);

    // 5. Empty chunks
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, result: { chunks: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const resEmpty = await searchWithCloudflareAi({ query: 'کباب', timeoutMs: 100 });
    assert.equal(resEmpty, null);

    // 6. Only non-ad chunks (e.g. homepage chunk)
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, result: { chunks: [MOCK_HOMEPAGE_CHUNK] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const resNonAd = await searchWithCloudflareAi({ query: 'لینک شو', timeoutMs: 100 });
    assert.equal(resNonAd, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('searchWithCloudflareAi succeeds on valid ad chunks and uses in-memory cache on repeat query', async () => {
  clearCloudflareSearchCache();
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;

  try {
    globalThis.fetch = async () => {
      networkCalls++;
      return new Response(JSON.stringify({
        success: true,
        result: {
          chunks: [MOCK_AD_CHUNK],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const first = await searchWithCloudflareAi({ query: 'ونک', country: 'se' });
    assert.ok(first);
    assert.equal(first.ok, true);
    assert.equal(first.source, 'cloudflare_ai');
    assert.equal(first.ads.length, 1);
    assert.equal(first.ads[0].reference_number, 'SP-2611-1002');
    assert.equal(networkCalls, 1);

    // Repeat query hits in-memory cache, zero network calls!
    const second = await searchWithCloudflareAi({ query: 'ونک', country: 'se' });
    assert.ok(second);
    assert.equal(networkCalls, 1); // still 1, no second network call!
    assert.equal(second.ads[0].title, 'رستوران ایرانی ونک (Restaurang Vanak)');
  } finally {
    globalThis.fetch = originalFetch;
    clearCloudflareSearchCache();
  }
});

test('CLOUDFLARE_SEARCH_ENDPOINT defaults strictly to https://search.linksho.eu/search', () => {
  assert.equal(CLOUDFLARE_SEARCH_ENDPOINT, 'https://search.linksho.eu/search');
});
