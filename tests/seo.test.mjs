import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANONICAL_ORIGIN,
  buildCanonicalUrl,
  buildSeoJsonLdGraph,
  escapeXml,
  normalizePublicHttpUrl,
  renderCrawlerHtml,
  renderLlmsTxt,
  renderLlmsFullTxt,
  renderRssFeed,
} from '../api/_lib/seoCore.js';
import {
  DEFAULT_INDEXNOW_KEY,
  buildIndexNowPayload,
} from '../api/_lib/indexNow.js';

const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('vercel.json bot rewrites compile as pure JS RegExp and route search/AI bots without intercepting real browsers', () => {
  const botRewrites = (vercelConfig.rewrites || []).filter(
    (r) => Array.isArray(r.has) && r.has.some((h) => h.key === 'user-agent')
  );
  assert.ok(botRewrites.length >= 2, 'Expected bot rewrites for / and /ad/:adRef');

  const botUas = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
    'Googlebot-Image/1.0',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com',
    'Mozilla/5.0 (compatible; Google-Extended)',
    'TelegramBot (like TwitterBot)',
    'WhatsApp/2.23.20.0 A',
  ];

  const humanUas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  ];

  for (const rule of botRewrites) {
    const pattern = rule.has.find((h) => h.key === 'user-agent')?.value;
    assert.ok(pattern && !pattern.includes('(?i)'), 'Vercel header regex must not use (?i)');
    const re = new RegExp(`^${pattern}$`);

    for (const ua of botUas) {
      assert.equal(re.test(ua), true, `Expected full-string pattern to match bot UA: ${ua}`);
    }
    for (const ua of humanUas) {
      assert.equal(re.test(ua), false, `Expected full-string pattern NOT to match human browser UA: ${ua}`);
    }
  }
});

test('buildCanonicalUrl strips tracking/UI params and anchors on canonical domain', () => {
  assert.equal(buildCanonicalUrl({}), `${CANONICAL_ORIGIN}/`);
  assert.equal(
    buildCanonicalUrl({ country: 'de', category: 'bostad', city: 'all' }),
    `${CANONICAL_ORIGIN}/?c=de&cat=bostad`
  );
  assert.equal(
    buildCanonicalUrl({ adRef: 'LS-1234', country: 'se', category: 'jobb' }),
    `${CANONICAL_ORIGIN}/?ad=LS-1234`
  );
  assert.equal(
    buildCanonicalUrl({ page: 'website-builder' }),
    `${CANONICAL_ORIGIN}/?page=website-builder`
  );
});

test('buildSeoJsonLdGraph emits valid Google-compliant entities across listing & ad types with zero PII', () => {
  const sampleAds = [
    {
      id: '111',
      reference_number: 'LS-9001',
      title: 'آپارتمان مبله در استکهلم',
      description: 'یک واحد دوخوابه تمیز نزدیک مترو',
      category: 'bostad',
      country: 'se',
      city: 'Stockholm',
      price: 12500,
      price_type: 'kr',
      images: ['https://cdn.example.com/apt.webp'],
      created_at: '2026-11-10T10:00:00Z',
    },
    {
      id: '222',
      reference_number: 'LS-9002',
      title: 'رستوران سنتی پارس',
      description: 'بهترین کباب و غذاهای اصیل ایرانی در برلین',
      category: 'restaurang',
      country: 'de',
      city: 'Berlin',
      contact_phone: '+49123456789',
      contact_email: 'secret@example.com',
      pin_code: '999999',
      created_at: '2026-11-12T10:00:00Z',
    },
  ];

  const feedGraph = buildSeoJsonLdGraph({ adsList: sampleAds });
  const types = feedGraph['@graph'].map((n) => n['@type']);
  assert.ok(types.includes('Organization'));
  assert.ok(types.includes('WebSite'));
  assert.ok(types.includes('BreadcrumbList'));
  assert.ok(types.includes('CollectionPage'));
  assert.ok(types.includes('FAQPage'));

  const pricedAdGraph = buildSeoJsonLdGraph({
    activeAd: { ...sampleAds[0], category: 'kop-salj', title: 'لپ‌تاپ مک‌بوک پرو' },
  });
  const productNode = pricedAdGraph['@graph'].find((n) => n['@type'] === 'Product');
  assert.ok(productNode?.offers?.price === 12500);
  assert.equal(productNode?.offers?.priceCurrency, 'SEK');

  const unpricedAdGraph = buildSeoJsonLdGraph({
    activeAd: { ...sampleAds[1], category: 'kop-salj', title: 'مبل راحتی دست دوم', price: null },
  });
  assert.equal(unpricedAdGraph['@graph'].some((n) => n['@type'] === 'Product'), false);
  assert.ok(unpricedAdGraph['@graph'].some((n) => n['@type'] === 'Offer'));

  const restGraph = buildSeoJsonLdGraph({ activeAd: sampleAds[1] });
  const restNode = restGraph['@graph'].find((n) => n['@type'] === 'FoodEstablishment');
  assert.equal(restNode?.address?.addressCountry, 'DE');
  assert.equal(JSON.stringify(restGraph).includes('+49123456789'), false);
  assert.equal(JSON.stringify(restGraph).includes('secret@example.com'), false);
  assert.equal(JSON.stringify(restGraph).includes('999999'), false);
});

