import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { deleteR2ObjectsForAd, resolveR2Config } from './_lib/r2Storage.js';
import { dispatchPendingNotifications } from './_lib/notifications.js';
import { getAdminJwtSigningContext, getVaultSecret, safeTimingEqual } from './_lib/secretVault.js';

async function isAuthorizedCron(req, supabase) {
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) return false;

  // 1. Check Vercel env CRON_SECRET first (native Vercel Cron)
  const envCronSecret = String(process.env.CRON_SECRET || '').trim();
  if (envCronSecret && safeTimingEqual(bearer, envCronSecret)) {
    return true;
  }

  // 2. Check Encrypted DB Vault cron_secret (external scheduler / pg_cron + pg_net)
  try {
    const vaultCron = await getVaultSecret(supabase, 'cron_secret', { allowEnvFallback: false });
    if (vaultCron?.value && safeTimingEqual(bearer, vaultCron.value)) {
      return true;
    }
  } catch {}

  // 3. Check signed Admin Bearer JWT (derived via shared HKDF + DB pepper)
  const parts = bearer.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const [payload, sig] = parts;
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded?.role !== 'admin' || !decoded.exp || decoded.exp <= Date.now()) {
        return false;
      }

      const verifyWithCtx = (ctx) => {
        if (!ctx?.signingKey) return false;
        const expected = crypto.createHmac('sha256', ctx.signingKey).update(payload).digest('base64url');
        if (!safeTimingEqual(sig, expected)) return false;
        if (ctx.hasDbPepper && Number(decoded.pv ?? -1) !== Number(ctx.pepperVersion)) return false;
        return true;
      };

      let ctx = await getAdminJwtSigningContext(supabase);
      if (verifyWithCtx(ctx)) return true;

      if (decoded.pv !== undefined && Number(decoded.pv) !== Number(ctx.pepperVersion)) {
        ctx = await getAdminJwtSigningContext(supabase, { fresh: true });
        if (verifyWithCtx(ctx)) return true;
      }
    } catch {}
  }

  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://bezbnymjcnmazdonfzky.supabase.co';
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server for scheduled cleanup.',
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!(await isAuthorizedCron(req, supabase))) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron or admin invocation' });
  }

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const dryRun = Boolean(body.dryRun || req.query?.dryRun === '1' || req.query?.dryRun === 'true');
    const triggerSource = String(body.triggerSource || (req.headers['x-vercel-cron'] ? 'vercel_cron_monthly' : 'manual_cron_endpoint')).slice(0, 60);

    const { data: runResult, error: runErr } = await supabase.rpc('run_scheduled_ad_cleanup', {
      p_trigger_source: triggerSource,
      p_dry_run: dryRun,
    });
    if (runErr) throw runErr;

    let notifications = { processed: 0, sent: 0, inAppOnly: 0, failed: 0 };
    let storageDeleted = 0;
    let permanentlyDeleted = 0;
    let storageErrors = 0;

    if (!dryRun && runResult?.ok && !runResult.skipped_concurrent_run && !runResult.skipped_disabled) {
      notifications = await dispatchPendingNotifications(supabase, 100);

      const candidates = Array.isArray(runResult.purge_candidates) ? runResult.purge_candidates : [];
      const cachedR2 = candidates.length > 0 ? await resolveR2Config(supabase) : null;
      for (const candidate of candidates) {
        const r2Res = await deleteR2ObjectsForAd(supabase, candidate.images, candidate.id, cachedR2);
        storageDeleted += r2Res.deletedKeys.length;

        if (r2Res.failedKeys.length > 0) {
          storageErrors += r2Res.failedKeys.length;
          await supabase.from('ad_cleanup_logs').insert({
            run_id: runResult.run_id || null,
            ad_id: candidate.id,
            ad_reference_number: candidate.reference_number,
            ad_title: candidate.title,
            action: 'storage_cleanup_failed',
            reason: 'خطا در حذف فایل‌های R2؛ حذف نهایی به اجرای بعدی موکول شد.',
            metadata: { failedKeys: r2Res.failedKeys },
          });
          continue;
        }

        const { error: delErr } = await supabase
          .from('swedpersiska_ads')
          .delete()
          .eq('id', candidate.id)
          .not('deleted_at', 'is', null);

        if (!delErr) {
          permanentlyDeleted += 1;
          await supabase.rpc('log_permanent_ad_deletion', {
            p_run_id: runResult.run_id || null,
            p_ad_id: candidate.id,
            p_reference_number: candidate.reference_number || null,
            p_title: candidate.title || null,
            p_deleted_keys: r2Res.deletedKeys,
          });
        } else {
          storageErrors += 1;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      ...runResult,
      permanently_deleted_count: permanentlyDeleted,
      storage_objects_deleted: storageDeleted,
      storage_errors: storageErrors,
      notifications,
    });
  } catch (err) {
    console.error('[cron-cleanup] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Cleanup execution failed' });
  }
}
