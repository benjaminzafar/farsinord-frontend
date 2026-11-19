export const GOOGLE_MAPS_KEY_RE = /^AIza[0-9A-Za-z_-]{20,60}$/;

export const COUNTRY_EN_NAMES = {
  se: 'Sweden',
  no: 'Norway',
  dk: 'Denmark',
  fi: 'Finland',
  de: 'Germany',
  at: 'Austria',
  nl: 'Netherlands',
  fr: 'France',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  ch: 'Switzerland',
  be: 'Belgium',
  es: 'Spain',
  it: 'Italy',
  ca: 'Canada',
  us: 'United States',
  au: 'Australia',
};

export function sanitizeGoogleMapsKey(raw) {
  const clean = String(raw || '')
    .replace(/[\p{Cc}\s\u200B-\u200D\uFEFF]/gu, '')
    .trim();
  return GOOGLE_MAPS_KEY_RE.test(clean) ? clean : '';
}

export function sanitizeLocationPart(raw, maxLen = 100) {
  return String(raw || '')
    .replace(/[\p{Cc}<>]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function resolveCountryEnName(countryCode, countries = []) {
  const code = String(countryCode || '').trim().toLowerCase();
  if (code && COUNTRY_EN_NAMES[code]) return COUNTRY_EN_NAMES[code];
  const found = Array.isArray(countries) ? countries.find((c) => c.id === code) : null;
  return sanitizeLocationPart(found?.nameEn || found?.nameNative || found?.nameFa || code, 60);
}

export function resolveDisplayCityFa({ city, country, countries = [] }) {
  const cleanCity = sanitizeLocationPart(city, 80);
  if (!cleanCity) return '';
  const code = String(country || '').trim().toLowerCase();
  const countryObj = Array.isArray(countries) ? countries.find((c) => c.id === code) : null;
  const matchedCity = (countryObj?.cities || []).find(
    (c) => c.id && c.id.toLowerCase() === cleanCity.toLowerCase()
  );
  return matchedCity?.fa || cleanCity;
}

export function buildGoogleMapsQuery({ area = '', city = '', country = '', countries = [] }) {
  const cleanArea = sanitizeLocationPart(area, 120);
  const cleanCity = sanitizeLocationPart(city, 80);
  const countryName = resolveCountryEnName(country, countries);

  // Avoid repeating city name if user already typed city inside area
  const parts = [];
  if (cleanArea) parts.push(cleanArea);
  if (cleanCity && !cleanArea.toLowerCase().includes(cleanCity.toLowerCase())) {
    parts.push(cleanCity);
  }
  if (countryName && parts.length > 0 && !parts.join(' ').toLowerCase().includes(countryName.toLowerCase())) {
    parts.push(countryName);
  }
  return parts.join(', ').slice(0, 180).trim();
}

export function buildGoogleMapsEmbedUrl({
  query = '',
  country = '',
  hasArea = false,
  settings = null,
}) {
  if (settings && settings.enabled === false) return null;
  const cleanQuery = sanitizeLocationPart(query, 180);
  if (!cleanQuery) return null;

  const configuredZoom = Number(settings?.defaultZoom);
  const baseZoom =
    Number.isInteger(configuredZoom) && configuredZoom >= 1 && configuredZoom <= 20
      ? configuredZoom
      : 14;
  const zoom = hasArea ? Math.max(baseZoom, 14) : Math.min(baseZoom, 12);
  const apiKey = sanitizeGoogleMapsKey(settings?.embedApiKey);

  if (apiKey) {
    const url = new URL('https://www.google.com/maps/embed/v1/place');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', cleanQuery);
    url.searchParams.set('zoom', String(zoom));
    url.searchParams.set('language', 'fa');
    const cc = String(country || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) {
      url.searchParams.set('region', cc);
    }
    return url.toString();
  }

  const fallbackUrl = new URL('https://maps.google.com/maps');
  fallbackUrl.searchParams.set('q', cleanQuery);
  fallbackUrl.searchParams.set('t', '');
  fallbackUrl.searchParams.set('z', String(zoom));
  fallbackUrl.searchParams.set('ie', 'UTF8');
  fallbackUrl.searchParams.set('iwloc', '');
  fallbackUrl.searchParams.set('output', 'embed');
  fallbackUrl.searchParams.set('hl', 'fa');
  return fallbackUrl.toString();
}

export function buildGoogleMapsSearchUrl(query = '') {
  const cleanQuery = sanitizeLocationPart(query, 180);
  if (!cleanQuery) return '';
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', cleanQuery);
  return url.toString();
}