test('renderCrawlerHtml, renderLlmsTxt, renderLlmsFullTxt, and renderRssFeed escape untrusted text and omit PII', () => {
  const unsafeAd = {
    id: 'ad-1',
    reference_number: 'LS-777',
    title: 'آگهی <script>alert(1)</script> تست',
    description: 'توضیحات آزمایشی درباره محصول خوب & سالم',
    category: 'elektronik',
    country: 'se',
    city: 'Stockholm',
    price: 4500,
    contact_phone: '0701112233',
    contact_email: 'owner@private.test',
    pin_code: '654321',
    images: ['https://cdn.linksho.eu/test.webp'],
    created_at: '2026-11-18T12:00:00Z',
  };

  const html = renderCrawlerHtml({ adsList: [unsafeAd] });
  assert.ok(html.includes('rel="canonical"'));
  assert.ok(html.includes('rel="alternate" type="text/plain" title="LLMs.txt"'));
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('0701112233'), false);
  assert.equal(html.includes('owner@private.test'), false);
  assert.equal(html.includes('654321'), false);

  const llms = renderLlmsTxt({ totalActive: 108, countryCounts: { se: 33 }, categoryCounts: { bostad: 6 } });
  assert.ok(llms.includes('# لینک شو'));
  assert.ok(llms.includes('llms-full.txt'));

  const llmsFull = renderLlmsFullTxt({ ads: [unsafeAd] });
  assert.ok(llmsFull.includes('LS-777'));
  assert.equal(llmsFull.includes('0701112233'), false);
  assert.equal(llmsFull.includes('owner@private.test'), false);

  const rss = renderRssFeed({ ads: [unsafeAd] });
  assert.ok(rss.includes('<rss version="2.0"'));
  assert.ok(rss.includes('&lt;script&gt;'));
  assert.equal(rss.includes('<script>alert(1)</script>'), false);
});

test('buildIndexNowPayload deduplicates valid canonical URLs and rejects foreign origins', () => {
  const payload = buildIndexNowPayload([
    `${CANONICAL_ORIGIN}/`,
    `${CANONICAL_ORIGIN}/?c=se`,
    `${CANONICAL_ORIGIN}/?c=se`,
    'https://evil.example.com/phish',
    '/ad/LS-100',
  ]);
  assert.equal(payload.host, 'www.linksho.eu');
  assert.equal(payload.key, DEFAULT_INDEXNOW_KEY);
  assert.equal(payload.keyLocation, `${CANONICAL_ORIGIN}/${DEFAULT_INDEXNOW_KEY}.txt`);
  assert.deepEqual(payload.urlList, [
    `${CANONICAL_ORIGIN}/`,
    `${CANONICAL_ORIGIN}/?c=se`,
    `${CANONICAL_ORIGIN}/ad/LS-100`,
  ]);
});

test('api/seo.js selects only valid swedpersiska_ads columns and sitemap.js supports index & HEAD', async () => {
  const seoSrc = fs.readFileSync(new URL('../api/seo.js', import.meta.url), 'utf8');
  assert.equal(seoSrc.includes("'currency'"), false, 'swedpersiska_ads does not have a currency column');

  const { default: sitemapHandler } = await import('../api/sitemap.js');
  const makeRes = () => {
    const headers = {};
    let statusCode = 200;
    let body = '';
    return {
      headers,
      get statusCode() { return statusCode; },
      get body() { return body; },
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      status(c) { statusCode = c; return this; },
      send(b) { body = b; return this; },
      end(b) { if (b) body = b; return this; },
    };
  };

  const resIndex = makeRes();
  await sitemapHandler({ method: 'GET', query: { mode: 'index' } }, resIndex);
  assert.equal(resIndex.statusCode, 200);
  assert.equal(resIndex.headers['content-type'], 'application/xml; charset=utf-8');
  assert.ok(resIndex.headers['last-modified'], 'Expected Last-Modified header');
  assert.ok(Number(resIndex.headers['content-length']) > 100, 'Expected Content-Length header');
  assert.ok(resIndex.body.includes('<sitemapindex'));
  assert.ok(resIndex.body.includes(`${CANONICAL_ORIGIN}/sitemap-static.xml`));
  assert.ok(resIndex.body.includes(`${CANONICAL_ORIGIN}/sitemap-ads.xml`));

  const resHead = makeRes();
  await sitemapHandler({ method: 'HEAD', query: { mode: 'index' } }, resHead);
  assert.equal(resHead.statusCode, 200);
  assert.equal(resHead.body, '');
  assert.ok(Number(resHead.headers['content-length']) > 100);

  const resPost = makeRes();
  await sitemapHandler({ method: 'POST', query: {} }, resPost);
  assert.equal(resPost.statusCode, 405);

  assert.equal(vercelConfig.cleanUrls, undefined, 'cleanUrls must not break /index.html SPA rewrite');
  assert.equal(escapeXml('hello\u0000\u0008<world>&"x"'), 'hello&lt;world&gt;&amp;&quot;x&quot;');
  assert.equal(normalizePublicHttpUrl('  https://cdn.linksho.eu/my photo.jpg  '), 'https://cdn.linksho.eu/my%20photo.jpg');
  assert.equal(normalizePublicHttpUrl('javascript:alert(1)'), null);
});
