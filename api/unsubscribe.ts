import { databaseRequest, siteUrl, type Subscriber } from '../lib/subscription-server';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);
  }

  try {
    const matches = await databaseRequest<Subscriber[]>(
      'email_subscribers',
      `select=id,email,locale,status,confirmation_token,unsubscribe_token&unsubscribe_token=eq.${token}&limit=1`,
    );
    if (!matches[0]) return Response.redirect(`${siteUrl()}/?subscription=invalid`, 302);

    await databaseRequest<void>('email_subscribers', `id=eq.${matches[0].id}`, {
      method: 'PATCH',
      body: { status: 'unsubscribed', unsubscribed_at: new Date().toISOString() },
    });
    return Response.redirect(`${siteUrl()}/?subscription=unsubscribed`, 302);
  } catch (error) {
    console.error('Unsubscribe request failed', error);
    return Response.redirect(`${siteUrl()}/?subscription=error`, 302);
  }
}
