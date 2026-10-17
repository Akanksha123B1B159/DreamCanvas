import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const processStartedAt = Date.now() - Math.floor(process.uptime() * 1000);

export async function GET() {
  const startedAt = Date.now();
  const response = NextResponse.json({
    service: 'DreamCanvas Frontend/API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(processStartedAt).toISOString(),
    responseTimeMs: Date.now() - startedAt,
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
