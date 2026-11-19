/**
 * Zero-dependency URL safety & public ad column helpers.
 * Kept separate from supabase.js so the 211 KB Supabase SDK is never eagerly loaded.
 */
export const PUBLIC_AD_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, contact_name, contact_phone, contact_whatsapp, contact_telegram, contact_email, contact_website, images, is_featured, status, views_count, created_at, updated_at, last_boosted_at, last_meaningful_activity_at, sort_timestamp, next_free_boost_at, boost_count, duplicate_detection_status, cleanup_warning_sent_at, scheduled_deletion_at, deleted_at, promotion_expires_at';

export const PUBLIC_AD_LIST_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, images, is_featured, views_count, created_at, sort_timestamp, promotion_expires_at';

export function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
