import crypto from 'node:crypto';

const DEFAULT_FALLBACK_IMAGE_PREFIX = 'https://images.unsplash.com/photo-1582407947304-fd86f028f716';

const PERSIAN_STOP_WORDS = new Set([
  'در', 'به', 'از', 'با', 'برای', 'که', 'این', 'آن', 'و', 'یا', 'را', 'یک', 'هم', 'تا', 'بر',
  'است', 'هست', 'شد', 'شده', 'شود', 'می', 'های', 'ها', 'رو', 'دارد', 'دارای', 'بسیار', 'کاملا',
  'فقط', 'لطفا', 'لطفاً', 'تماس', 'بگیرید', 'پیام', 'واتساپ', 'تلگرام', 'شماره', 'قیمت', 'تومان',
  'کرون', 'یورو', 'sek', 'nok', 'dkk', 'eur', 'kr', 'the', 'and', 'for', 'with', 'och', 'att', 'för', 'med', 'i', 'på',
]);

const CONCEPT_MAP = new Map([
  ['اجاره', '_rent_'], ['کرایه', '_rent_'], ['رهن', '_rent_'], ['رنت', '_rent_'], ['rent', '_rent_'], ['hyra', '_rent_'], ['uthyres', '_rent_'],
  ['اپارتمان', '_apt_'], ['واحد', '_apt_'], ['خونه', '_apt_'], ['خانه', '_apt_'], ['منزل', '_apt_'], ['مسکن', '_apt_'], ['سوئیت', '_apt_'], ['سوییت', '_apt_'], ['استودیو', '_apt_'], ['lgh', '_apt_'], ['lagenhet', '_apt_'], ['apartment', '_apt_'], ['flat', '_apt_'], ['bostad', '_apt_'],
  ['اتاق', '_room_'], ['خواب', '_room_'], ['خوابه', '_room_'], ['روم', '_room_'], ['rum', '_room_'], ['rok', '_room_'], ['room', '_room_'], ['bedroom', '_room_'],
  ['مبله', '_furn_'], ['فرنیش', '_furn_'], ['لوازم', '_furn_'], ['moblerad', '_furn_'], ['furnished', '_furn_'],
  ['فروش', '_sale_'], ['فروشی', '_sale_'], ['میفروشم', '_sale_'], ['خرید', '_sale_'], ['saljes', '_sale_'], ['sale', '_sale_'], ['sell', '_sale_'],
  ['فوری', '_urgent_'], ['سریع', '_urgent_'], ['اکازیون', '_urgent_'], ['omgaende', '_urgent_'], ['urgent', '_urgent_'],
  ['جدید', '_new_'], ['نوساز', '_new_'], ['نو', '_new_'], ['تازه', '_new_'], ['ny', '_new_'], ['nytt', '_new_'], ['new', '_new_'],
  ['تمیز', '_clean_'], ['شیک', '_clean_'], ['بازسازی', '_clean_'], ['نوشده', '_clean_'], ['عالی', '_clean_'], ['بزرگ', '_large_'],
  ['استخدام', '_job_'], ['کار', '_job_'], ['شغل', '_job_'], ['همکار', '_job_'], ['همکاری', '_job_'], ['دعوت', '_job_'], ['کاریابی', '_job_'], ['jobb', '_job_'], ['job', '_job_'], ['hiring', '_job_'],
  ['خودرو', '_car_'], ['ماشین', '_car_'], ['اتومبیل', '_car_'], ['سواری', '_car_'], ['bil', '_car_'], ['car', '_car_'],
  ['رستوران', '_food_'], ['کافه', '_food_'], ['غذا', '_food_'], ['کترینگ', '_food_'], ['اشپزی', '_food_'], ['restaurang', '_food_'], ['restaurant', '_food_'],
  ['خدمات', '_service_'], ['سرویس', '_service_'], ['تعمیر', '_repair_'], ['تعمیرات', '_repair_'], ['service', '_service_'], ['tjanst', '_service_'],
  ['مرکز', '_center_'], ['سنتر', '_center_'], ['مرکزی', '_center_'], ['centrum', '_center_'], ['central', '_center_'],
  ['دو', '2'], ['دوم', '2'], ['سه', '3'], ['سوم', '3'], ['چهار', '4'], ['یک', '1'], ['تک', '1'],
]);

function foldDigitsAndLatin(str) {
  return String(str || '')
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[åäæ]/gi, 'a')
    .replace(/[öø]/gi, 'o')
    .replace(/ü/gi, 'u');
}

