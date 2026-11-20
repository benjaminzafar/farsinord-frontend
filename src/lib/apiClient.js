import { PUBLIC_AD_COLUMNS, PUBLIC_AD_LIST_COLUMNS } from './urlUtils';
import { extractServerSearchTokens, buildTitleDescriptionOrFilter } from './smartSearch';
import { searchWithCloudflareAi } from './cloudflareSearch';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

let _sbModulePromise = null;
async function getFallbackSupabase() {
  if (!_sbModulePromise) {
    _sbModulePromise = import('./supabase').then((m) => m.supabase);
  }
  return _sbModulePromise;
}

function normalizeClientAd(ad) {
  if (!ad) return ad;
  const expMs = ad.promotion_expires_at ? Date.parse(ad.promotion_expires_at) : NaN;
  const isActiveVip = Boolean(ad.is_featured && (!ad.promotion_expires_at || (!Number.isNaN(expMs) && expMs > Date.now())));
  return {
    ...ad,
    is_featured: isActiveVip,
    is_active_vip: isActiveVip,
  };
}

function makeApiError(json, fallbackMsg, status = 400) {
  const err = new Error(json?.error || fallbackMsg);
  err.status = status;
  if (json?.code) err.code = json.code;
  if (json?.duplicateMatch) err.duplicateMatch = json.duplicateMatch;
  if (json?.reasons) err.reasons = json.reasons;
  if (json?.next_free_boost_at) err.next_free_boost_at = json.next_free_boost_at;
  if (json?.cooldown_remaining_seconds !== undefined) err.cooldown_remaining_seconds = json.cooldown_remaining_seconds;
  return err;
}

