import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  computeVipPrice,
  resolveSafeRedirectOrigin,
  validateStripeSecretKeyForMode,
  verifyStripeWebhookSignature,
  verifyVerifiedCheckoutSession,
} from '../api/_lib/stripeSecurity.js';
import webhookHandler from '../api/stripe-webhook.js';

function createMockRes() {
  const headers = {};
  const state = {
    statusCode: 200,
    body: null,
  };
  const res = {
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(payload) {
      state.body = payload;
      return res;
    },
  };
  return { res, state, headers };
}

test('verifyStripeWebhookSignature accepts valid HMAC-SHA256 signature and rejects tampering, wrong secret, and replays', () => {
  const secret = 'whsec_test_secret_1234567890abcdef';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const nowSec = 1795044000;
  const sigHex = crypto
    .createHmac('sha256', secret)
    .update(`${nowSec}.${payload}`, 'utf8')
    .digest('hex');
  const header = `t=${nowSec},v1=${sigHex}`;

  assert.equal(
    verifyStripeWebhookSignature(payload, header, secret, { nowSeconds: nowSec + 10 }).ok,
    true
  );

  // Tampered payload
  assert.equal(
    verifyStripeWebhookSignature(payload.replace('evt_1', 'evt_2'), header, secret, { nowSeconds: nowSec + 10 }).ok,
    false
  );

  // Wrong webhook secret
  assert.equal(
    verifyStripeWebhookSignature(payload, header, 'whsec_wrong_secret', { nowSeconds: nowSec + 10 }).ok,
    false
  );

  // Missing signature header
  assert.equal(
    verifyStripeWebhookSignature(payload, '', secret, { nowSeconds: nowSec + 10 }).ok,
    false
  );

  // Expired replay outside 300s tolerance window
  assert.equal(
    verifyStripeWebhookSignature(payload, header, secret, { nowSeconds: nowSec + 450, toleranceSeconds: 300 }).ok,
    false
  );
});

test('resolveSafeRedirectOrigin blocks open redirects, subdomain spoofing, and dangerous schemes', () => {
  const allowlist = ['https://www.linksho.eu', 'https://linksho.eu'];

  assert.equal(
    resolveSafeRedirectOrigin({ headers: { origin: 'https://linksho.eu/' } }, allowlist),
    'https://linksho.eu'
  );
  assert.equal(
    resolveSafeRedirectOrigin({ headers: { origin: 'https://www.linksho.eu' } }, allowlist),
    'https://www.linksho.eu'
  );

  // Spoofed/evil origins must fall back to canonical trusted origin
  for (const evil of [
    'https://evil.com',
    'https://www.linksho.eu.evil.com',
    'https://evil-linksho.eu',
    'javascript:alert(1)',
    'http://linksho.eu',
    '',
  ]) {
    assert.equal(
      resolveSafeRedirectOrigin({ headers: { origin: evil } }, allowlist, 'https://www.linksho.eu'),
      'https://www.linksho.eu',
      `Expected evil origin ${evil} to fall back safely`
    );
  }
});

test('validateStripeSecretKeyForMode enforces secret key prefix matches gateway mode', () => {
  assert.equal(validateStripeSecretKeyForMode('sk_live_abc123', 'live').ok, true);
  assert.equal(validateStripeSecretKeyForMode('sk_test_abc123', 'test').ok, true);

  assert.equal(validateStripeSecretKeyForMode('sk_test_abc123', 'live').ok, false);
  assert.equal(validateStripeSecretKeyForMode('sk_live_abc123', 'test').ok, false);
  assert.equal(validateStripeSecretKeyForMode('', 'live').ok, false);
  assert.equal(validateStripeSecretKeyForMode('random_invalid', 'live').ok, false);
});

