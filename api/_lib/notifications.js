const MAIN_SITE_URL = (process.env.VITE_MAIN_SITE_URL || 'https://www.linksho.eu').replace(/\/+$/, '');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNotificationHtml(notif) {
  const manageUrl = notif.ad_reference_number
    ? `${MAIN_SITE_URL}/?modal=manage&ref=${encodeURIComponent(notif.ad_reference_number)}`
    : `${MAIN_SITE_URL}/?modal=manage`;

  return `
  <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#F5F5F7; padding:24px; color:#1D1D1F;">
    <div style="max-width:520px; margin:0 auto; background:#FFFFFF; border:1px solid #E5E5EA; border-radius:18px; padding:24px;">
      <div style="font-size:12px; color:#0066CC; font-weight:bold; margin-bottom:8px;">لینک شو | نیازمندی‌های فارسی‌زبانان اروپا</div>
      <h2 style="margin:0 0 12px; font-size:18px; color:#1D1D1F;">${escapeHtml(notif.title)}</h2>
      <p style="margin:0 0 18px; font-size:14px; line-height:1.8; color:#515154;">${escapeHtml(notif.message)}</p>
      <a href="${escapeHtml(manageUrl)}" style="display:inline-block; background:#0066CC; color:#FFFFFF; text-decoration:none; padding:11px 22px; border-radius:999px; font-size:13px; font-weight:bold;">
        مدیریت، ویرایش یا بوست رایگان آگهی
      </a>
      <p style="margin:20px 0 0; font-size:11px; color:#86868B;">
        کد پیگیری آگهی: <strong dir="ltr">${escapeHtml(notif.ad_reference_number || '-')}</strong>
      </p>
    </div>
  </div>`;
}

/**
 * Dispatches pending ad_notifications via Resend REST API if RESEND_API_KEY is configured,
 * otherwise cleanly marks notifications as in-app-only so owners see them inside ManageAdModal.
 */
export async function dispatchPendingNotifications(supabase, limit = 50) {
  if (!supabase) return { processed: 0, sent: 0, inAppOnly: 0, failed: 0 };

  const { data: pending, error } = await supabase
    .from('ad_notifications')
    .select('id, ad_reference_number, recipient_email, notification_type, title, message')
    .eq('email_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !Array.isArray(pending) || pending.length === 0) {
    return { processed: 0, sent: 0, inAppOnly: 0, failed: 0 };
  }

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const fromEmail = String(process.env.NOTIFICATION_FROM_EMAIL || 'LinkSho <noreply@linksho.eu>').trim();

  let sent = 0;
  let inAppOnly = 0;
  let failed = 0;

  for (const notif of pending) {
    const recipient = String(notif.recipient_email || '').trim();
    const hasEmail = Boolean(resendKey && recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient));

    if (!hasEmail) {
      await supabase
        .from('ad_notifications')
        .update({ email_status: 'in_app_only' })
        .eq('id', notif.id);
      inAppOnly++;
      continue;
    }

    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject: `${notif.title} (${notif.ad_reference_number || 'لینک شو'})`,
          html: buildNotificationHtml(notif),
        }),
      });

      if (resp.ok) {
        await supabase
          .from('ad_notifications')
          .update({
            email_status: 'sent',
            delivery_channel: 'email+in_app',
            email_sent_at: new Date().toISOString(),
          })
          .eq('id', notif.id);
        sent++;
      } else {
        await supabase
          .from('ad_notifications')
          .update({ email_status: 'failed' })
          .eq('id', notif.id);
        failed++;
      }
    } catch {
      await supabase
        .from('ad_notifications')
        .update({ email_status: 'failed' })
        .eq('id', notif.id);
      failed++;
    }
  }

  return { processed: pending.length, sent, inAppOnly, failed };
}
