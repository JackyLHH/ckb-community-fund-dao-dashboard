import {
  confirmationEmail,
  databaseRequest,
  randomToken,
  sendEmail,
  siteUrl,
  type Subscriber,
  type SubscriberLocale,
} from '../lib/subscription-server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { email?: string; locale?: string; company?: string };
    if (payload.company) return Response.json({ ok: true });

    const email = payload.email?.trim().toLowerCase() ?? '';
    const locale: SubscriberLocale = payload.locale === 'en' ? 'en' : 'zh';
    if (!emailPattern.test(email) || email.length > 254) {
      return Response.json({ ok: false, code: 'invalid_email' }, { status: 400 });
    }

    const encodedEmail = encodeURIComponent(email);
    const existing = await databaseRequest<Subscriber[]>(
      'email_subscribers',
      `select=id,email,locale,status,confirmation_token,unsubscribe_token&email=eq.${encodedEmail}&limit=1`,
    );

    if (existing[0]?.status === 'confirmed') {
      return Response.json({ ok: true, code: 'already_subscribed' });
    }

    const confirmationToken = randomToken();
    const unsubscribeToken = existing[0]?.unsubscribe_token ?? randomToken();
    const record = {
      email,
      locale,
      status: 'pending',
      confirmation_token: confirmationToken,
      unsubscribe_token: unsubscribeToken,
      confirmed_at: null,
      unsubscribed_at: null,
    };

    if (existing[0]) {
      await databaseRequest<void>('email_subscribers', `id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: record,
      });
    } else {
      await databaseRequest<void>('email_subscribers', '', {
        method: 'POST',
        body: record,
      });
    }

    const confirmationUrl = `${siteUrl()}/api/confirm?token=${confirmationToken}`;
    await sendEmail({ to: email, ...confirmationEmail(locale, confirmationUrl) });
    return Response.json({ ok: true, code: 'confirmation_sent' });
  } catch (error) {
    console.error('Subscription request failed', error);
    return Response.json({ ok: false, code: 'service_unavailable' }, { status: 503 });
  }
}
