import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bezbnymjcnmazdonfzky.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemJueW1qY25tYXpkb25memt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTM1NjksImV4cCI6MjExMDI2OTU2OX0.ylsHBAZ1zo1z_aKpHx7hgl-yZu2yt2puFNhR8jBm6S4';

const supabase = createClient(supabaseUrl, supabaseKey);

const PUBLIC_AD_COLUMNS =
  'id, reference_number, title, title_fa, category, country, city, area, price, price_type, description, contact_name, contact_phone, contact_whatsapp, contact_telegram, contact_email, contact_website, images, is_featured, status, views_count, created_at, updated_at';

function isSafeHttpUrl(url) {
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

function generateReferenceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `SP-${yy}${mm}-${rand}`;
}

function generatePinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://swedpersiska.vercel.app,https://farsinord.vercel.app,https://farsinord-admin.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action, id } = req.query || {};

      if (action === 'bootstrap') {
        const { data } = await supabase
          .from('swedpersiska_settings')
          .select('key, value')
          .in('key', ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'portal_countries', 'stripe_settings', 'turnstile_settings', 'analytics_settings']);

        const settings = {};
        (data || []).forEach((item) => {
          if (item.key === 'stripe_settings' && item.value) {
            settings.stripe_settings = {
              enabled: item.value.enabled,
              mode: item.value.mode,
              publishableKey: item.value.publishableKey,
              vipPrice: item.value.vipPrice,
              currency: item.value.currency,
              vipDurationDays: item.value.vipDurationDays,
              vipBadgeText: item.value.vipBadgeText
            };
          } else if (item.key === 'turnstile_settings' && item.value) {
            settings.turnstile_settings = {
              enabled: item.value.enabled,
              mode: item.value.mode,
              siteKey: item.value.siteKey,
              protectPostAd: item.value.protectPostAd
            };
          } else if (item.key === 'site_branding' && item.value) {
            const rawName = (item.value.siteName || '').trim();
            const isLegacy = !rawName || /سوئد\s*پرشیا|سوید\s*پرشیا|پرشیا\s*سو|فارسی\s*نور|swedpersiska|farsi\s*nord|faris\s*nord/i.test(rawName);
            settings.site_branding = {
              ...item.value,
              siteName: isLegacy ? 'لینک شو' : rawName
            };
          } else {
            settings[item.key] = item.value;
          }
        });

        return res.status(200).json({ ok: true, settings });
      }

      if (action === 'ad' && id) {
        const clean = String(id).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        let query = supabase.from('swedpersiska_ads').select(PUBLIC_AD_COLUMNS);
        if (isUuid) {
          query = query.eq('id', clean);
        } else {
          const safeRef = clean.replace(/[^a-zA-Z0-9_-]/g, '');
          if (!safeRef) return res.status(400).json({ ok: false, error: 'Invalid ad reference' });
          query = query.eq('reference_number', safeRef);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return res.status(200).json({ ok: true, ad: data || null });
      }

      // Default GET: list active public ads (without pin_code)
      const { data, error } = await supabase
        .from('swedpersiska_ads')
        .select(PUBLIC_AD_COLUMNS)
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ ok: true, ads: data || [] });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { action } = body;

      if (action === 'create_ad') {
        const {
          title,
          category,
          country,
          city,
          area,
          price,
          price_type,
          description,
          contact_name,
          contact_phone,
          contact_whatsapp,
          contact_telegram,
          contact_email,
          images
        } = body;

        if (!title || !description || !contact_name) {
          return res.status(400).json({ ok: false, error: 'عنوان، توضیحات و نام تماس‌گیرنده الزامی است.' });
        }

        const safeImages = Array.isArray(images) ? images.filter(isSafeHttpUrl) : [];
        const finalImages = safeImages.length > 0
          ? safeImages
          : ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'];

        const refNum = generateReferenceNumber();
        const finalPin = generatePinCode();

        const { data, error } = await supabase
          .from('swedpersiska_ads')
          .insert([
            {
              reference_number: refNum,
              pin_code: finalPin,
              title: String(title).trim().slice(0, 160),
              title_fa: String(title).trim().slice(0, 160),
              category: category || 'bostad',
              country: /^[a-z0-9_-]{2,10}$/i.test(String(country || '')) ? String(country).toLowerCase() : 'se',
              city: String(city || 'Stockholm').trim().slice(0, 80),
              area: area ? String(area).trim().slice(0, 80) : null,
              price: price ? parseFloat(price) : null,
              price_type: price_type || 'kr',
              description: String(description).trim().slice(0, 4000),
              contact_name: String(contact_name).trim().slice(0, 100),
              contact_phone: contact_phone ? String(contact_phone).trim().slice(0, 40) : null,
              contact_whatsapp: contact_whatsapp ? String(contact_whatsapp).trim().slice(0, 40) : null,
              contact_telegram: contact_telegram ? String(contact_telegram).trim().slice(0, 80) : null,
              contact_email: contact_email ? String(contact_email).trim().slice(0, 120) : null,
              contact_website: body.contact_website && isSafeHttpUrl(body.contact_website) ? String(body.contact_website).trim().slice(0, 300) : null,
              images: finalImages,
              is_featured: false,
              status: 'pending',
              views_count: 1
            }
          ])
          .select(PUBLIC_AD_COLUMNS)
          .single();

        if (error) throw error;
        return res.status(200).json({ ok: true, ad: data, reference_number: refNum, pin_code: finalPin });
      }

      if (action === 'verify_pin') {
        const cleanRef = String(body.reference_number || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const cleanPin = String(body.pin_code || '').trim();
        if (!cleanRef || !cleanPin) {
          return res.status(400).json({ ok: false, error: 'لطفا کد مرجع و پین را وارد کنید.' });
        }

        const { data, error } = await supabase
          .from('swedpersiska_ads')
          .select(PUBLIC_AD_COLUMNS)
          .eq('reference_number', cleanRef)
          .eq('pin_code', cleanPin)
          .maybeSingle();

        if (error || !data) {
          return res.status(401).json({ ok: false, error: 'شماره مرجع یا پین کد وارد شده صحیح نیست.' });
        }
        return res.status(200).json({ ok: true, ad: data });
      }

      if (action === 'update_ad') {
        const { id, pin_code, title, price, description, status, contact_phone } = body;
        if (!id || !pin_code) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی و پین الزامی است.' });
        }

        const { data: existingAd } = await supabase
          .from('swedpersiska_ads')
          .select('status')
          .eq('id', id)
          .eq('pin_code', String(pin_code).trim())
          .maybeSingle();

        if (!existingAd) {
          return res.status(401).json({ ok: false, error: 'عدم دسترسی یا پین نامعتبر.' });
        }

        // Prevent pending ads from self-promoting to active via update_ad
        const nextStatus = existingAd.status === 'pending'
          ? 'pending'
          : (status === 'hidden' ? 'hidden' : 'active');

        const { data, error } = await supabase
          .from('swedpersiska_ads')
          .update({
            title: String(title || '').trim().slice(0, 160),
            price: price ? parseFloat(price) : null,
            description: String(description || '').trim().slice(0, 4000),
            status: nextStatus,
            contact_phone: contact_phone ? String(contact_phone).trim().slice(0, 40) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('pin_code', String(pin_code).trim())
          .select(PUBLIC_AD_COLUMNS)
          .single();

        if (error || !data) {
          return res.status(401).json({ ok: false, error: 'عدم دسترسی یا پین نامعتبر.' });
        }
        return res.status(200).json({ ok: true, ad: data });
      }

      if (action === 'delete_ad') {
        const { id, pin_code } = body;
        if (!id || !pin_code) {
          return res.status(400).json({ ok: false, error: 'شناسه آگهی و پین الزامی است.' });
        }

        const { error } = await supabase
          .from('swedpersiska_ads')
          .delete()
          .eq('id', id)
          .eq('pin_code', String(pin_code).trim());

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === 'increment_view') {
        const { id, current_views } = body;
        if (id) {
          await supabase
            .from('swedpersiska_ads')
            .update({ views_count: (Number(current_views) || 0) + 1 })
            .eq('id', id);
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'promote_ad') {
        const { id, country } = body;
        if (!id) return res.status(400).json({ ok: false, error: 'Missing ad ID' });

        const { data: stripeRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'stripe_settings')
          .maybeSingle();

        if (stripeRow?.value?.mode === 'live') {
          return res.status(403).json({ ok: false, error: 'ارتقای ویژه در حالت واقعی نیازمند تایید پرداخت است.' });
        }

        const updatePayload = { is_featured: true };
        if (country && /^[a-z0-9_-]{2,10}$/i.test(String(country))) {
          updatePayload.country = String(country).toLowerCase();
        }

        const { data, error } = await supabase
          .from('swedpersiska_ads')
          .update(updatePayload)
          .eq('id', id)
          .select(PUBLIC_AD_COLUMNS)
          .single();

        if (error) throw error;
        return res.status(200).json({ ok: true, ad: data });
      }

      if (action === 'report_ad') {
        const { id, reference_number, title, reason, details } = body;
        if (!id || !reason) return res.status(400).json({ ok: false, error: 'Missing report fields' });

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'ad_reports')
          .maybeSingle();

        const currentList = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const newReport = {
          id: crypto.randomUUID(),
          ad_id: String(id),
          reference_number: String(reference_number || ''),
          title: String(title || '').slice(0, 140),
          reason: String(reason).slice(0, 80),
          details: String(details || '').slice(0, 400),
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'ad_reports',
            value: [newReport, ...currentList].slice(0, 200),
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
