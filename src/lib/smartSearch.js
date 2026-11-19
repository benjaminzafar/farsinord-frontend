// Fast, zero-lag Google-style smart search with Persian/Arabic normalization, WeakMap token cache & typo tolerance

const NON_WORD_RE = /[^a-z0-9\u0600-\u06FF]+/;
const adSearchCache = new WeakMap();
const entitySearchCache = new WeakMap();

let lastRawQuery = null;
let lastNormQuery = '';
let lastQueryTokens = [];

export function normalizeSearchText(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u200C]/g, '') // strip Arabic diacritics & ZWNJ
    .replace(/[أإآ]/g, 'ا')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function getParsedQuery(rawQuery) {
  if (rawQuery === lastRawQuery) {
    return { normQuery: lastNormQuery, queryTokens: lastQueryTokens };
  }
  const normQuery = normalizeSearchText(rawQuery);
  const queryTokens = normQuery ? normQuery.split(' ').filter(Boolean) : [];
  lastRawQuery = rawQuery;
  lastNormQuery = normQuery;
  lastQueryTokens = queryTokens;
  return { normQuery, queryTokens };
}

function getAdSearchIndex(ad) {
  if (!ad || typeof ad !== 'object') {
    return { haystack: '', haystackWords: [], rawTitle: '', normTitle: '', titleWords: [] };
  }
  const stamp = `${ad.updated_at || ''}|${ad.sort_timestamp || ''}|${ad.title || ''}|${ad.description?.length || 0}`;
  const cached = adSearchCache.get(ad);
  if (cached && cached.stamp === stamp) return cached;

  const haystack = normalizeSearchText(
    [ad.title, ad.title_fa, ad.description, ad.city, ad.area, ad.reference_number].filter(Boolean).join(' ')
  );
  const haystackWords = haystack ? haystack.split(NON_WORD_RE).filter(Boolean) : [];
  const rawTitle = (ad.title_fa || ad.title || '').trim();
  const normTitle = normalizeSearchText(rawTitle);
  const titleWords = normTitle ? normTitle.split(NON_WORD_RE).filter(Boolean) : [];

  const entry = { stamp, haystack, haystackWords, rawTitle, normTitle, titleWords };
  adSearchCache.set(ad, entry);
  return entry;
}

function getEntitySearchIndex(entity, textBuilder) {
  if (!entity || typeof entity !== 'object') {
    const norm = normalizeSearchText(textBuilder());
    return { norm, words: norm ? norm.split(' ').filter(Boolean) : [] };
  }
  const cached = entitySearchCache.get(entity);
  if (cached) return cached;
  const norm = normalizeSearchText(textBuilder());
  const entry = { norm, words: norm ? norm.split(' ').filter(Boolean) : [] };
  entitySearchCache.set(entity, entry);
  return entry;
}

let dpPrev = new Int32Array(128);
let dpCurr = new Int32Array(128);

function boundedEditDistance(a, b, maxDist) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  if (lb + 1 > dpPrev.length) {
    dpPrev = new Int32Array(lb + 32);
    dpCurr = new Int32Array(lb + 32);
  }
  let prev = dpPrev;
  let curr = dpCurr;
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb];
}

function matchesToken(token, haystack, haystackWords) {
  if (!token) return true;
  if (haystack.includes(token)) return true;

  // Typo tolerance: 1 typo for 4-6 chars, 2 typos for 7+ chars
  if (token.length < 4) return false;
  const maxDist = token.length >= 7 ? 2 : 1;
  for (let i = 0; i < haystackWords.length; i++) {
    const w = haystackWords[i];
    if (w.length < 3) continue;
    if (Math.abs(w.length - token.length) <= maxDist && boundedEditDistance(token, w, maxDist) <= maxDist) {
      return true;
    }
  }
  return false;
}

export function matchesSmartSearch(ad, rawQuery) {
  const { normQuery, queryTokens } = getParsedQuery(rawQuery);
  if (!normQuery) return true;

  const { haystack, haystackWords } = getAdSearchIndex(ad);
  if (haystack.includes(normQuery)) return true;

  return queryTokens.every((tok) => matchesToken(tok, haystack, haystackWords));
}

export function getSearchSuggestions(rawQuery, { ads = [], cities = [], categories = [] } = {}) {
  const { normQuery, queryTokens } = getParsedQuery(rawQuery);
  if (!normQuery || normQuery.length < 1) return [];

  const seen = new Set();
  const results = [];

  const pushUnique = (label, badge) => {
    const key = normalizeSearchText(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push({ label, badge });
  };

  // 1. Categories
  for (const cat of categories) {
    if (cat.id === 'all') continue;
    const { norm: normCat, words } = getEntitySearchIndex(cat, () => `${cat.fa} ${cat.sv || ''}`);
    if (queryTokens.every((t) => matchesToken(t, normCat, words))) {
      pushUnique(cat.fa, 'دسته‌بندی');
    }
  }

  // 2. Cities
  for (const city of cities) {
    if (city.id === 'all') continue;
    const { norm: normCity, words } = getEntitySearchIndex(city, () => `${city.fa} ${city.id}`);
    if (queryTokens.every((t) => matchesToken(t, normCity, words))) {
      pushUnique(city.fa, 'شهر');
    }
  }

  // 3. Ad titles (prefix matches first, then fuzzy matches)
  for (const ad of ads) {
    if (results.length >= 6) break;
    const { rawTitle, normTitle, titleWords } = getAdSearchIndex(ad);
    if (!rawTitle) continue;
    if (queryTokens.every((t) => matchesToken(t, normTitle, titleWords))) {
      pushUnique(rawTitle, 'آگهی');
    }
  }

  return results.slice(0, 6);
}
