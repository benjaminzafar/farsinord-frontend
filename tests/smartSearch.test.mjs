import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSearchText,
  matchesSmartSearch,
  scoreSmartSearchMatch,
  getSearchSuggestions,
  extractServerSearchTokens,
  buildTitleDescriptionOrFilter,
} from '../src/lib/smartSearch.js';

const SAMPLE_ADS = [
  {
    id: '1',
    title: 'اجاره آپارتمان ۲ خوابه مبله',
    description: 'آپارتمان نورگیر با اینترنت پرسرعت و پارکینگ اختصاصی نزدیک مترو.',
    city: 'Stockholm',
    area: 'Solna',
    reference_number: 'SP-2611-1001',
  },
  {
    id: '2',
    title: 'رستوران ایرانی ونک (Restaurang Vanak)',
    description: 'انواع کباب ایرانی، چلوکباب کوبیده و غذای خانگی با گوشت حلال.',
    city: 'Stockholm',
    area: 'Kista',
    reference_number: 'SP-2611-1002',
  },
  {
    id: '3',
    title: 'خدمات حسابداری و ثبت شرکت',
    description: 'مشاوره مالیاتی، اظهارنامه و ثبت شرکت در سوئد برای فارسی‌زبانان.',
    city: 'Gothenburg',
    area: 'Mölndal',
    reference_number: 'SP-2611-1003',
  },
  {
    id: '4',
    title: 'خرید و فروش گوشی آیفون ۱۵',
    description: 'گوشی بسیار تمیز با گارانتی، مناسب برای هدیه.',
    city: 'Malmö',
    area: 'Centrum',
    reference_number: 'SP-2611-1004',
  },
];

test('matchesSmartSearch focuses strictly on ad title and description (ignores city, area, and reference code)', () => {
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'Stockholm'), false);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'Solna'), false);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'SP-2611-1001'), false);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[2], 'Gothenburg'), false);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[2], 'Mölndal'), false);

  // Matches title & description cleanly
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'آپارتمان'), true);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'پارکینگ اختصاصی'), true);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[1], 'چلوکباب حلال'), true);
});

test('normalizeSearchText and matchesSmartSearch fold Persian/Arabic characters and digits', () => {
  assert.equal(normalizeSearchText('آپارتمان ۲ خوابه كوچك يادگاري'), 'اپارتمان 2 خوابه کوچک یادگاری');
  assert.equal(matchesSmartSearch(SAMPLE_ADS[0], 'اپارتمان 2 خوابه'), true);
  assert.equal(matchesSmartSearch(SAMPLE_ADS[3], 'ایفون 15'), true);
  // Typo tolerance on 4+ char words in title/description
  assert.equal(matchesSmartSearch(SAMPLE_ADS[1], 'رستورن'), true);
});

test('getSearchSuggestions NEVER includes cities or categories and ranks title before description', () => {
  const cities = [
    { id: 'Stockholm', fa: 'استکهلم' },
    { id: 'Gothenburg', fa: 'یوتبوری' },
    { id: 'Sundsvall', fa: 'سوندسوال' },
  ];
  const categories = [
    { id: 'housing', fa: 'مسکن' },
    { id: 'food', fa: 'رستوران' },
  ];

  // Typing a city name returns zero city suggestions
  const citySuggestions = getSearchSuggestions('استکهلم', { ads: SAMPLE_ADS, cities, categories });
  assert.equal(citySuggestions.length, 0);

  // Typing a category word only returns matching ads, never category/city badges
  const restaurantSuggestions = getSearchSuggestions('رستوران', { ads: SAMPLE_ADS, cities, categories });
  assert.equal(restaurantSuggestions.length, 1);
  assert.equal(restaurantSuggestions[0].label, SAMPLE_ADS[1].title);
  assert.equal(restaurantSuggestions[0].badge, 'عنوان');

  // Matching inside description returns the ad with "در متن" badge
  const descSuggestions = getSearchSuggestions('کوبیده', { ads: SAMPLE_ADS, cities, categories });
  assert.equal(descSuggestions.length, 1);
  assert.equal(descSuggestions[0].label, SAMPLE_ADS[1].title);
  assert.equal(descSuggestions[0].badge, 'در متن');

  // Title match scores higher than description-only match
  const adsWithBoth = [
    { id: 'd', title: 'پکیج ویژه کسب‌وکار', description: 'شامل خدمات حسابداری کامل' },
    { id: 't', title: 'حسابداری تخصصی شرکت‌ها', description: 'مشاوره مالی' },
  ];
  assert.ok(scoreSmartSearchMatch(adsWithBoth[1], 'حسابداری') > scoreSmartSearchMatch(adsWithBoth[0], 'حسابداری'));
  const ranked = getSearchSuggestions('حسابداری', { ads: adsWithBoth });
  assert.equal(ranked[0].label, 'حسابداری تخصصی شرکت‌ها');
  assert.equal(ranked[0].badge, 'عنوان');
  assert.equal(ranked[1].label, 'پکیج ویژه کسب‌وکار');
  assert.equal(ranked[1].badge, 'در متن');
});

test('server-side search tokenizer and filter target only title/title_fa/description', () => {
  const tokens = extractServerSearchTokens('رستوران ایرانی ونک (Restaurang Vanak)');
  assert.deepEqual(tokens, ['رستوران', 'ایرانی', 'ونک', 'Restaurang', 'Vanak']);

  const filter = buildTitleDescriptionOrFilter('اپارتمان');
  assert.ok(filter.includes('title.ilike.%اپارتمان%'));
  assert.ok(filter.includes('title_fa.ilike.%آپارتمان%'));
  assert.ok(filter.includes('description.ilike.%آپارتمان%'));
  assert.equal(filter.includes('city.ilike'), false);
  assert.equal(filter.includes('reference_number.ilike'), false);

  const digitFilter = buildTitleDescriptionOrFilter('2');
  assert.ok(digitFilter.includes('title.ilike.%2%'));
  assert.ok(digitFilter.includes('title.ilike.%۲%'));
});
