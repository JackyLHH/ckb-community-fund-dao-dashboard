// Temporary read-only operational diagnostic. No subscriber rows or message APIs.
export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const checks: Record<string, unknown> = {
    configured: Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'TELEGRAM_BOT_TOKEN'].map(name => [name, Boolean(process.env[name])])),
  };
  const failure = (error: unknown) => ({ unavailable: true, name: (error as Error)?.name, cause: (error as { cause?: { code?: string } })?.cause?.code });
  try { checks.databaseHost = new URL(base ?? '').hostname; } catch { checks.invalidDatabaseUrl = true; }
  const respond = () => Response.json(checks, { headers: { 'Cache-Control': 'no-store' } });
  if (!base || !key) return respond();
  const get = async (path: string) => {
    const r = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  };
  for (const [name, path] of [
    ['runs', 'digest_runs?select=status,started_at,completed_at,new_proposals,updated_proposals,recipients&order=started_at.desc&limit=5'],
    ['receipts', 'digest_delivery_receipts?select=status&limit=0'],
    ['topicState', 'proposal_digest_state?select=topic_id&limit=0'],
    ['preferences', 'email_subscribers?select=preferences,preferences_updated_at&limit=0'],
  ]) {
    try {
      const result = await get(path);
      checks[name] = { status: result.status, ...(result.status >= 400 ? { code: result.body?.code, message: typeof result.body?.message === 'string' ? result.body.message.slice(0,200) : undefined } : {}), ...(name === 'runs' && result.status === 200 ? { recent: result.body } : {}) };
    } catch (error) { checks[name] = failure(error); }
  }
  try {
    const result = await get('');
    checks.leaseFunctionPresent = Boolean(result.body?.paths?.['/rpc/claim_digest_delivery']);
  } catch (error) { checks.leaseFunctionPresent = failure(error); }
  return respond();
}