async function postPublic(action, payload = {}) {
  const res = await fetch(`${API_BASE}/api/public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const err = new Error('خطا در ارتباط با سرور');
    err.isNetworkOrUnavailable = true;
    throw err;
  }
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw makeApiError(json, 'درخواست با خطا مواجه شد.', res.status);
  }
  return json;
}

/**
 * Public Frontend API Client (communicates with /api/public & lazy Supabase fallback)
 */
export const publicApi = {
  async fetchBootstrap() {
    try {
      const res = await fetch(`${API_BASE}/api/public?action=bootstrap`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && json.settings) return json.settings;
      }
    } catch {}

    const supabase = await getFallbackSupabase();
    const { data } = await supabase
      .from('swedpersiska_settings')
      .select('key, value')
      .in('key', [
        'site_branding',
        'seo_settings',
        'portal_cities',
        'portal_countries',
        'stripe_settings',
        'turnstile_settings',
        'analytics_settings',
        'google_maps_settings',
        'ad_lifecycle_settings',
      ]);
    const settings = {};
    (data || []).forEach((item) => {
      settings[item.key] = item.value;
    });
    return settings;
  },

  async fetchAdsPage({
    page = 1,
    limit = 16,
    country = 'all',
    category = 'all',
    city = 'all',
    q = '',
    sort = '',
    featuredOnly = false,
    includeFeatured = false,
    featuredLimit = 12,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(48, Math.max(1, Number(limit) || 16));
    const trimmedQ = String(q || '').trim();

    // 1. Cloudflare AI Search as PRIMARY provider for normal user search queries
    if (trimmedQ && safePage === 1 && !featuredOnly) {
      try {
        const cfRes = await searchWithCloudflareAi({
          query: trimmedQ,
          country,
          category,
          city,
          limit: safeLimit,
        });
        if (cfRes && Array.isArray(cfRes.ads) && cfRes.ads.length > 0) {
          return {
            ads: cfRes.ads.map(normalizeClientAd),
            total: cfRes.total ?? cfRes.ads.length,
            page: 1,
            limit: safeLimit,
            hasMore: Boolean(cfRes.hasMore),
            source: 'cloudflare_ai',
          };
        }
      } catch (cfErr) {
        // Automatic fallback on any error, timeout, or rate-limit
        console.warn('Cloudflare AI Search unavailable or unusable, falling back to Linksho search:', cfErr);
      }
    }

    // 2. Existing Linksho Search Implementation (Reliable Fallback)
    const params = new URLSearchParams({
      page: String(safePage),
      limit: String(safeLimit),
    });
    if (country && country !== 'all') params.set('country', country);
    if (category && category !== 'all') params.set('category', category);
    if (city && city !== 'all') params.set('city', city);
    if (q && String(q).trim()) params.set('q', String(q).trim());
    if (sort) params.set('sort', sort);
    if (featuredOnly) params.set('featuredOnly', 'true');
    if (includeFeatured && !featuredOnly && safePage === 1) {
      params.set('includeFeatured', '1');
      params.set('featuredLimit', String(featuredLimit));
    }

    try {
      const res = await fetch(`${API_BASE}/api/public?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && Array.isArray(json.ads)) {
          const out = {
            ads: json.ads.map(normalizeClientAd),
            total: json.total !== undefined ? Number(json.total) : undefined,
            page: Number(json.page ?? safePage) || safePage,
            limit: Number(json.limit ?? safeLimit) || safeLimit,
            hasMore: Boolean(json.hasMore),
          };
          if (Array.isArray(json.featuredAds)) {
            out.featuredAds = json.featuredAds.map(normalizeClientAd);
          }
          return out;
        }
      }
    } catch {}

    const supabase = await getFallbackSupabase();
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;
    let query = supabase
      .from('swedpersiska_ads')
      .select(PUBLIC_AD_LIST_COLUMNS, { count: 'exact' })
      .eq('status', 'active')
      .is('deleted_at', null);

    if (country && country !== 'all') query = query.eq('country', country);
    if (category && category !== 'all') query = query.eq('category', category);
    if (city && city !== 'all') query = query.eq('city', city);
    if (featuredOnly) {
      const nowIso = new Date().toISOString();
      query = query.eq('is_featured', true).or(`promotion_expires_at.is.null,promotion_expires_at.gt.${nowIso}`);
    }
    if (q && String(q).trim()) {
      const searchTokens = extractServerSearchTokens(q);
      for (const tok of searchTokens) {
        query = query.or(buildTitleDescriptionOrFilter(tok));
      }
    }

    if (sort === 'most_viewed') {
      query = query
        .order('is_featured', { ascending: false })
        .order('views_count', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    } else if (sort === 'price_asc') {
      query = query
        .order('is_featured', { ascending: false })
        .order('price', { ascending: true, nullsFirst: false })
        .order('sort_timestamp', { ascending: false })
        .order('id', { ascending: false });
    } else if (sort === 'price_desc') {
      query = query
        .order('is_featured', { ascending: false })
        .order('price', { ascending: false, nullsFirst: true })
        .order('sort_timestamp', { ascending: false })
        .order('id', { ascending: false });
    } else {
      query = query
        .order('is_featured', { ascending: false })
        .order('sort_timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;
    const normalized = (data || []).map(normalizeClientAd);
    const total = count ?? normalized.length;
    return {
      ads: normalized,
      featuredAds: includeFeatured ? normalized.filter((a) => a.is_active_vip).slice(0, featuredLimit) : undefined,
      total,
      page: safePage,
      limit: safeLimit,
      hasMore: to + 1 < total,
    };
  },

  async fetchAds() {
    const res = await this.fetchAdsPage({ page: 1, limit: 48 });
    return res.ads;
  },

  async fetchAdByParam(rawParam) {
    if (!rawParam) return null;
    try {
      const res = await fetch(`${API_BASE}/api/public?action=ad&id=${encodeURIComponent(rawParam)}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok) return normalizeClientAd(json.ad) || null;
      }
    } catch {}

    const supabase = await getFallbackSupabase();
    const clean = rawParam.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    let query = supabase
      .from('swedpersiska_ads')
      .select(PUBLIC_AD_COLUMNS)
      .eq('status', 'active')
      .is('deleted_at', null);
    if (isUuid) {
      query = query.eq('id', clean);
    } else {
      const safeRef = clean.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeRef) return null;
      query = query.eq('reference_number', safeRef);
    }
    const { data } = await query.maybeSingle();
    return normalizeClientAd(data) || null;
  },

  async createAd(payload) {
    return postPublic('create_ad', payload);
  },

  async verifyAdPin(reference_number, pin_code) {
    try {
      return await postPublic('verify_pin', { reference_number, pin_code });
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { data, error } = await supabase.rpc('owner_verify_ad', {
        p_reference_number: reference_number,
        p_pin_code: pin_code,
      });
      if (error) throw error;
      if (!data?.ok) throw makeApiError(data, 'شماره مرجع یا پین کد وارد شده صحیح نیست.', 401);
      return data;
    }
  },

  async listOwnerAds(credentials = []) {
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return { ok: true, ads: [], count: 0 };
    }
    try {
      return await postPublic('owner_list_ads', { credentials });
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { data, error } = await supabase.rpc('owner_list_ads', { p_credentials: credentials });
      if (error) throw error;
      return data || { ok: true, ads: [], count: 0 };
    }
  },

  async boostAd(id, pin_code) {
    try {
      return await postPublic('boost_ad', { id, pin_code });
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { data, error } = await supabase.rpc('boost_ad_free', { p_ad_id: id, p_pin_code: pin_code });
      if (error) throw error;
      if (!data?.ok) {
        throw makeApiError({ ...data, code: data?.error_code }, 'امکان بوست آگهی وجود ندارد.', 400);
      }
      return data;
    }
  },

  async updateAd(payload) {
    try {
      return await postPublic('update_ad', payload);
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { id, pin_code, ...rest } = payload;
      const { data, error } = await supabase.rpc('owner_update_ad', {
        p_ad_id: id,
        p_pin_code: pin_code,
        p_updates: rest,
      });
      if (error) throw error;
      if (!data?.ok) throw makeApiError(data, 'خطا در ویرایش آگهی.', 400);
      return data;
    }
  },

  async deleteAd(id, pin_code) {
    try {
      return await postPublic('delete_ad', { id, pin_code });
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { data, error } = await supabase.rpc('owner_soft_delete_ad', { p_ad_id: id, p_pin_code: pin_code });
      if (error) throw error;
      if (!data?.ok) throw makeApiError(data, 'خطا در حذف آگهی.', 400);
      return data;
    }
  },

  async incrementView(id) {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_view', id }),
      });
      if (res.ok) return;
    } catch {}

    try {
      const supabase = await getFallbackSupabase();
      await supabase.rpc('increment_ad_view', { p_ad_id: id });
    } catch {}
  },

  async reportAd({ id, reason, details }) {
    try {
      await postPublic('report_ad', { id, reason, details });
      return true;
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const supabase = await getFallbackSupabase();
      const { data, error } = await supabase.rpc('report_ad_secure', {
        p_ad_id: id,
        p_reason: reason,
        p_details: details || '',
      });
      if (error || !data?.ok) throw new Error(data?.error || 'خطا در ثبت گزارش');
      return true;
    }
  },

  async createVipCheckout(id, country, pin_code) {
    return postPublic('create_vip_checkout', { id, country, pin_code });
  },

  async verifyVipCheckout(sessionId) {
    const res = await postPublic('verify_vip_checkout', { sessionId });
    return { ...res, ad: normalizeClientAd(res.ad) };
  },

  async geocodeLocation({ q, country = '' }) {
    const cleanQ = String(q || '').trim();
    if (cleanQ.length < 2) return null;
    try {
      const qs = new URLSearchParams({ action: 'geocode', q: cleanQ });
      if (country) qs.set('country', country);
      const res = await fetch(`${API_BASE}/api/public?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      return json?.ok ? (json.result || null) : null;
    } catch {
      return null;
    }
  },

  async reverseGeocodeLocation({ lat, lng }) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
    try {
      const qs = new URLSearchParams({
        action: 'reverse_geocode',
        lat: String(lat),
        lng: String(lng),
      });
      const res = await fetch(`${API_BASE}/api/public?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return '';
      const json = await res.json().catch(() => null);
      return json?.ok && typeof json.label === 'string' ? json.label : '';
    } catch {
      return '';
    }
  },

  async presignUpload({ fileName, contentType, fileSize }) {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, fileSize }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'خطا در دریافت مجوز آپلود تصویر');
    }
    return json;
  },

  async uploadPhoto({ fileName, contentType, fileSize, fileBase64 }) {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, fileSize, fileBase64 }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json?.error || 'خطا در آپلود تصویر');
    }
    return json;
  },
};