export function normalizeAdText(input) {
  if (!input) return '';
  return foldDigitsAndLatin(String(input))
    .toLowerCase()
    .replace(/ۀ/g, 'ه')
    .replace(/\u200C+[یي](?=\s|$|[.,!؟])/gu, ' ')
    .replace(/[\u064B-\u065F\u0670\u0640\u200C\u200D]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يیئى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeAndCanonicalize(normalizedText) {
  if (!normalizedText) return [];
  const rawTokens = normalizedText.split(' ').filter(Boolean);
  const out = [];
  for (let tok of rawTokens) {
    if (PERSIAN_STOP_WORDS.has(tok)) continue;
    // Light Persian plural trimming
    if (tok.length > 4 && (tok.endsWith('های') || tok.endsWith('هایش'))) {
      tok = tok.slice(0, -3);
    } else if (tok.length > 4 && tok.endsWith('ها')) {
      tok = tok.slice(0, -2);
    }
    if (PERSIAN_STOP_WORDS.has(tok)) continue;
    const mapped = CONCEPT_MAP.get(tok) || tok;
    if (mapped.length >= 2 || /^\d$/.test(mapped)) {
      out.push(mapped);
    }
  }
  return out;
}

function sha256(val) {
  return crypto.createHash('sha256').update(String(val), 'utf8').digest('hex');
}

export function normalizePhoneDigits(phone) {
  const digits = foldDigitsAndLatin(phone).replace(/\D/g, '');
  if (digits.length < 6) return [];
  const variants = new Set([digits]);
  if (digits.length >= 9) {
    variants.add(digits.slice(-9));
  }
  return Array.from(variants);
}

export function extractContactHashes({
  contact_phone,
  contact_whatsapp,
  contact_email,
  contact_telegram,
  contact_website,
} = {}) {
  const tokens = new Set();

  for (const d of normalizePhoneDigits(contact_phone)) tokens.add(`tel:${d}`);
  for (const d of normalizePhoneDigits(contact_whatsapp)) tokens.add(`wa:${d}`);
  const waHandle = String(contact_whatsapp || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i, '')
    .split(/[/?#]/)[0];
  if (waHandle && /[a-z]/i.test(waHandle) && waHandle.length >= 3) {
    tokens.add(`wauser:${waHandle}`);
  }

  // Also cross-match phone/whatsapp digits regardless of channel label
  for (const d of normalizePhoneDigits(contact_phone)) tokens.add(`num:${d}`);
  for (const d of normalizePhoneDigits(contact_whatsapp)) tokens.add(`num:${d}`);

  const email = String(contact_email || '').trim().toLowerCase();
  if (email && email.includes('@')) {
    tokens.add(`mail:${email}`);
  }

  const tg = String(contact_telegram || '').trim().toLowerCase().replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//, '').split(/[/?#]/)[0];
  if (tg && tg.length >= 3) {
    tokens.add(`tg:${tg}`);
  }

  if (contact_website) {
    try {
      const u = new URL(String(contact_website).trim().startsWith('http') ? String(contact_website).trim() : `https://${String(contact_website).trim()}`);
      const hostPath = `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
      if (hostPath && hostPath.includes('.')) {
        tokens.add(`web:${hostPath}`);
      }
    } catch {}
  }

  const contactHashes = Array.from(tokens).sort().map((t) => sha256(t));
  const ownerFingerprint = contactHashes.length > 0 ? sha256(contactHashes.join('|')) : '';
  return { ownerFingerprint, contactHashes };
}

export function computeContentHash({ country = 'se', category = 'bostad', city = '', title = '', description = '' } = {}) {
  const canonical = [
    String(country || 'se').trim().toLowerCase(),
    String(category || 'bostad').trim().toLowerCase(),
    normalizeAdText(city),
    normalizeAdText(title),
    normalizeAdText(description),
  ].join('|');
  return sha256(canonical);
}

export function extractImageSignatures(images = [], clientImageHashes = []) {
  const sigs = new Set();
  if (Array.isArray(images)) {
    for (const raw of images) {
      const url = String(raw || '').trim();
      if (!url || url.startsWith(DEFAULT_FALLBACK_IMAGE_PREFIX)) continue;
      try {
        const parsed = new URL(url);
        sigs.add(sha256(`imgurl:${parsed.hostname.toLowerCase()}${parsed.pathname}`));
      } catch {
        sigs.add(sha256(`imgraw:${url}`));
      }
    }
  }
  if (Array.isArray(clientImageHashes)) {
    for (const h of clientImageHashes) {
      const clean = String(h || '').trim().toLowerCase();
      if (/^[a-f0-9]{16,128}$/.test(clean)) {
        sigs.add(clean);
      }
    }
  }
  return Array.from(sigs);
}

function makeCharNgrams(text, n = 3) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return new Set();
  if (compact.length <= n) return new Set([compact]);
  const set = new Set();
  for (let i = 0; i <= compact.length - n; i++) {
    set.add(compact.slice(i, i + n));
  }
  return set;
}

function diceSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

function tokenCosineSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const freqA = new Map();
  const freqB = new Map();
  for (const t of tokensA) freqA.set(t, (freqA.get(t) || 0) + 1);
  for (const t of tokensB) freqB.set(t, (freqB.get(t) || 0) + 1);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of freqA) {
    normA += v * v;
    if (freqB.has(k)) dot += v * freqB.get(k);
  }
  for (const v of freqB.values()) normB += v * v;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract specific numeric/model differentiators (e.g. iPhone 14 vs 15, 2-room vs 3-room, 128gb vs 256gb, price differences)
 * to avoid blocking legitimate ads for different products posted by the same merchant/user.
 */
export function extractDistinguishingAttributes({ title = '', description = '', price = null } = {}) {
  const norm = normalizeAdText(`${title} ${description}`);
  const titleNorm = normalizeAdText(title);
  const titleNumbers = new Set((titleNorm.match(/\b\d+(?:\.\d+)?\b/g) || []).filter((n) => Number(n) > 0 && Number(n) < 100000));
  const unitSpecs = new Set(norm.match(/\b\d+\s*(?:gb|tb|mb|m2|sqm|متر|خواب|خوابه|اتاق|rum|rok|cc|سال)\b/g) || []);
  const modelTokens = new Set(
    titleNorm
      .split(' ')
      .filter((t) => /^(?:pro|max|mini|plus|ultra|air|lite|xl|xxl|se|gt|ti|\d+[a-z]+|[a-z]+\d+)$/.test(t))
  );
  const numericPrice = price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price)) ? Number(price) : null;
  return { titleNumbers, unitSpecs, modelTokens, numericPrice };
}

function hasDistinctProductDiff(attrA, attrB) {
  let conflictingSignals = 0;

  if (attrA.titleNumbers.size > 0 && attrB.titleNumbers.size > 0) {
    const sameNum = [...attrA.titleNumbers].some((n) => attrB.titleNumbers.has(n));
    const differsA = [...attrA.titleNumbers].some((n) => !attrB.titleNumbers.has(n));
    const differsB = [...attrB.titleNumbers].some((n) => !attrA.titleNumbers.has(n));
    if (differsA && differsB && !sameNum) conflictingSignals += 2;
    else if (differsA && differsB) conflictingSignals += 1;
  }

  if (attrA.unitSpecs.size > 0 && attrB.unitSpecs.size > 0) {
    const sameSpec = [...attrA.unitSpecs].some((s) => attrB.unitSpecs.has(s));
    if (!sameSpec) conflictingSignals += 2;
  }

  if (attrA.modelTokens.size > 0 && attrB.modelTokens.size > 0) {
    const exactModelsMatch =
      attrA.modelTokens.size === attrB.modelTokens.size &&
      [...attrA.modelTokens].every((m) => attrB.modelTokens.has(m));
    if (!exactModelsMatch) conflictingSignals += 1;
  }

  if (attrA.numericPrice && attrB.numericPrice && attrA.numericPrice > 0 && attrB.numericPrice > 0) {
    const ratio = Math.abs(attrA.numericPrice - attrB.numericPrice) / Math.max(attrA.numericPrice, attrB.numericPrice);
    if (ratio >= 0.35) conflictingSignals += 1;
  }

  return conflictingSignals;
}

export function prepareIncomingAdFingerprint(incoming = {}) {
  const titleNorm = normalizeAdText(incoming.title_fa || incoming.title || '');
  const descNorm = normalizeAdText(incoming.description || '');
  const normalizedText = `${titleNorm} ${descNorm}`.trim();
  const titleTokens = tokenizeAndCanonicalize(titleNorm);
  const fullTokens = tokenizeAndCanonicalize(normalizedText);
  const { ownerFingerprint, contactHashes } = extractContactHashes(incoming);
  const contentHash = computeContentHash({
    country: incoming.country,
    category: incoming.category,
    city: incoming.city,
    title: incoming.title_fa || incoming.title,
    description: incoming.description,
  });
  const imageSignatures = extractImageSignatures(incoming.images, incoming.image_hashes);
  const attributes = extractDistinguishingAttributes({
    title: incoming.title_fa || incoming.title,
    description: incoming.description,
    price: incoming.price,
  });

  return {
    titleNorm,
    descNorm,
    normalizedText,
    titleNgrams: makeCharNgrams(titleNorm, 3),
    descNgrams: makeCharNgrams(descNorm, 3),
    titleTokens,
    fullTokens,
    ownerFingerprint,
    contactHashes,
    contentHash,
    imageSignatures,
    attributes,
    category: String(incoming.category || 'bostad').toLowerCase(),
    country: String(incoming.country || 'se').toLowerCase(),
    cityNorm: normalizeAdText(incoming.city || ''),
  };
}

export function evaluateDuplicateCandidate(preparedIncoming, candidate = {}) {
  const candTitleNorm = normalizeAdText(candidate.normalized_title || candidate.title_fa || candidate.title || '');
  const candDescNorm = normalizeAdText(candidate.description || '');
  const candFullText = candidate.normalized_text ? normalizeAdText(candidate.normalized_text) : `${candTitleNorm} ${candDescNorm}`.trim();
  const candContentHash =
    candidate.content_hash ||
    computeContentHash({
      country: candidate.country,
      category: candidate.category,
      city: candidate.city,
      title: candidate.title_fa || candidate.title,
      description: candidate.description,
    });

  // 1. Check Owner Overlap
  const candContactHashes = Array.isArray(candidate.owner_contact_hashes) && candidate.owner_contact_hashes.length > 0
    ? candidate.owner_contact_hashes
    : extractContactHashes(candidate).contactHashes;
  const candContactSet = new Set(candContactHashes);
  const sharedContacts = preparedIncoming.contactHashes.filter((h) => candContactSet.has(h));
  const sameOwner =
    Boolean(preparedIncoming.ownerFingerprint && candidate.owner_fingerprint && preparedIncoming.ownerFingerprint === candidate.owner_fingerprint) ||
    sharedContacts.length > 0;

  // 2. Exact Content Hash match
  if (preparedIncoming.contentHash && candContentHash && preparedIncoming.contentHash === candContentHash) {
    return {
      score: 1,
      sameOwner,
      reasons: ['متن و مشخصات دقیقاً با یک آگهی فعال یا در انتظار تایید یکسان است.'],
      breakdown: { exactHash: true },
    };
  }

  // 3. Text & Semantic Similarity
  const titleNgramSim = diceSimilarity(preparedIncoming.titleNgrams, makeCharNgrams(candTitleNorm, 3));
  const descNgramSim = diceSimilarity(preparedIncoming.descNgrams, makeCharNgrams(candDescNorm, 3));
  const candFullTokens = tokenizeAndCanonicalize(candFullText);
  const semanticSim = tokenCosineSimilarity(preparedIncoming.fullTokens, candFullTokens);
  const titleSemanticSim = tokenCosineSimilarity(preparedIncoming.titleTokens, tokenizeAndCanonicalize(candTitleNorm));

  // 4. Image Overlap (ignoring default Unsplash fallback placeholder)
  const candImgSigs = new Set(extractImageSignatures(candidate.images, candidate.image_hashes));
  const sharedImages = preparedIncoming.imageSignatures.filter((sig) => candImgSigs.has(sig));
  const imageOverlapRatio =
    preparedIncoming.imageSignatures.length > 0 && candImgSigs.size > 0
      ? sharedImages.length / Math.min(preparedIncoming.imageSignatures.length, candImgSigs.size)
      : 0;

  // 5. Category & Location alignment
  const sameCategory = preparedIncoming.category === String(candidate.category || '').toLowerCase();
  const sameCountry = preparedIncoming.country === String(candidate.country || '').toLowerCase();
  const sameCity = preparedIncoming.cityNorm && preparedIncoming.cityNorm === normalizeAdText(candidate.city || '');

  // Weighted base score
  let score =
    Math.max(titleNgramSim, titleSemanticSim) * 0.36 +
    semanticSim * 0.34 +
    descNgramSim * 0.16 +
    imageOverlapRatio * 0.14;

  // Context alignment bonus
  if (sameOwner && sameCategory) score += 0.08;
  if (sameCountry && sameCity && sameCategory) score += 0.05;
  if (sharedImages.length > 0 && Math.max(titleNgramSim, semanticSim) >= 0.45) {
    score += 0.10;
  }

  // Exact same normalized title in same city + category (or same owner)
  if (candTitleNorm && preparedIncoming.titleNorm === candTitleNorm && sameCategory && (sameOwner || sameCity)) {
    score = Math.max(score, 0.88);
  }

  // Anti-false-positive protection for legitimate distinct products (e.g., iPhone 14 vs iPhone 15, 2-room vs 3-room)
  const candAttr = extractDistinguishingAttributes({
    title: candidate.title_fa || candidate.title,
    description: candidate.description,
    price: candidate.price,
  });
  const conflictSignals = hasDistinctProductDiff(preparedIncoming.attributes, candAttr);
  if (conflictSignals >= 2 && descNgramSim < 0.85 && sharedImages.length === 0) {
    score -= 0.28;
  } else if (conflictSignals === 1 && descNgramSim < 0.78 && sharedImages.length === 0) {
    score -= 0.12;
  }

  score = Math.max(0, Math.min(0.999, Number(score.toFixed(3))));

  const reasons = [];
  if (sameOwner) reasons.push('اطلاعات تماس متعلق به همین آگهی‌دهنده است');
  if (Math.max(titleNgramSim, titleSemanticSim) >= 0.68) reasons.push('عنوان آگهی بسیار مشابه است');
  if (semanticSim >= 0.62 || descNgramSim >= 0.65) reasons.push('متن و مفهوم توضیحات شباهت بالایی دارد');
  if (sharedImages.length > 0) reasons.push('تصویر مشابه با آگهی قبلی استفاده شده است');
  if (sameCategory && sameCity) reasons.push('دسته‌بندی و شهر یکسان است');

  return {
    score,
    sameOwner,
    reasons,
    breakdown: {
      titleNgramSim: Number(titleNgramSim.toFixed(3)),
      titleSemanticSim: Number(titleSemanticSim.toFixed(3)),
      semanticSim: Number(semanticSim.toFixed(3)),
      descNgramSim: Number(descNgramSim.toFixed(3)),
      imageOverlapRatio: Number(imageOverlapRatio.toFixed(3)),
      conflictSignals,
    },
  };
}

export function detectDuplicates(incoming, candidates = [], config = {}) {
  const blockSameOwner = Number(config?.duplicateBlockThresholdSameOwner) || 0.72;
  const blockOtherOwner = Number(config?.duplicateBlockThresholdOtherOwner) || 0.86;
  const reviewSameOwner = Number(config?.duplicateReviewThresholdSameOwner) || 0.55;

  const prepared = prepareIncomingAdFingerprint(incoming);
  const scored = [];

  for (const cand of candidates || []) {
    if (!cand || (incoming.id && cand.id === incoming.id)) continue;
    const evaluation = evaluateDuplicateCandidate(prepared, cand);
    scored.push({ candidate: cand, ...evaluation });
  }

  // Prioritize same-owner matches cleanly when scores are close
  scored.sort((a, b) => {
    const aPriority = a.score + (a.sameOwner ? 0.06 : 0);
    const bPriority = b.score + (b.sameOwner ? 0.06 : 0);
    return bPriority - aPriority;
  });

  const top = scored[0] || null;
  let decision = 'clean';

  if (top) {
    if (top.score >= 0.995 || (top.sameOwner && top.score >= blockSameOwner) || (!top.sameOwner && top.score >= blockOtherOwner)) {
      decision = 'block';
    } else if ((top.sameOwner && top.score >= reviewSameOwner) || (!top.sameOwner && top.score >= blockOtherOwner - 0.12)) {
      decision = 'suspected';
    }
  }

  return {
    decision,
    score: top ? top.score : 0,
    sameOwner: top ? top.sameOwner : false,
    reasons: top ? top.reasons : [],
    topMatch: top
      ? {
          id: top.candidate.id,
          reference_number: top.candidate.reference_number,
          title: top.candidate.title_fa || top.candidate.title,
          city: top.candidate.city,
          country: top.candidate.country,
          status: top.candidate.status,
          created_at: top.candidate.created_at,
          next_free_boost_at: top.candidate.next_free_boost_at || null,
          score: top.score,
          sameOwner: top.sameOwner,
          reasons: top.reasons,
        }
      : null,
    normalizedTitle: prepared.titleNorm,
    normalizedText: prepared.normalizedText,
    contentHash: prepared.contentHash,
    ownerFingerprint: prepared.ownerFingerprint,
    ownerContactHashes: prepared.contactHashes,
    imageHashes: prepared.imageSignatures,
  };
}
