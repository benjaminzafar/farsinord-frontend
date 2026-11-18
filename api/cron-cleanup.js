import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { deleteR2ObjectsForAd } from './_lib/r2Storage.js';
import { dispatchPendingNotifications } from './_lib/notifications.js';

const TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorizedCron(req) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (cronSecret && bearer && safeEqual(bearer, cronSecret)) {
    return true;
  }
  if (!cronSecret && req.headers['x-vercel-cron']) {
    return true;
  }
  if (TOKEN_SECRET && bearer && bearer.includes('.')) {
    const [payload, sig] = bearer.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (safeEqual(sig, expected)) {
      try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (decoded?.role === 'admin' && decoded.exp > Date.now()) return true;
      } catch {}
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron or admin invocation' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server for scheduled cleanup.',
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

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
      for (const candidate of candidates) {
        const r2Res = await deleteR2ObjectsForAd(supabase, candidate.images, candidate.id);
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
    return res.status(500).json({ ok: false, error: err.message || 'Cleanup execution failed' });
  }
}
