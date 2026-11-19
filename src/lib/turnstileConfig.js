export const CLOUDFLARE_TEST_SITEKEY = '3x00000000000000000000FF';

export function sanitizeTurnstileSiteKey(raw) {
  return String(raw || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
}

export function validateTurnstileLiveSiteKey(raw) {
  const cleaned = sanitizeTurnstileSiteKey(raw);
  if (!cleaned) {
    return {
      ok: false,
      cleaned,
      error: 'در حالت عملیاتی وارد کردن کلید عمومی (Site Key) کلودفلر الزامی است.',
    };
  }
  if (cleaned.length >= 30) {
    return {
      ok: false,
      cleaned,
      error: 'احتمالاً کلید محرمانه (Secret Key) را به جای کلید عمومی (Site Key) وارد کرده‌اید.',
    };
  }
  if (!/^[0-9a-zA-Z_-]{16,29}$/.test(cleaned)) {
    return {
      ok: false,
      cleaned,
      error: 'فرمت کلید عمومی کلودفلر (Site Key) نامعتبر است.',
    };
  }
  return { ok: true, cleaned, error: '' };
}

export function resolveTurnstileSiteKey({ mode, siteKey, storedSettings } = {}) {
  if (mode === 'test') {
    return CLOUDFLARE_TEST_SITEKEY;
  }
  if (mode === 'live') {
    return sanitizeTurnstileSiteKey(siteKey);
  }

  const direct = sanitizeTurnstileSiteKey(siteKey);
  if (direct) return direct;

  if (storedSettings && storedSettings.mode === 'live') {
    const storedKey = sanitizeTurnstileSiteKey(storedSettings.siteKey);
    if (storedKey) return storedKey;
  }

  return CLOUDFLARE_TEST_SITEKEY;
}

export function formatTurnstileError(errCode) {
  const code = String(errCode || '').trim();
  if (code === '110200') {
    return 'خطای کلودفلر (110200): دامنه فعلی در بخش Hostname Management ویجت Turnstile ثبت نشده است.';
  }
  if (['110100', '110110', '400020', '400070'].includes(code)) {
    return `خطای کلودفلر (${code}): کلید عمومی (Site Key) در پنل کلودفلر نامعتبر، حذف‌شده یا متعلق به ویجت دیگری است.`;
  }
  return code ? `خطا در احراز هویت امنیتی (کد ${code})` : 'خطا در احراز هویت امنیتی';
}
