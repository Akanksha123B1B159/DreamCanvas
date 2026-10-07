import { NextRequest, NextResponse } from 'next/server';
import { recordEvent, services, withRetry } from '@/app/_libs/distributed';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const response = await withRetry(() => fetch(`${services['job-detection']}/health`), 2, 3000);
    return NextResponse.json({ service: 'job-detection', status: response.ok ? 'ONLINE' : 'OFFLINE' }, { status: response.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ service: 'job-detection', status: 'OFFLINE' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.description !== 'string' || body.description.trim().length < 20) {
    return NextResponse.json({ error: 'A job description of at least 20 characters is required' }, { status: 400 });
  }

  recordEvent({ service: 'frontend', type: 'RPC_REQUEST', payload: { operation: 'predict' } });
  try {
    const response = await withRetry(
      () => fetch(`${services['job-detection']}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: body.description, description: body.description }),
      }),
      2,
      8000,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.detail || 'Job detection service failed' }, { status: 502 });
    recordEvent({ service: 'job-detection', type: 'RPC_RESPONSE', payload: { prediction: data.prediction } });
    return NextResponse.json(data);
  } catch (error) {
    recordEvent({ service: 'frontend', type: 'RPC_FAILURE', payload: { error: error instanceof Error ? error.message : 'unknown' } });
    return NextResponse.json({ error: 'Job detection service is unavailable. No prediction was created.' }, { status: 503 });
  }
}
