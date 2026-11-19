import crypto from 'node:crypto';

export const COUNTRY_CURRENCY_MAP = {
  se: 'SEK',
  no: 'NOK',
  dk: 'DKK',
  fi: 'EUR',
  de: 'EUR',
  at: 'EUR',
  nl: 'EUR',
  fr: 'EUR',
};

/**
 * Strictly resolve the redirect origin for Stripe success/cancel URLs against an explicit allowlist.
 * Prevents open-redirect attacks via forged Origin headers.
 */
export function resolveSafeRedirectOrigin(req, allowedOrigins = [], defaultOrigin = 'https://www.linksho.eu') {
  const fallback = String(defaultOrigin || 'https://www.linksho.eu').replace(/\/+$/, '');
  const rawOrigin = String(req?.headers?.origin || '').trim().replace(/\/+$/, '');
  if (!rawOrigin) return fallback;

  let parsed;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fallback;
  }

  const canonicalOrigin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  const normalizedAllowlist = (Array.isArray(allowedOrigins) ? allowedOrigins : [])
    .map((item) => String(item || '').trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);

  if (normalizedAllowlist.includes(canonicalOrigin)) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  const isNonProd =
    process.env.NODE_ENV !== 'production' &&
    process.env.VERCEL_ENV !== 'production';
  if (isNonProd && /^http:\/\/localhost:\d{2,5}$/i.test(canonicalOrigin)) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  return fallback;
}

const EUR_CONVERSION_RATES = {
  EUR: 1,
  SEK: 10,
  NOK: 10,
  DKK: 7.5,
};

/**
 * Compute authoritative server-side VIP pricing & duration for a target country.
 * Supports bidirectional conversion between EUR and Nordic currencies without arbitrage cliffs.
 */
export function computeVipPrice({ stripeCfg = {}, targetCountry = 'se' } = {}) {
  const cfg = stripeCfg && typeof stripeCfg === 'object' ? stripeCfg : {};
  const country = String(targetCountry || 'se').trim().toLowerCase() || 'se';
  const rawDuration = Number(cfg.vipDurationDays);
  const durationDays = Number.isFinite(rawDuration)
    ? Math.max(1, Math.min(365, Math.round(rawDuration)))
    : 30;

  const rawPrice = Number(cfg.vipPrice);
  const basePrice = Number.isFinite(rawPrice) && rawPrice >= 1 ? rawPrice : 99;
  const rawCfgCur = String(cfg.currency || 'SEK').trim().toUpperCase();
  const cfgCurrency = EUR_CONVERSION_RATES[rawCfgCur] ? rawCfgCur : 'SEK';
  const currency = COUNTRY_CURRENCY_MAP[country] || cfgCurrency;

  let amountMajor = basePrice;
  if (currency !== cfgCurrency) {
    const inEur = basePrice / EUR_CONVERSION_RATES[cfgCurrency];
    const converted = inEur * EUR_CONVERSION_RATES[currency];
    amountMajor =
      currency === 'EUR'
        ? Math.max(1, Math.round(converted))
        : Math.max(10, Math.round(converted));
  }

  const amountMinor = Math.max(100, Math.round(amountMajor * 100));
  return {
    targetCountry: country,
    durationDays,
    currency,
    amountMajor,
    amountMinor,
  };
}

/**
 * Validate that STRIPE_SECRET_KEY exists and its key prefix matches the active gateway mode.
 */
export function validateStripeSecretKeyForMode(secretKey, mode = 'live') {
  const cleanKey = String(secretKey || '').trim();
  const resolvedMode = mode === 'live' ? 'live' : 'test';
  if (!cleanKey) {
    return {
      ok: false,
      keyMode: 'none',
      error: 'کلید امنیتی درگاه Stripe (STRIPE_SECRET_KEY) روی سرور تنظیم نشده است.',
    };
  }

  const isLiveKey = /^sk_live_|^rk_live_/.test(cleanKey);
  const isTestKey = /^sk_test_|^rk_test_/.test(cleanKey);
  const keyMode = isLiveKey ? 'live' : isTestKey ? 'test' : 'unknown';

  if (resolvedMode === 'live' && isTestKey) {
    return {
      ok: false,
      keyMode,
      error: 'حالت درگاه روی «عملیاتی (live)» است اما کلید آزمایشی Stripe روی سرور تنظیم شده است.',
    };
  }

  if (resolvedMode === 'test' && isLiveKey) {
    return {
      ok: false,
      keyMode,
      error: 'حالت درگاه روی «آزمایشی (test)» است اما کلید عملیاتی (live) روی سرور تنظیم شده است.',
    };
  }

  if (keyMode === 'unknown') {
    return {
      ok: false,
      keyMode,
      error: 'فرمت کلید امنیتی Stripe روی سرور معتبر نیست.',
    };
  }

  return { ok: true, keyMode };
}

