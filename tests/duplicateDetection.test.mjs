import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAdText,
  extractContactHashes,
  prepareIncomingAdFingerprint,
  detectDuplicates,
} from '../api/_lib/duplicateDetection.js';

const EXISTING_RENT_AD = {
  id: '11111111-1111-1111-1111-111111111111',
  reference_number: 'SP-2611-A101',
  title: 'اجاره آپارتمان دو خوابه مبله در استکهلم کیستا',
  description: 'آپارتمان ۷۵ متری نوساز و شیک دو خوابه مبله نزدیک مترو کیستا اجاره فوری بدون واسطه ماهانه ۱۳۰۰۰ کرون',
  category: 'bostad',
  country: 'se',
  city: 'Stockholm',
  area: 'Kista',
  price: 13000,
  contact_phone: '0731234567',
  images: ['https://cdn.example.com/ads/flat-kista-1.webp'],
  status: 'active',
  created_at: '2026-11-01T10:00:00.000Z',
  ...(() => {
    const prep = prepareIncomingAdFingerprint({
      title: 'اجاره آپارتمان دو خوابه مبله در استکهلم کیستا',
      description: 'آپارتمان ۷۵ متری نوساز و شیک دو خوابه مبله نزدیک مترو کیستا اجاره فوری بدون واسطه ماهانه ۱۳۰۰۰ کرون',
      category: 'bostad',
      country: 'se',
      city: 'Stockholm',
      price: 13000,
      contact_phone: '0731234567',
      images: ['https://cdn.example.com/ads/flat-kista-1.webp'],
    });
    return {
      normalized_title: prep.titleNorm,
      normalized_text: prep.normalizedText,
      content_hash: prep.contentHash,
      owner_fingerprint: prep.ownerFingerprint,
      owner_contact_hashes: prep.contactHashes,
      image_hashes: prep.imageSignatures,
    };
  })(),
};

test('normalizeAdText folds Arabic letters, ZWNJ, diacritics, and Persian/Arabic numerals', () => {
  const a = normalizeAdText('اجاره‌ی آپارتمان ۲ خوابه در استکهلم كیستا');
  const b = normalizeAdText('اجاره آپارتمان 2 خوابه در استکهلم کیستا!');
  assert.equal(a, b);
});

test('extractContactHashes links phone variants with +46 and leading 0 for same owner', () => {
  const p1 = extractContactHashes({ contact_phone: '0731234567' });
  const p2 = extractContactHashes({ contact_whatsapp: '+46 73 123 45 67' });
  const overlap = p1.contactHashes.filter((h) => p2.contactHashes.includes(h));
  assert.ok(overlap.length > 0, 'Normalized last-9 digits should match owner across channels');
});

test('1. Completely new ad in same category is allowed cleanly', () => {
  const incoming = {
    title: 'تعمیر تخصصی یخچال و ماشین لباسشویی در گوتنبرگ',
    description: 'سرویس سریع لوازم خانگی با ضمانت ۶ ماهه در تمام نقاط گوتنبرگ',
    category: 'tjanster',
    country: 'se',
    city: 'Göteborg',
    price: 900,
    contact_phone: '0709988776',
    images: ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'],
  };
  const res = detectDuplicates(incoming, [EXISTING_RENT_AD]);
  assert.equal(res.decision, 'clean');
  assert.ok(res.score < 0.4);
});

test('2. Exact duplicate is blocked with score 1', () => {
  const incoming = {
    title: EXISTING_RENT_AD.title,
    description: EXISTING_RENT_AD.description,
    category: 'bostad',
    country: 'se',
    city: 'Stockholm',
    price: 13000,
    contact_phone: '0731234567',
    images: EXISTING_RENT_AD.images,
  };
  const res = detectDuplicates(incoming, [EXISTING_RENT_AD]);
  assert.equal(res.decision, 'block');
  assert.equal(res.score, 1);
  assert.equal(res.topMatch.reference_number, 'SP-2611-A101');
});

test('3. Slightly modified/paraphrased duplicate from same user (+46 format, Arabic chars, synonym wording) is detected & blocked', () => {
  const incoming = {
    title: 'کرایه واحد 2 خوابه فرنیش کیستا استکهلم فوری',
    description: 'خانه ۷۵ متری تمیز و بازسازی‌شده ۲ خوابه با لوازم کامل نزدیک مترو کیستا کرایه داده می‌شود قیمت ۱۳۰۰۰ کرون',
    category: 'bostad',
    country: 'se',
    city: 'Stockholm',
    price: 13000,
    contact_whatsapp: '+4673-123-4567',
    images: ['https://cdn.example.com/ads/flat-kista-1.webp'],
  };
  const res = detectDuplicates(incoming, [EXISTING_RENT_AD]);
  assert.equal(res.sameOwner, true);
  assert.equal(res.decision, 'block');
  assert.ok(res.score >= 0.72, `Expected block score >= 0.72, got ${res.score}`);
});

test('4. Default placeholder Unsplash image does NOT trigger false-positive duplicate match across unrelated ads', () => {
  const placeholderAd = {
    id: '22222222-2222-2222-2222-222222222222',
    reference_number: 'SP-2611-B202',
    title: 'کباب‌پز برقی خانگی در مالمو',
    description: 'کباب‌پز کاملاً سالم کم‌کارکرد در مالمو',
    category: 'kop-salj',
    country: 'se',
    city: 'Malmö',
    price: 450,
    images: ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'],
    status: 'active',
  };
  const incoming = {
    title: 'دوچرخه کوهستان ۲۶ اینچ مالمو',
    description: 'دوچرخه دنده‌ای ترمز دیسکی تمیز در شهر مالمو',
    category: 'kop-salj',
    country: 'se',
    city: 'Malmö',
    price: 1800,
    contact_phone: '0765554433',
    images: ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'],
  };
  const res = detectDuplicates(incoming, [placeholderAd]);
  assert.equal(res.decision, 'clean');
});