test('verifyVerifiedCheckoutSession rejects unpaid, wrong livemode, underpaid, wrong currency, and wrong type', () => {
  const baseSession = {
    id: 'cs_live_123',
    status: 'complete',
    payment_status: 'paid',
    livemode: true,
    amount_total: 9900,
    currency: 'sek',
    metadata: { type: 'ad_vip_promotion' },
  };

  assert.equal(
    verifyVerifiedCheckoutSession(baseSession, {
      expectedType: 'ad_vip_promotion',
      expectedMode: 'live',
      expectedMinAmountMinor: 9900,
      expectedCurrency: 'SEK',
    }).ok,
    true
  );

  assert.equal(
    verifyVerifiedCheckoutSession(
      { ...baseSession, payment_status: 'unpaid' },
      { expectedType: 'ad_vip_promotion', expectedMode: 'live', expectedMinAmountMinor: 9900, expectedCurrency: 'SEK' }
    ).ok,
    false
  );

  assert.equal(
    verifyVerifiedCheckoutSession(
      { ...baseSession, livemode: false },
      { expectedType: 'ad_vip_promotion', expectedMode: 'live', expectedMinAmountMinor: 9900, expectedCurrency: 'SEK' }
    ).ok,
    false
  );

  assert.equal(
    verifyVerifiedCheckoutSession(
      { ...baseSession, amount_total: 5000 },
      { expectedType: 'ad_vip_promotion', expectedMode: 'live', expectedMinAmountMinor: 9900, expectedCurrency: 'SEK' }
    ).ok,
    false
  );

  assert.equal(
    verifyVerifiedCheckoutSession(
      { ...baseSession, currency: 'nok' },
      { expectedType: 'ad_vip_promotion', expectedMode: 'live', expectedMinAmountMinor: 9900, expectedCurrency: 'SEK' }
    ).ok,
    false
  );

  assert.equal(
    verifyVerifiedCheckoutSession(
      { ...baseSession, metadata: { type: 'other_type' } },
      { expectedType: 'ad_vip_promotion', expectedMode: 'live', expectedMinAmountMinor: 9900, expectedCurrency: 'SEK' }
    ).ok,
    false
  );
});

test('computeVipPrice calculates deterministic minor/major pricing across Nordic & Euro currencies', () => {
  const sePrice = computeVipPrice({ stripeCfg: { vipPrice: 99, currency: 'SEK', vipDurationDays: 30 }, targetCountry: 'se' });
  assert.deepEqual(sePrice, {
    targetCountry: 'se',
    durationDays: 30,
    currency: 'SEK',
    amountMajor: 99,
    amountMinor: 9900,
  });

  const dePrice = computeVipPrice({ stripeCfg: { vipPrice: 99, currency: 'SEK', vipDurationDays: 14 }, targetCountry: 'de' });
  assert.deepEqual(dePrice, {
    targetCountry: 'de',
    durationDays: 14,
    currency: 'EUR',
    amountMajor: 10,
    amountMinor: 1000,
  });
});

test('stripe-webhook handler rejects non-POST (405), missing env (503), and invalid Stripe signature (400)', async () => {
  {
    const { res, state } = createMockRes();
    await webhookHandler({ method: 'GET', headers: {} }, res);
    assert.equal(state.statusCode, 405);
  }

  const prevWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevSupabaseUrl = process.env.SUPABASE_URL;

  try {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    {
      const { res, state } = createMockRes();
      await webhookHandler({ method: 'POST', headers: {}, body: '{}' }, res);
      assert.equal(state.statusCode, 503);
    }

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit_test_service_role';
    process.env.SUPABASE_URL = 'https://bezbnymjcnmazdonfzky.supabase.co';

    {
      const { res, state } = createMockRes();
      await webhookHandler(
        {
          method: 'POST',
          headers: { 'stripe-signature': 't=1700000000,v1=deadbeef' },
          body: JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed' }),
        },
        res
      );
      assert.equal(state.statusCode, 400);
    }
  } finally {
    if (prevWebhookSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = prevWebhookSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
    if (prevServiceRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prevSupabaseUrl !== undefined) process.env.SUPABASE_URL = prevSupabaseUrl;
    else delete process.env.SUPABASE_URL;
  }
});
