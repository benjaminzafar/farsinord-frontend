import { createClient } from '@supabase/supabase-js';
import {
  COUNTRY_CURRENCY_MAP,
  computeVipPrice,
  verifyStripeWebhookSignature,
  verifyVerifiedCheckoutSession,
} from './_lib/stripeSecurity.js';
import { resolveStripeWebhookSecret } from './_lib/secretVault.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_WEBHOOK_BYTES = 262144; // 256 KB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_VIP_COUNTRIES = new Set(Object.keys(COUNTRY_CURRENCY_MAP));

/**
 * Read raw request bytes safely on standalone @vercel/node without triggering lazy req.body parsing.
 */
export async function readRawBody(req, maxBytes = MAX_WEBHOOK_BYTES) {
  // Stream FIRST: touching req.body before draining the stream triggers Vercel's lazy JSON parser
  if (typeof req?.[Symbol.asyncIterator] === 'function' && !req.readableEnded) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        throw Object.assign(new Error('Webhook payload exceeds maximum allowed size'), { statusCode: 413 });
      }
      chunks.push(buf);
    }
    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  }

  if (Buffer.isBuffer(req?.rawBody)) {
    if (req.rawBody.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return req.rawBody;
  }
  if (typeof req?.rawBody === 'string') {
    const buf = Buffer.from(req.rawBody, 'utf8');
    if (buf.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return buf;
  }
  if (Buffer.isBuffer(req?.body)) {
    if (req.body.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return req.body;
  }
  if (typeof req?.body === 'string') {
    const buf = Buffer.from(req.body, 'utf8');
    if (buf.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return buf;
  }
  return Buffer.alloc(0);
}

let lastWebhookRefreshAt = 0;

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://bezbnymjcnmazdonfzky.supabase.co';

  if (!serviceRoleKey || !supabaseUrl) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY must be configured on the server.',
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let stripeCfg = {};
  try {
    const { data: stripeRow } = await supabase
      .from('swedpersiska_settings')
      .select('value')
      .eq('key', 'stripe_settings')
      .maybeSingle();
    if (stripeRow?.value && typeof stripeRow.value === 'object') {
      stripeCfg = stripeRow.value;
    }
  } catch {}
  const expectedMode = stripeCfg.mode === 'live' ? 'live' : 'test';

  let webhookSecretRes;
  try {
    webhookSecretRes = await resolveStripeWebhookSecret(supabase, expectedMode);
  } catch (err) {
    console.error('[stripe-webhook] vault decryption error:', err?.message);
    return res.status(503).json({ ok: false, error: 'Failed to decrypt Stripe webhook secret from vault.' });
  }

  let webhookSecret = String(webhookSecretRes?.value || '').trim();
  if (!webhookSecret) {
    return res.status(503).json({
      ok: false,
      error: 'Stripe Webhook Secret is not configured in Admin Secret Vault or server env.',
    });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req, MAX_WEBHOOK_BYTES);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ ok: false, error: err.message || 'Invalid body' });
  }

  const sigHeader = req.headers?.['stripe-signature'] || req.headers?.['Stripe-Signature'] || '';
  let sigCheck = verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);

  // Self-healing zero-drop rotation: if cached vault secret fails HMAC, force 1 fresh DB read (debounced 10s)
  if (!sigCheck.ok && webhookSecretRes?.source === 'vault' && Date.now() - lastWebhookRefreshAt > 10_000) {
    lastWebhookRefreshAt = Date.now();
    try {
      const freshRes = await resolveStripeWebhookSecret(supabase, expectedMode, { fresh: true });
      if (freshRes?.value && freshRes.value !== webhookSecret) {
        webhookSecret = freshRes.value;
        sigCheck = verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);
      }
    } catch {}
  }

  if (!sigCheck.ok) {
    return res.status(400).json({ ok: false, error: sigCheck.error });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ ok: false, error: 'Malformed webhook JSON payload' });
  }

  const eventType = String(event?.type || '').trim();
  const obj = event?.data?.object || {};

  try {
    // Reject mode mismatch events across ALL Stripe event types
    if (typeof event?.livemode === 'boolean' && event.livemode !== (expectedMode === 'live')) {
      console.warn('[stripe-webhook] mode mismatch ignored:', { eventType, eventLivemode: event.livemode, expectedMode });
      return res.status(200).json({ ok: true, received: true, eventType, handled: false, reason: 'mode_mismatch' });
    }

    let handled = false;

    if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
      const metaType = String(obj.metadata?.type || '').trim();
      if (metaType === 'ad_vip_promotion') {
        const sessionId = String(obj.id || '').trim();
        const metaAdId = String(obj.metadata?.adId || '').trim();
        const metaCountry = String(obj.metadata?.targetCountry || '').trim().toLowerCase();

        // Prefer authoritative server-created pending payment record (immune to mid-checkout price changes)
        let pendingPayment = null;
        if (sessionId) {
          const { data: pendRow } = await supabase
            .from('ad_payments')
            .select('ad_id, target_country, amount, currency')
            .eq('provider_session_id', sessionId)
            .maybeSingle();
          if (pendRow) pendingPayment = pendRow;
        }

        const adId = String(pendingPayment?.ad_id || metaAdId).trim();
        const targetCountry = String(pendingPayment?.target_country || metaCountry).trim().toLowerCase();

        if (!UUID_RE.test(adId) || !ALLOWED_VIP_COUNTRIES.has(targetCountry)) {
          console.error('[stripe-webhook] invalid adId or targetCountry:', { sessionId, adId, targetCountry });
          return res.status(200).json({ ok: true, received: true, eventType, handled: false });
        }

        const fallbackPricing = computeVipPrice({ stripeCfg, targetCountry });
        const expectedCurrency = String(pendingPayment?.currency || fallbackPricing.currency).toUpperCase();
        const expectedMinAmountMinor = pendingPayment && Number.isFinite(Number(pendingPayment.amount))
          ? Math.max(100, Math.round(Number(pendingPayment.amount) * 100))
          : fallbackPricing.amountMinor;

        const check = verifyVerifiedCheckoutSession(obj, {
          expectedType: 'ad_vip_promotion',
          expectedMode,
          expectedMinAmountMinor,
          expectedCurrency,
        });

        if (!check.ok) {
          console.error('[stripe-webhook] checkout session rejected:', { sessionId, error: check.error });
          return res.status(200).json({ ok: true, received: true, eventType, handled: false });
        }

        // Re-check ad is still active & non-deleted (prevents TOCTOU moderation bypass)
        const { data: liveAd } = await supabase
          .from('swedpersiska_ads')
          .select('id, status, deleted_at')
          .eq('id', adId)
          .maybeSingle();

        if (!liveAd || liveAd.status !== 'active' || liveAd.deleted_at) {
          console.warn('[stripe-webhook] skipping VIP activation for non-active/deleted ad:', { adId, status: liveAd?.status });
          return res.status(200).json({ ok: true, received: true, eventType, handled: false, reason: 'ad_not_active' });
        }

        const amountPaid = Number.isFinite(Number(obj.amount_total)) ? Number(obj.amount_total) / 100 : 0;
        const paidCurrency = obj.currency ? String(obj.currency).toUpperCase() : expectedCurrency;
        const { data: actData, error: actErr } = await supabase.rpc('activate_ad_promotion_from_payment', {
          p_ad_id: adId,
          p_target_country: targetCountry,
          p_provider: 'stripe_webhook',
          p_session_id: sessionId,
          p_amount: amountPaid,
          p_currency: paidCurrency,
        });
        if (actErr || actData?.ok === false) {
          throw actErr || new Error(actData?.error || 'activate_ad_promotion_from_payment failed');
        }

        if (obj.payment_intent && sessionId) {
          const { data: syncData, error: syncErr } = await supabase.rpc('sync_ad_payment_webhook_event', {
            p_event_type: 'attach_payment_intent',
            p_session_id: sessionId,
            p_payment_intent_id: String(obj.payment_intent),
            p_reason: null,
          });
          if (syncErr || syncData?.ok === false) {
            throw syncErr || new Error(syncData?.error || 'attach_payment_intent failed');
          }
        }
        handled = true;
      } else if (metaType === 'website_builder_setup' || metaType === 'website_builder_renew') {
        handled = true;
      }
    } else if (eventType === 'checkout.session.expired') {
      if (obj.id) {
        const { data: syncData, error: syncErr } = await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'expired',
          p_session_id: String(obj.id),
          p_payment_intent_id: null,
          p_reason: 'checkout_session_expired',
        });
        if (syncErr || syncData?.ok === false) {
          throw syncErr || new Error(syncData?.error || 'expired sync failed');
        }
        handled = true;
      }
    } else if (eventType === 'charge.dispute.created') {
      const piId = String(obj.payment_intent || '').trim();
      if (piId) {
        const { data: syncData, error: syncErr } = await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'disputed',
          p_session_id: null,
          p_payment_intent_id: piId,
          p_reason: String(obj.reason || 'dispute').slice(0, 120),
        });
        if (syncErr || syncData?.ok === false) {
          throw syncErr || new Error(syncData?.error || 'dispute sync failed');
        }
        handled = true;
      }
    } else if (eventType === 'charge.refunded') {
      const piId = String(obj.payment_intent || '').trim();
      const amount = Number(obj.amount || 0);
      const amountRefunded = Number(obj.amount_refunded || 0);
      if (piId && amount > 0 && amountRefunded >= amount) {
        const { data: syncData, error: syncErr } = await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'refunded',
          p_session_id: null,
          p_payment_intent_id: piId,
          p_reason: 'full_refund',
        });
        if (syncErr || syncData?.ok === false) {
          throw syncErr || new Error(syncData?.error || 'refund sync failed');
        }
        handled = true;
      }
    }

    return res.status(200).json({ ok: true, received: true, eventType, handled });
  } catch (err) {
    console.error('[stripe-webhook] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Webhook processing error' });
  }
}
