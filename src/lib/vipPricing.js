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

const EUR_RATES = {
  EUR: 1,
  SEK: 10,
  NOK: 10,
  DKK: 7.5,
};

/**
 * Compute authoritative VIP pricing matching api/_lib/stripeSecurity.js 1-to-1.
 */
export function computeClientVipPrice({ stripeSettings = {}, targetCountry = 'se' } = {}) {
  const cfg = stripeSettings && typeof stripeSettings === 'object' ? stripeSettings : {};
  const country = String(targetCountry || 'se').trim().toLowerCase() || 'se';
  const rawDuration = Number(cfg.vipDurationDays);
  const durationDays = Number.isFinite(rawDuration)
    ? Math.max(1, Math.min(365, Math.round(rawDuration)))
    : 30;

  const rawPrice = Number(cfg.vipPrice);
  const basePrice = Number.isFinite(rawPrice) && rawPrice >= 1 ? rawPrice : 99;
  const rawCfgCur = String(cfg.currency || 'SEK').trim().toUpperCase();
  const cfgCurrency = EUR_RATES[rawCfgCur] ? rawCfgCur : 'SEK';
  const currency = COUNTRY_CURRENCY_MAP[country] || cfgCurrency;

  let amountMajor = basePrice;
  if (currency !== cfgCurrency) {
    const inEur = basePrice / EUR_RATES[cfgCurrency];
    const converted = inEur * EUR_RATES[currency];
    amountMajor = currency === 'EUR' ? Math.max(1, Math.round(converted)) : Math.max(10, Math.round(converted));
  }

  return {
    targetCountry: country,
    durationDays,
    currency,
    amountMajor,
    amountMinor: Math.max(100, Math.round(amountMajor * 100)),
  };
}
