const GDPR_STORAGE_KEY = 'scandi_gdpr_consent';

export function getGdprConsent() {
  try {
    const raw = localStorage.getItem(GDPR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.accepted === true) {
      return {
        accepted: true,
        essential: true,
        analytics: Boolean(parsed.analytics),
        updatedAt: parsed.updatedAt || null,
      };
    }
  } catch {}
  return null;
}

export function saveGdprConsent({ analytics = false } = {}) {
  const payload = {
    accepted: true,
    essential: true,
    analytics: Boolean(analytics),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(GDPR_STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem('scandi_country_popup_seen', 'true');
  } catch {}
  return payload;
}
