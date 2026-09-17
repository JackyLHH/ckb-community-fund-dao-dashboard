import { databaseRequest, siteUrl, type Subscriber } from '../lib/subscription-server';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);
  }

  try {
    const matches = await databaseRequest<Subscriber[]>(
      'email_subscribers',
      `select=id,email,locale,status,confirmation_token,unsubscribe_token&confirmation_token=eq.${token}&limit=1`,
    );
    if (!matches[0]) return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);

    await databaseRequest<void>('email_subscribers', `id=eq.${matches[0].id}`, {
      method: 'PATCH',
      body: {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
    });
    return Response.redirect(`${siteUrl()}/?subscription=confirmed`, 302);
  } catch (error) {
    console.error('Subscription confirmation failed', error);
    return Response.redirect(`${siteUrl()}/?subscription=error`, 302);
  }
}
