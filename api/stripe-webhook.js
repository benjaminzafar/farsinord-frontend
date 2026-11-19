import { createClient } from '@supabase/supabase-js';
import {
  computeVipPrice,
  verifyStripeWebhookSignature,
  verifyVerifiedCheckoutSession,
} from './_lib/stripeSecurity.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_WEBHOOK_BYTES = 262144; // 256 KB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readRawBody(req, maxBytes = MAX_WEBHOOK_BYTES) {
  if (Buffer.isBuffer(req?.body)) {
    if (req.body.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return req.body;
  }
  if (typeof req?.body === 'string') {
    const buf = Buffer.from(req.body, 'utf8');
    if (buf.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return buf;
  }
  if (typeof req?.rawBody === 'string' || Buffer.isBuffer(req?.rawBody)) {
    const buf = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody, 'utf8');
    if (buf.length > maxBytes) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    return buf;
  }

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
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  if (!webhookSecret || !serviceRoleKey || !supabaseUrl) {
    return res.status(503).json({
      ok: false,
      error: 'STRIPE_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY must be configured on the server.',
    });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req, MAX_WEBHOOK_BYTES);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ ok: false, error: err.message || 'Invalid body' });
  }

  const sigHeader = req.headers?.['stripe-signature'] || req.headers?.['Stripe-Signature'] || '';
  const sigCheck = verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);
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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: stripeRow } = await supabase
      .from('swedpersiska_settings')
      .select('value')
      .eq('key', 'stripe_settings')
      .maybeSingle();
    const stripeCfg = stripeRow?.value || {};
    const expectedMode = stripeCfg.mode === 'live' ? 'live' : 'test';
    let handled = false;

    if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
      const metaType = String(obj.metadata?.type || '').trim();
      if (metaType === 'ad_vip_promotion') {
        const adId = String(obj.metadata?.adId || '').trim();
        const targetCountry = String(obj.metadata?.targetCountry || 'se').trim().toLowerCase();
        const pricing = computeVipPrice({ stripeCfg, targetCountry });

        const check = verifyVerifiedCheckoutSession(obj, {
          expectedType: 'ad_vip_promotion',
          expectedMode,
          expectedMinAmountMinor: pricing.amountMinor,
          expectedCurrency: pricing.currency,
        });

        if (check.ok && UUID_RE.test(adId)) {
          const amountPaid = obj.amount_total ? Number(obj.amount_total) / 100 : pricing.amountMajor;
          const paidCurrency = obj.currency ? String(obj.currency).toUpperCase() : pricing.currency;
          const { error: actErr } = await supabase.rpc('activate_ad_promotion_from_payment', {
            p_ad_id: adId,
            p_target_country: targetCountry,
            p_provider: 'stripe_webhook',
            p_session_id: String(obj.id || ''),
            p_amount: amountPaid,
            p_currency: paidCurrency,
          });
          if (actErr) throw actErr;

          if (obj.payment_intent && obj.id) {
            await supabase.rpc('sync_ad_payment_webhook_event', {
              p_event_type: 'attach_payment_intent',
              p_session_id: String(obj.id),
              p_payment_intent_id: String(obj.payment_intent),
              p_reason: null,
            });
          }
          handled = true;
        }
      } else if (metaType === 'website_builder_setup' || metaType === 'website_builder_renew') {
        // Website setup/renew is synced cleanly with website order lookup via verify endpoints; acknowledge safely
        handled = true;
      }
    } else if (eventType === 'checkout.session.expired') {
      if (obj.id) {
        await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'expired',
          p_session_id: String(obj.id),
          p_payment_intent_id: null,
          p_reason: 'checkout_session_expired',
        });
        handled = true;
      }
    } else if (eventType === 'charge.dispute.created') {
      const piId = String(obj.payment_intent || '').trim();
      if (piId) {
        await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'disputed',
          p_session_id: null,
          p_payment_intent_id: piId,
          p_reason: String(obj.reason || 'dispute').slice(0, 120),
        });
        handled = true;
      }
    } else if (eventType === 'charge.refunded') {
      const piId = String(obj.payment_intent || '').trim();
      const amount = Number(obj.amount || 0);
      const amountRefunded = Number(obj.amount_refunded || 0);
      if (piId && amount > 0 && amountRefunded >= amount) {
        await supabase.rpc('sync_ad_payment_webhook_event', {
          p_event_type: 'refunded',
          p_session_id: null,
          p_payment_intent_id: piId,
          p_reason: 'full_refund',
        });
        handled = true;
      }
    }

    return res.status(200).json({ ok: true, received: true, eventType, handled });
  } catch (err) {
    console.error('[stripe-webhook] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Webhook processing error' });
  }
}
