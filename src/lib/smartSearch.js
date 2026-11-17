// Fast, zero-lag Google-style smart search with Persian/Arabic normalization & typo tolerance

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

function boundedEditDistance(a, b, maxDist) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
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
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return true;

  const haystack = normalizeSearchText(
    [ad.title, ad.title_fa, ad.description, ad.city, ad.area, ad.reference_number].filter(Boolean).join(' ')
  );

  if (haystack.includes(normQuery)) return true;

  const queryTokens = normQuery.split(' ').filter(Boolean);
  const haystackWords = haystack.split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);

  return queryTokens.every((tok) => matchesToken(tok, haystack, haystackWords));
}

export function getSearchSuggestions(rawQuery, { ads = [], cities = [], categories = [] } = {}) {
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery || normQuery.length < 1) return [];

  const queryTokens = normQuery.split(' ').filter(Boolean);
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
    const normCat = normalizeSearchText(`${cat.fa} ${cat.sv || ''}`);
    const words = normCat.split(' ');
    if (queryTokens.every((t) => matchesToken(t, normCat, words))) {
      pushUnique(cat.fa, 'دسته‌بندی');
    }
  }

  // 2. Cities
  for (const city of cities) {
    if (city.id === 'all') continue;
    const normCity = normalizeSearchText(`${city.fa} ${city.id}`);
    const words = normCity.split(' ');
    if (queryTokens.every((t) => matchesToken(t, normCity, words))) {
      pushUnique(city.fa, 'شهر');
    }
  }

  // 3. Ad titles (prefix matches first, then fuzzy matches)
  for (const ad of ads) {
    if (results.length >= 6) break;
    const title = (ad.title_fa || ad.title || '').trim();
    if (!title) continue;
    const normTitle = normalizeSearchText(title);
    const words = normTitle.split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
    if (queryTokens.every((t) => matchesToken(t, normTitle, words))) {
      pushUnique(title, 'آگهی');
    }
  }

  return results.slice(0, 6);
}
