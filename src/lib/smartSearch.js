// Fast, zero-lag search focused strictly on ad titles and descriptions
// with Persian/Arabic normalization, digit folding, WeakMap token cache & typo tolerance

const NON_WORD_RE = /[^a-z0-9\u0600-\u06FF]+/;
const adSearchCache = new WeakMap();

let lastRawQuery = null;
let lastNormQuery = '';
let lastQueryTokens = [];

export function normalizeSearchText(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
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
    return {
      rawTitle: '',
      normTitle: '',
      titleWords: [],
      haystack: '',
      haystackWords: [],
    };
  }
  const stamp = `${ad.updated_at || ''}|${ad.sort_timestamp || ''}|${ad.title || ''}|${ad.title_fa || ''}|${ad.description?.length || 0}`;
  const cached = adSearchCache.get(ad);
  if (cached && cached.stamp === stamp) return cached;

  // Strictly index ad title and description (never city, area, or reference code)
  const rawTitle = (ad.title_fa || ad.title || '').trim();
  const normTitle = normalizeSearchText([ad.title, ad.title_fa].filter(Boolean).join(' '));
  const titleWords = normTitle ? normTitle.split(NON_WORD_RE).filter(Boolean) : [];

  const normDescription = normalizeSearchText(ad.description || '');
  const descriptionWords = normDescription ? normDescription.split(NON_WORD_RE).filter(Boolean) : [];

  const haystack = [normTitle, normDescription].filter(Boolean).join(' ');
  const haystackWords = titleWords.length && descriptionWords.length
    ? [...titleWords, ...descriptionWords]
    : (titleWords.length ? titleWords : descriptionWords);

  const entry = {
    stamp,
    rawTitle,
    normTitle,
    titleWords,
    haystack,
    haystackWords,
  };
  adSearchCache.set(ad, entry);
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

function matchesToken(token, text, words) {
  if (!token) return true;
  if (text.includes(token)) return true;

  // Typo tolerance: 1 typo for 4-6 chars, 2 typos for 7+ chars
  if (token.length < 4) return false;
  const maxDist = token.length >= 7 ? 2 : 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length < 3) continue;
    if (Math.abs(w.length - token.length) <= maxDist && boundedEditDistance(token, w, maxDist) <= maxDist) {
      return true;
    }
  }
  return false;
}

/**
 * Relevance score strictly against ad title and description:
 * 3 = title starts with query or a title word starts with query
 * 2 = all query tokens match inside title
 * 1 = all query tokens match across title + description
 * 0 = no match
 */
export function scoreSmartSearchMatch(ad, rawQuery) {
  const { normQuery, queryTokens } = getParsedQuery(rawQuery);
  if (!normQuery) return 1;

  const { normTitle, titleWords, haystack, haystackWords } = getAdSearchIndex(ad);
  if (!haystack) return 0;

  if (normTitle) {
    if (normTitle.startsWith(normQuery) || titleWords.some((w) => w.startsWith(normQuery))) {
      return 3;
    }
    if (normTitle.includes(normQuery) || queryTokens.every((tok) => matchesToken(tok, normTitle, titleWords))) {
      return 2;
    }
  }

  if (haystack.includes(normQuery) || queryTokens.every((tok) => matchesToken(tok, haystack, haystackWords))) {
    return 1;
  }

  return 0;
}

export function matchesSmartSearch(ad, rawQuery) {
  const { normQuery } = getParsedQuery(rawQuery);
  if (!normQuery) return true;
  return scoreSmartSearchMatch(ad, rawQuery) > 0;
}

/**
 * Clean autocomplete suggestions focused strictly on ad titles and descriptions.
 * Never suggests cities or categories so the search dropdown stays focused and uncluttered.
 */
export function getSearchSuggestions(rawQuery, { ads = [] } = {}) {
  const { normQuery } = getParsedQuery(rawQuery);
  if (!normQuery || normQuery.length < 1) return [];

  const titlePrefixMatches = [];
  const titleMatches = [];
  const descriptionMatches = [];
  const seen = new Set();

  for (const ad of ads) {
    const { rawTitle } = getAdSearchIndex(ad);
    if (!rawTitle) continue;
    const key = normalizeSearchText(rawTitle);
    if (!key || seen.has(key)) continue;

    const score = scoreSmartSearchMatch(ad, rawQuery);
    if (score === 0) continue;

    seen.add(key);
    if (score === 3) {
      titlePrefixMatches.push({ label: rawTitle, badge: 'عنوان' });
    } else if (score === 2) {
      titleMatches.push({ label: rawTitle, badge: 'عنوان' });
    } else {
      descriptionMatches.push({ label: rawTitle, badge: 'در متن' });
    }
  }

  return [...titlePrefixMatches, ...titleMatches, ...descriptionMatches].slice(0, 6);
}

/**
 * Sanitize and split user search text into safe server-side PostgREST tokens.
 */
export function extractServerSearchTokens(rawQuery, maxTokens = 6) {
  const sanitized = String(rawQuery || '')
    .slice(0, 100)
    .replace(/[,()"'`’\\*%_]/g, ' ')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return [];
  const unique = [];
  for (const tok of sanitized.split(' ')) {
    if (!tok || unique.includes(tok)) continue;
    unique.push(tok);
    if (unique.length >= maxTokens) break;
  }
  return unique;
}

/**
 * Build PostgREST .or() filter clause matching a single token strictly on title, title_fa, and description
 * (with ASCII/Persian digit and Alef/Madda variants; never matching city or reference_number).
 */
export function buildTitleDescriptionOrFilter(token) {
  const variants = new Set([token]);
  const asciiDigits = token
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const persianDigits = asciiDigits.replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
  variants.add(asciiDigits);
  variants.add(persianDigits);

  if (token.startsWith('ا')) variants.add('آ' + token.slice(1));
  else if (token.startsWith('آ')) variants.add('ا' + token.slice(1));

  const clauses = [];
  for (const v of variants) {
    if (!v) continue;
    const term = `%${v}%`;
    clauses.push(`title.ilike.${term}`, `title_fa.ilike.${term}`, `description.ilike.${term}`);
  }
  return clauses.join(',');
}