test('5. Legitimate similar ads for DIFFERENT products from the same seller (iPhone 14 vs iPhone 15) are NOT blocked', () => {
  const iphone14 = {
    id: '33333333-3333-3333-3333-333333333333',
    reference_number: 'SP-2611-P140',
    title: 'فروش گوشی آیفون 14 پرو ۱۲۸ گیگ در استکهلم',
    description: 'گوشی سالم بدون خط و خش سلامت باتری ۹۴ درصد به همراه جعبه اصلی قیمت ۷۵۰۰ کرون',
    category: 'elektronik',
    country: 'se',
    city: 'Stockholm',
    price: 7500,
    images: ['https://cdn.example.com/ads/iphone14.webp'],
    status: 'active',
    ...(() => {
      const p = prepareIncomingAdFingerprint({
        title: 'فروش گوشی آیفون 14 پرو ۱۲۸ گیگ در استکهلم',
        description: 'گوشی سالم بدون خط و خش سلامت باتری ۹۴ درصد به همراه جعبه اصلی قیمت ۷۵۰۰ کرون',
        category: 'elektronik',
        country: 'se',
        city: 'Stockholm',
        price: 7500,
        contact_phone: '0731234567',
        images: ['https://cdn.example.com/ads/iphone14.webp'],
      });
      return {
        normalized_title: p.titleNorm,
        normalized_text: p.normalizedText,
        content_hash: p.contentHash,
        owner_fingerprint: p.ownerFingerprint,
        owner_contact_hashes: p.contactHashes,
        image_hashes: p.imageSignatures,
      };
    })(),
  };

  const iphone15 = {
    title: 'فروش گوشی آیفون 15 پرو مکس ۵۱۲ گیگ در استکهلم',
    description: 'آکبند پلمپ گارانتی اپل اروپا رنگ تیتانیوم قیمت ۱۳۵۰۰ کرون',
    category: 'elektronik',
    country: 'se',
    city: 'Stockholm',
    price: 13500,
    contact_phone: '0731234567',
    images: ['https://cdn.example.com/ads/iphone15.webp'],
  };

  const res = detectDuplicates(iphone15, [iphone14]);
  assert.notEqual(res.decision, 'block', `Legitimate distinct model (iPhone 15 vs 14) should not be blocked (score=${res.score})`);
});

test('6. Legitimate different apartments by same landlord (2-room vs 3-room at distinct price) are NOT blocked', () => {
  const twoRoom = {
    ...EXISTING_RENT_AD,
    title: 'اجاره آپارتمان ۲ خوابه در استکهلم کیستا',
    description: 'واحد ۲ خوابه ۷۰ متری مبله در کیستا اجاره ماهانه ۱۲۵۰۰ کرون',
    price: 12500,
    images: ['https://cdn.example.com/ads/flat-2br.webp'],
  };
  const prep2 = prepareIncomingAdFingerprint({ ...twoRoom, contact_phone: '0731234567' });
  twoRoom.normalized_title = prep2.titleNorm;
  twoRoom.normalized_text = prep2.normalizedText;
  twoRoom.content_hash = prep2.contentHash;
  twoRoom.image_hashes = prep2.imageSignatures;

  const threeRoom = {
    title: 'اجاره آپارتمان ۳ خوابه ۱۰۵ متری در سولنا',
    description: 'آپارتمان ۳ خوابه ۱۰۵ متری بالکن‌دار بدون مبله در سولنا ماهانه ۱۹۰۰۰ کرون',
    category: 'bostad',
    country: 'se',
    city: 'Stockholm',
    price: 19000,
    contact_phone: '0731234567',
    images: ['https://cdn.example.com/ads/flat-3br.webp'],
  };
  const res = detectDuplicates(threeRoom, [twoRoom]);
  assert.notEqual(res.decision, 'block', `Distinct 2BR vs 3BR apartments should not be blocked (score=${res.score})`);
});

test('7. Same uploaded image SHA-256 hash + same owner + similar title catches rewritten image reuse', () => {
  const sharedHash = 'a'.repeat(64);
  const orig = {
    id: '44444444-4444-4444-4444-444444444444',
    reference_number: 'SP-2611-IMG1',
    title: 'آپارتمان مبله استکهلم مرکز اجاره ماهانه',
    description: 'دسترسی عالی به مترو و مرکز خرید با اینترنت رایگان',
    category: 'bostad',
    country: 'se',
    city: 'Stockholm',
    status: 'pending',
    owner_fingerprint: EXISTING_RENT_AD.owner_fingerprint,
    owner_contact_hashes: EXISTING_RENT_AD.owner_contact_hashes,
    image_hashes: [sharedHash],
  };
  const incoming = {
    title: 'کرایه آپارتمان مرکز شهر استکهلم مبله',
    description: 'واحد شیک کنار ایستگاه مترو و فروشگاه با وای‌فای رایگان',
    category: 'bostad',
    country: 'se',
    city: 'Stockholm',
    contact_phone: '0731234567',
    image_hashes: [sharedHash],
  };
  const res = detectDuplicates(incoming, [orig]);
  assert.ok(res.score >= 0.55, `Expected duplicate review/block score for reused image + pending ad, got ${res.score}`);
  assert.ok(['block', 'suspected'].includes(res.decision));
});
