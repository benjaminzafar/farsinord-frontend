const STORAGE_KEY = 'linksho_my_ads_v1';

export function getSavedAdCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.reference_number && item.pin_code)
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function saveAdCredential({ reference_number, pin_code, title = '' }) {
  if (!reference_number || !pin_code) return;
  const cleanRef = String(reference_number).trim().toUpperCase();
  const cleanPin = String(pin_code).trim();
  if (!cleanRef || !cleanPin) return;

  try {
    const existing = getSavedAdCredentials().filter(
      (item) => String(item.reference_number).toUpperCase() !== cleanRef
    );
    const next = [
      {
        reference_number: cleanRef,
        pin_code: cleanPin,
        title: String(title || '').slice(0, 140),
        saved_at: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function removeAdCredential(reference_number) {
  if (!reference_number) return;
  const cleanRef = String(reference_number).trim().toUpperCase();
  try {
    const next = getSavedAdCredentials().filter(
      (item) => String(item.reference_number).toUpperCase() !== cleanRef
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}
