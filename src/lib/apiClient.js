import { supabase, PUBLIC_AD_COLUMNS } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Public Frontend API Client (communicates with /api/public, with resilient fallback)
 */
export const publicApi = {
  async fetchBootstrap() {
    try {
      const res = await fetch(`${API_BASE}/api/public?action=bootstrap`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.settings) return json.settings;
      }
    } catch {}

    // Fallback if serverless function is not mounted in static dev preview
    const { data } = await supabase
      .from('swedpersiska_settings')
      .select('key, value')
      .in('key', ['site_branding', 'seo_settings', 'portal_categories', 'stripe_settings', 'turnstile_settings']);
    const settings = {};
    (data || []).forEach((item) => {
      settings[item.key] = item.value;
    });
    return settings;
  },

  async fetchAds() {
    try {
      const res = await fetch(`${API_BASE}/api/public`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && Array.isArray(json.ads)) return json.ads;
      }
    } catch {}

    const { data, error } = await supabase
      .from('swedpersiska_ads')
      .select(PUBLIC_AD_COLUMNS)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchAdByParam(rawParam) {
    if (!rawParam) return null;
    try {
      const res = await fetch(`${API_BASE}/api/public?action=ad&id=${encodeURIComponent(rawParam)}`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok) return json.ad || null;
      }
    } catch {}

    const clean = rawParam.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    let query = supabase.from('swedpersiska_ads').select(PUBLIC_AD_COLUMNS);
    if (isUuid) {
      query = query.eq('id', clean);
    } else {
      const safeRef = clean.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeRef) return null;
      query = query.eq('reference_number', safeRef);
    }
    const { data } = await query.maybeSingle();
    return data || null;
  },

  async incrementView(id, currentViews) {
    try {
      const res = await fetch(`${API_BASE}/api/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_view', id, current_views: currentViews })
      });
      if (res.ok) return;
    } catch {}

    await supabase
      .from('swedpersiska_ads')
      .update({ views_count: (Number(currentViews) || 0) + 1 })
      .eq('id', id);
  },

  async presignUpload({ fileName, contentType, fileSize }) {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, fileSize })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'خطا در دریافت مجوز آپلود تصویر');
    }
    return json;
  }
};
