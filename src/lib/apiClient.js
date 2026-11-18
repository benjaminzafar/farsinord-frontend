import { supabase, PUBLIC_AD_COLUMNS } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
 * Public Frontend API Client (communicates with /api/public & secure Postgres RPCs)
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

    const { data } = await supabase
      .from('swedpersiska_settings')
      .select('key, value')
      .in('key', [
        'site_branding',
        'seo_settings',
        'portal_categories',
        'portal_cities',
        'portal_countries',
        'stripe_settings',
        'turnstile_settings',
        'ad_lifecycle_settings',
      ]);
    const settings = {};
    (data || []).forEach((item) => {
      settings[item.key] = item.value;
    });
    return settings;
  },

  async fetchAds() {
    try {
      const res = await fetch(`${API_BASE}/api/public`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && Array.isArray(json.ads)) {
          return json.ads.map(normalizeClientAd);
        }
      }
    } catch {}

    const { data, error } = await supabase
      .from('swedpersiska_ads')
      .select(PUBLIC_AD_COLUMNS)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('sort_timestamp', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeClientAd);
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

    const clean = rawParam.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    let query = supabase.from('swedpersiska_ads').select(PUBLIC_AD_COLUMNS).is('deleted_at', null);
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
      await supabase.rpc('increment_ad_view', { p_ad_id: id });
    } catch {}
  },

  async reportAd({ id, reason, details }) {
    try {
      await postPublic('report_ad', { id, reason, details });
      return true;
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const { data, error } = await supabase.rpc('report_ad_secure', {
        p_ad_id: id,
        p_reason: reason,
        p_details: details || '',
      });
      if (error || !data?.ok) throw new Error(data?.error || 'خطا در ثبت گزارش');
      return true;
    }
  },

  async promoteAd(id, country) {
    try {
      const json = await postPublic('promote_ad', { id, country });
      return normalizeClientAd(json.ad);
    } catch (err) {
      if (!err.isNetworkOrUnavailable) throw err;
      const { data, error } = await supabase.rpc('activate_ad_promotion_from_payment', {
        p_ad_id: id,
        p_target_country: country || 'se',
        p_provider: 'stripe_test',
        p_session_id: `test_vip_${Date.now()}`,
      });
      if (error || !data?.ok) throw new Error(data?.error || 'خطا در ارتقای آگهی');
      return normalizeClientAd(data.ad);
    }
  },

  async createVipCheckout(id, country) {
    return postPublic('create_vip_checkout', { id, country });
  },

  async verifyVipCheckout(sessionId) {
    const res = await postPublic('verify_vip_checkout', { sessionId });
    return { ...res, ad: normalizeClientAd(res.ad) };
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
};
