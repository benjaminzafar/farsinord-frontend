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
          .in('key', ['site_branding', 'seo_settings', 'portal_categories', 'portal_cities', 'portal_countries', 'stripe_settings', 'turnstile_settings', 'analytics_settings', 'podcast_settings']);

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

      if (action === 'get_podcast_feed') {
        const { data: podcastRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'podcast_settings')
          .maybeSingle();

        const podcast = (podcastRow && podcastRow.value) || {
          enabled: true,
          title: 'پادکست خبری لینک شو',
          subtitle: 'تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا',
          youtubeChannelUrl: '',
          youtubeChannelId: '',
          manualVideos: [],
        };

        const manualList = Array.isArray(podcast.manualVideos)
          ? podcast.manualVideos.filter((v) => v && v.videoId).map((v) => ({
              videoId: v.videoId,
              title: v.title || 'پادکست خبری',
              publishedAt: v.addedAt || '',
              description: '',
              thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              watchUrl: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
              source: 'pinned',
            }))
          : [];

        let channelId = String(podcast.youtubeChannelId || '').trim();
        const chUrl = String(podcast.youtubeChannelUrl || '').trim();
        if (!/^UC[\w-]{10,}$/.test(channelId) && chUrl) {
          const directMatch = chUrl.match(/youtube\.com\/channel\/(UC[\w-]{10,})/i);
          if (directMatch) {
            channelId = directMatch[1];
          } else if (/^https?:\/\/(www\.|m\.)?youtube\.com\//i.test(chUrl)) {
            try {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 5000);
              const htmlRes = await fetch(chUrl, {
                signal: ctrl.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkShoBot/1.0)' },
              });
              clearTimeout(timer);
              if (htmlRes.ok) {
                const html = await htmlRes.text();
                const idMatch =
                  html.match(/"channelId":"(UC[\w-]{10,})"/) ||
                  html.match(/"externalId":"(UC[\w-]{10,})"/) ||
                  html.match(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{10,})"/i);
                if (idMatch) channelId = idMatch[1];
              }
            } catch {}
          }
        }

        const rssEpisodes = [];
        if (/^UC[\w-]{10,}$/.test(channelId)) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (feedRes.ok) {
              const xml = await feedRes.text();
              const decodeXml = (str) =>
                String(str || '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'");
              const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
              entries.slice(0, 15).forEach((entry) => {
                const vid = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
                const title = decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
                const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
                const desc = decodeXml((entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
                if (vid) {
                  rssEpisodes.push({
                    videoId: vid,
                    title: title || 'پادکست خبری',
                    publishedAt: published,
                    description: desc.slice(0, 400),
                    thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                    watchUrl: `https://www.youtube.com/watch?v=${vid}`,
                    source: 'youtube',
                  });
                }
              });
            }
          } catch {}
        }

        // Merge pinned manual videos + live YouTube RSS episodes (deduped by videoId)
        const seen = new Set();
        const episodes = [];
        [...manualList, ...rssEpisodes].forEach((ep) => {
          if (!ep.videoId || seen.has(ep.videoId)) return;
          seen.add(ep.videoId);
          episodes.push(ep);
        });

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json({ ok: true, settings: podcast, channelId, episodes });
      }

      if (action === 'get_ad_seller_api') {
        const adId = String(req.query?.ad_id || '').trim();
        if (!adId) {
          return res.status(200).json({ ok: true, seller_api_url: '' });
        }
        const { data: linkRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'ad_seller_links')
          .maybeSingle();
        const links = (linkRow && linkRow.value && typeof linkRow.value === 'object') ? linkRow.value : {};
        return res.status(200).json({ ok: true, seller_api_url: links[adId] || '' });
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

        if (data?.id && body.seller_api_url && isSafeHttpUrl(body.seller_api_url)) {
          try {
            const { data: linkRow } = await supabase
              .from('swedpersiska_settings')
              .select('value')
              .eq('key', 'ad_seller_links')
              .maybeSingle();
            const prevLinks = (linkRow && linkRow.value && typeof linkRow.value === 'object') ? linkRow.value : {};
            await supabase.from('swedpersiska_settings').upsert({
              key: 'ad_seller_links',
              value: { ...prevLinks, [data.id]: String(body.seller_api_url).trim().slice(0, 500) },
              updated_at: new Date().toISOString()
            });
          } catch {}
        }

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

      if (action === 'submit_website_order') {
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').trim();
        const companyNumber = String(body.companyNumber || '').trim();
        const email = String(body.email || '').trim();

        if (!name || !phone || !companyNumber || !email) {
          return res.status(400).json({
            ok: false,
            error: 'لطفاً نام سایت، شماره تماس، شماره ثبت شرکت و ایمیل را کامل وارد کنید.',
          });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];

        const orderId = `WEB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const manageCode = String(crypto.randomInt(10000000, 100000000));
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const newOrder = {
          storeId: orderId,
          manageCode,
          workerName: `sub_${orderId.toLowerCase()}`,
          dbId: '',
          name: name.slice(0, 120),
          phone: phone.slice(0, 40),
          companyNumber: companyNumber.slice(0, 60),
          email: email.slice(0, 120),
          panelUrl: '',
          storefrontApiUrl: '',
          status: 'pending_setup',
          monthlyPrice: 260,
          expiresAt,
          createdAt,
        };

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: [newOrder, ...prev].slice(0, 500),
          updated_at: createdAt,
        });

        return res.status(200).json({ ok: true, order: newOrder });
      }

      if (action === 'manage_website_subscription') {
        const cleanCode = String(body.manageCode || '').replace(/\D/g, '').trim();
        const subAction = String(body.subAction || 'lookup').trim();
        if (cleanCode.length !== 8) {
          return res.status(400).json({ ok: false, error: 'لطفاً کد مدیریت ۸ رقمی معتبر وارد کنید.' });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const list = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const idx = list.findIndex((item) => String(item.manageCode || '') === cleanCode);
        if (idx === -1) {
          return res.status(404).json({ ok: false, error: 'اشتراکی با این کد ۸ رقمی یافت نشد.' });
        }

        const current = list[idx];
        if (subAction === 'renew') {
          const baseTime = current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
            ? new Date(current.expiresAt).getTime()
            : Date.now();
          const updated = {
            ...current,
            status: current.status === 'cancelled' ? 'pending_setup' : current.status,
            expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          return res.status(200).json({ ok: true, subscription: updated });
        }

        if (subAction === 'cancel') {
          const updated = { ...current, status: 'cancelled' };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          return res.status(200).json({ ok: true, subscription: updated });
        }

        return res.status(200).json({ ok: true, subscription: current });
      }

      if (action === 'deploy_seller_website') {
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').trim();
        const companyNumber = String(body.companyNumber || '').trim();
        const email = String(body.email || '').trim();

        if (!name || !phone || !companyNumber || !email) {
          return res.status(400).json({
            ok: false,
            error: 'لطفاً نام سایت، شماره تماس، شماره ثبت شرکت و ایمیل را کامل وارد کنید.',
          });
        }

        const { data: cfRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'cloudflare_deploy_settings')
          .maybeSingle();

        const cfCfg = (cfRow && cfRow.value) || {};
        const cfToken = String(cfCfg.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
        const accountId = String(cfCfg.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
        const deployEndpoint = String(
          cfCfg.deployUrl || process.env.SELLER_DEPLOY_URL || 'https://linksho-seller.vercel.app/api/cloudflare/deploy'
        ).trim();

        if (!cfToken) {
          return res.status(503).json({
            ok: false,
            error: 'توکن کلودفلر هنوز در پنل ادمین تنظیم نشده است.',
          });
        }

        const deployRes = await fetch(deployEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cfToken,
            accountId,
            name,
            phone,
            companyNumber,
            email,
            type: 'webshop',
            currency: 'SEK',
            shippingFee: 0,
          }),
        });

        const deployJson = await deployRes.json().catch(() => ({}));
        if (!deployRes.ok || !deployJson?.ok) {
          return res.status(deployRes.status || 500).json({
            ok: false,
            error: deployJson?.error || 'خطا در ساخت خودکار وب‌سایت روی کلودفلر.',
          });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const nextList = [
          {
            storeId: String(deployJson.storeId || ''),
            name: name.slice(0, 120),
            phone: phone.slice(0, 40),
            companyNumber: companyNumber.slice(0, 60),
            email: email.slice(0, 120),
            panelUrl: String(deployJson.panelUrl || '').slice(0, 300),
            storefrontApiUrl: String(deployJson.storefrontApiUrl || '').slice(0, 400),
            workerName: String(deployJson.workerName || '').slice(0, 100),
            dbId: String(deployJson.dbId || '').slice(0, 100),
            monthlyPrice: 260,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: deployJson.createdAt || new Date().toISOString(),
          },
          ...prev.filter((x) => x.workerName !== deployJson.workerName),
        ].slice(0, 500);

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });

        return res.status(200).json({
          ok: true,
          panelUrl: deployJson.panelUrl,
          storefrontApiUrl: deployJson.storefrontApiUrl,
          pinCode: deployJson.pinCode,
          storeId: deployJson.storeId,
        });
      }

      if (action === 'register_seller_deployment') {
        const dep = body.deployment;
        if (!dep || !dep.workerName || !dep.panelUrl) {
          return res.status(400).json({ ok: false, error: 'Missing deployment metadata' });
        }
        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const nextList = [
          {
            storeId: String(dep.storeId || ''),
            name: String(dep.name || '').slice(0, 120),
            type: dep.type === 'restaurant' ? 'restaurant' : 'webshop',
            currency: String(dep.currency || 'SEK').slice(0, 10),
            panelUrl: String(dep.panelUrl || '').slice(0, 300),
            storefrontApiUrl: String(dep.storefrontApiUrl || '').slice(0, 400),
            workerName: String(dep.workerName || '').slice(0, 100),
            dbId: String(dep.dbId || '').slice(0, 100),
            monthlyPrice: Number(dep.monthlyPrice) || 240,
            createdAt: dep.createdAt || new Date().toISOString(),
          },
          ...prev.filter((x) => x.workerName !== dep.workerName),
        ].slice(0, 500);

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });
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

      if (action === 'submit_website_order') {
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').trim();
        const companyNumber = String(body.companyNumber || '').trim();
        const email = String(body.email || '').trim();

        if (!name || !phone || !companyNumber || !email) {
          return res.status(400).json({
            ok: false,
            error: 'لطفاً نام سایت، شماره تماس، شماره ثبت شرکت و ایمیل را کامل وارد کنید.',
          });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];

        const orderId = `WEB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const manageCode = String(crypto.randomInt(10000000, 100000000));
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const newOrder = {
          storeId: orderId,
          manageCode,
          workerName: `sub_${orderId.toLowerCase()}`,
          dbId: '',
          name: name.slice(0, 120),
          phone: phone.slice(0, 40),
          companyNumber: companyNumber.slice(0, 60),
          email: email.slice(0, 120),
          panelUrl: '',
          storefrontApiUrl: '',
          status: 'pending_setup',
          monthlyPrice: 260,
          expiresAt,
          createdAt,
        };

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: [newOrder, ...prev].slice(0, 500),
          updated_at: createdAt,
        });

        return res.status(200).json({ ok: true, order: newOrder });
      }

      if (action === 'manage_website_subscription') {
        const cleanCode = String(body.manageCode || '').replace(/\D/g, '').trim();
        const subAction = String(body.subAction || 'lookup').trim();
        if (cleanCode.length !== 8) {
          return res.status(400).json({ ok: false, error: 'لطفاً کد مدیریت ۸ رقمی معتبر وارد کنید.' });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const list = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const idx = list.findIndex((item) => String(item.manageCode || '') === cleanCode);
        if (idx === -1) {
          return res.status(404).json({ ok: false, error: 'اشتراکی با این کد ۸ رقمی یافت نشد.' });
        }

        const current = list[idx];
        if (subAction === 'renew') {
          const baseTime = current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
            ? new Date(current.expiresAt).getTime()
            : Date.now();
          const updated = {
            ...current,
            status: current.status === 'cancelled' ? 'pending_setup' : current.status,
            expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          return res.status(200).json({ ok: true, subscription: updated });
        }

        if (subAction === 'cancel') {
          const updated = { ...current, status: 'cancelled' };
          const nextList = list.map((x, i) => (i === idx ? updated : x));
          await supabase.from('swedpersiska_settings').upsert({
            key: 'seller_deployments',
            value: nextList,
            updated_at: new Date().toISOString(),
          });
          return res.status(200).json({ ok: true, subscription: updated });
        }

        return res.status(200).json({ ok: true, subscription: current });
      }

      if (action === 'deploy_seller_website') {
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').trim();
        const companyNumber = String(body.companyNumber || '').trim();
        const email = String(body.email || '').trim();

        if (!name || !phone || !companyNumber || !email) {
          return res.status(400).json({
            ok: false,
            error: 'لطفاً نام سایت، شماره تماس، شماره ثبت شرکت و ایمیل را کامل وارد کنید.',
          });
        }

        const { data: cfRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'cloudflare_deploy_settings')
          .maybeSingle();

        const cfCfg = (cfRow && cfRow.value) || {};
        const cfToken = String(cfCfg.apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
        const accountId = String(cfCfg.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
        const deployEndpoint = String(
          cfCfg.deployUrl || process.env.SELLER_DEPLOY_URL || 'https://linksho-seller.vercel.app/api/cloudflare/deploy'
        ).trim();

        if (!cfToken) {
          return res.status(503).json({
            ok: false,
            error: 'توکن کلودفلر هنوز در پنل ادمین تنظیم نشده است.',
          });
        }

        const deployRes = await fetch(deployEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cfToken,
            accountId,
            name,
            phone,
            companyNumber,
            email,
            type: 'webshop',
            currency: 'SEK',
            shippingFee: 0,
          }),
        });

        const deployJson = await deployRes.json().catch(() => ({}));
        if (!deployRes.ok || !deployJson?.ok) {
          return res.status(deployRes.status || 500).json({
            ok: false,
            error: deployJson?.error || 'خطا در ساخت خودکار وب‌سایت روی کلودفلر.',
          });
        }

        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const nextList = [
          {
            storeId: String(deployJson.storeId || ''),
            name: name.slice(0, 120),
            phone: phone.slice(0, 40),
            companyNumber: companyNumber.slice(0, 60),
            email: email.slice(0, 120),
            panelUrl: String(deployJson.panelUrl || '').slice(0, 300),
            storefrontApiUrl: String(deployJson.storefrontApiUrl || '').slice(0, 400),
            workerName: String(deployJson.workerName || '').slice(0, 100),
            dbId: String(deployJson.dbId || '').slice(0, 100),
            monthlyPrice: 260,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: deployJson.createdAt || new Date().toISOString(),
          },
          ...prev.filter((x) => x.workerName !== deployJson.workerName),
        ].slice(0, 500);

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });

        return res.status(200).json({
          ok: true,
          panelUrl: deployJson.panelUrl,
          storefrontApiUrl: deployJson.storefrontApiUrl,
          pinCode: deployJson.pinCode,
          storeId: deployJson.storeId,
        });
      }

      if (action === 'register_seller_deployment') {
        const dep = body.deployment;
        if (!dep || !dep.workerName || !dep.panelUrl) {
          return res.status(400).json({ ok: false, error: 'Missing deployment metadata' });
        }
        const { data: existingRow } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'seller_deployments')
          .maybeSingle();
        const prev = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const nextList = [
          {
            storeId: String(dep.storeId || ''),
            name: String(dep.name || '').slice(0, 120),
            type: dep.type === 'restaurant' ? 'restaurant' : 'webshop',
            currency: String(dep.currency || 'SEK').slice(0, 10),
            panelUrl: String(dep.panelUrl || '').slice(0, 300),
            storefrontApiUrl: String(dep.storefrontApiUrl || '').slice(0, 400),
            workerName: String(dep.workerName || '').slice(0, 100),
            dbId: String(dep.dbId || '').slice(0, 100),
            monthlyPrice: Number(dep.monthlyPrice) || 240,
            createdAt: dep.createdAt || new Date().toISOString(),
          },
          ...prev.filter((x) => x.workerName !== dep.workerName),
        ].slice(0, 500);

        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
