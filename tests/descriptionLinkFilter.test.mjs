import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsLinkInDescription,
  DESCRIPTION_LINK_ERROR_MSG,
} from '../src/lib/moderation.js';

test('containsLinkInDescription blocks http, https, www, .com, .se, .eu, t.me and similar domains', () => {
  assert.equal(
    DESCRIPTION_LINK_ERROR_MSG,
    'لینک در توضیحات مجاز نیست. آدرس سایت را در بخش وبسایت بنویسید.'
  );

  const blockedSamples = [
    'اطلاعات بیشتر در http://example.com',
    'سایت ما: https://site.se/test?ref=1',
    'وب‌سایت www.linksho.eu',
    'فروشگاه اینترنتی example.com برای سفارش',
    'صفحه ما myshop.se است',
    'درگاه پرتال portal.eu رایگان',
    'کانال تلگرام t.me/channel',
    'لینک دعوت t.me/+abcdef123',
    'واتساپ سریع wa.me/46731234567',
    'لینک: https://test.com',
    'بازدید از shop.de/offer و خرید',
  ];

  for (const sample of blockedSamples) {
    assert.equal(
      containsLinkInDescription(sample),
      true,
      `Expected description to be blocked as link: "${sample}"`
    );
  }
});

test('containsLinkInDescription allows numbers, prices, decimals, measurements, dates, phones, and emails', () => {
  const allowedSamples = [
    '',
    'قیمت 12000 کرون و قابل مذاکره است.',
    'آپارتمان با متراژ 75.5 متر مربع در طبقه سوم',
    'قیمت 99.90 یورو با ارسال رایگان',
    '2.5 اتاق خواب، اجاره ماهانه 14,500 SEK',
    'تماس: 0731234567 یا +46 73 123 45 67',
    'شماره تلفن 073.123.4567 برای هماهنگی بازدید',
    'مدل 2024 کارکرد 45.000 کیلومتر تمیز و بی‌نقص',
    'واحد 80m2 نزدیک ایستگاه مترو',
    'تاریخ تحویل 2026.11.19 و قرارداد رسمی',
    'ایمیل پشتیبانی: ali@example.com',
  ];

  for (const sample of allowedSamples) {
    assert.equal(
      containsLinkInDescription(sample),
      false,
      `Expected description NOT to be blocked: "${sample}"`
    );
  }
});
