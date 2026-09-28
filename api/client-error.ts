type ClientErrorReport = {
  message?: string;
  stack?: string;
  digest?: string;
  path?: string;
  userAgent?: string;
  release?: string;
};

const clip = (value: unknown, length: number) => typeof value === 'string' ? value.slice(0, length) : '';

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  try {
    const body = await request.json() as ClientErrorReport;
    console.error('Client runtime error', JSON.stringify({
      message: clip(body.message, 500),
      stack: clip(body.stack, 4_000),
      digest: clip(body.digest, 200),
      path: clip(body.path, 500),
      userAgent: clip(body.userAgent, 500),
      release: clip(body.release, 200),
    }));
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export function GET() {
  return Response.json({ ok: false }, { status: 405, headers: { Allow: 'POST' } });
}