function constantTimeHexEqual(aHex, bHex) {
  const a = String(aHex || '').trim().toLowerCase();
  const b = String(bHex || '').trim().toLowerCase();
  if (!a || !b || a.length !== b.length || !/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * Verify Stripe-Signature webhook HMAC-SHA256 header & replay timestamp window without external SDK dependency.
 */
export function verifyStripeWebhookSignature(
  rawBody,
  signatureHeader,
  webhookSecret,
  { toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000) } = {}
) {
  const secret = String(webhookSecret || '').trim();
  if (!secret) {
    return { ok: false, error: 'STRIPE_WEBHOOK_SECRET is not configured' };
  }

  const header = String(signatureHeader || '').trim();
  if (!header) {
    return { ok: false, error: 'Missing Stripe-Signature header' };
  }

  let timestamp = null;
  const v1Signatures = [];
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't' && /^\d+$/.test(v)) {
      timestamp = Number(v);
    } else if (k === 'v1' && v) {
      v1Signatures.push(v);
    }
  }

  if (!timestamp || v1Signatures.length === 0) {
    return { ok: false, error: 'Malformed Stripe-Signature header' };
  }

  if (Math.abs(Number(nowSeconds) - timestamp) > Number(toleranceSeconds)) {
    return { ok: false, error: 'Stripe webhook timestamp outside replay tolerance window' };
  }

  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, 'utf8'),
    bodyBuf,
  ]);
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const matched = v1Signatures.some((sig) => constantTimeHexEqual(sig, expectedSig));
  if (!matched) {
    return { ok: false, error: 'Invalid Stripe webhook signature' };
  }

  return { ok: true, timestamp };
}

/**
 * Strictly verify retrieved Stripe Checkout Session fields against expected business constraints.
 */
export function verifyVerifiedCheckoutSession(
  session,
  {
    expectedType,
    expectedMode,
    expectedMinAmountMinor,
    expectedCurrency,
  } = {}
) {
  if (!session || typeof session !== 'object') {
    return { ok: false, error: 'نشست پرداخت نامعتبر است.' };
  }

  if (session.payment_status !== 'paid') {
    return { ok: false, error: 'پرداخت هنوز توسط Stripe تسویه نشده است.' };
  }

  if (session.status !== 'complete') {
    return { ok: false, error: 'وضعیت نشست پرداخت تکمیل نشده است.' };
  }

  if (session.mode && session.mode !== 'payment') {
    return { ok: false, error: 'نوع نشست پرداخت معتبر نیست.' };
  }

  if (expectedType && session.metadata?.type !== expectedType) {
    return { ok: false, error: 'نوع تراکنش با درخواست همخوانی ندارد.' };
  }

  if (expectedMode === 'live' && session.livemode !== true) {
    return { ok: false, error: 'تراکنش آزمایشی در حالت عملیاتی پذیرفته نمی‌شود.' };
  }

  if (expectedMode === 'test' && session.livemode !== false) {
    return { ok: false, error: 'تراکنش عملیاتی با حالت آزمایشی همخوانی ندارد.' };
  }

  if (expectedCurrency) {
    const actualCur = String(session.currency || '').trim().toLowerCase();
    const expectedCur = String(expectedCurrency).trim().toLowerCase();
    if (!actualCur || actualCur !== expectedCur) {
      return { ok: false, error: 'واحد پول پرداخت با تعرفه تنظیم‌شده همخوانی ندارد.' };
    }
  }

  if (Number.isFinite(expectedMinAmountMinor) && expectedMinAmountMinor > 0) {
    const actualTotal = Number(session.amount_total);
    if (!Number.isFinite(actualTotal) || actualTotal < expectedMinAmountMinor) {
      return { ok: false, error: 'مبلغ پرداخت‌شده کمتر از تعرفه معتبر است.' };
    }
  }

  return { ok: true };
}
