// Emails a driver the result of their PSO verification (approved or rejected,
// with the reason for each rejected document). Fired by
// trg_email_verification_result (AFTER INSERT on notifications, type
// 'verification_status') through pg_net, so it authenticates the same way
// notify-new-message does: the shared Vault secret, no end user session.
//
// Nothing about the recipient or the text comes from the request. The
// notification row and the driver's account email are read here with the
// service role, and the message is the one already shown in the app.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildVerificationEmail } from './email.ts';

const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS = Deno.env.get('VERIFICATION_FROM') ?? 'TriSakay <noreply@trisakaygsc.org>';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  try {
    if (!SHARED_SECRET) {
      console.error('notify-verification-result: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) return json({ error: 'Unauthorized' }, 401);

    if (!RESEND_API_KEY) {
      console.error('notify-verification-result: RESEND_API_KEY is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : undefined;
    if (!notificationId) return json({ error: 'notificationId required' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message')
      .eq('id', notificationId)
      .maybeSingle();
    if (notificationError) return json({ error: notificationError.message }, 500);
    if (!notification) return json({ sent: false, skipped: 'notification not found' });
    if (notification.type !== 'verification_status') return json({ sent: false, skipped: 'not a verification result' });

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, first_name, role')
      .eq('id', notification.user_id)
      .maybeSingle();
    if (userError) return json({ error: userError.message }, 500);
    if (!user || user.role !== 'driver' || !user.email) return json({ sent: false, skipped: 'no driver email' });

    const { subject, html, text } = buildVerificationEmail({
      firstName: user.first_name ?? '',
      title: notification.title,
      message: notification.message,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `verification-${notification.id}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [user.email], subject, html, text }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error('notify-verification-result: Resend rejected the email', response.status, detail);
      return json({ error: 'The email could not be sent' }, 502);
    }

    return json({ sent: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
