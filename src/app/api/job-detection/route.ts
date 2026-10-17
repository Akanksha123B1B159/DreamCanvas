import { NextRequest, NextResponse } from 'next/server';
import { recordEvent, services, withRetry } from '@/app/_libs/distributed';

export const runtime = 'nodejs';

function heuristicJobDetection(description: string) {
  const text = description.toLowerCase();
  const suspiciousPatterns = [
    /no experience/i,
    /urgent hire/i,
    /immediate start/i,
    /guaranteed.*(income|pay|salary)/i,
    /work from home.*(earn|pay|salary|money)/i,
    /send.*(money|payment|fees|deposit|cash)/i,
    /pay.*(upfront|fee|training|deposit|processing)/i,
    /telegram|whatsapp|dm me|direct message/i,
    /quick cash|easy money|unlimited earning|massive profits/i,
    /no interview|no resume|required.*(bank|card|details)/i,
    /earn.*\$\d+.*(per day|per hour|weekly)/i,
    /hiring.*(now|immediately)/i,
  ];

  const trustSignals = [
    /company name/i,
    /salary range/i,
    /location/i,
    /responsibilities/i,
    /qualifications|requirements/i,
    /job description/i,
    /benefits/i,
    /experience required/i,
    /full-time|part-time|contract/i,
  ];

  let score = 0;
  suspiciousPatterns.forEach((pattern) => {
    if (pattern.test(text)) score += 1.6;
  });
  trustSignals.forEach((pattern) => {
    if (pattern.test(text)) score -= 0.7;
  });

  if (text.length < 80) score += 0.8;
  if (text.includes('apply now') || text.includes('limited spots')) score += 0.9;

  const prediction = score >= 2.2 ? 1 : 0;
  const confidence = Math.min(0.97, Math.max(0.62, 0.68 + score * 0.12));

  return {
    prediction,
    confidence: Number(confidence.toFixed(2)),
  };
}

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

  const description = body.description.trim();
  recordEvent({ service: 'frontend', type: 'RPC_REQUEST', payload: { operation: 'predict' } });

  try {
    const response = await withRetry(
      () => fetch(`${services['job-detection']}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: description, description }),
      }),
      2,
      8000,
    );

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data.prediction !== 'number' || typeof data.confidence !== 'number') {
      const fallback = heuristicJobDetection(description);
      recordEvent({ service: 'frontend', type: 'RPC_FAILURE', payload: { error: 'Falling back to local heuristic detection', prediction: fallback.prediction } });
      return NextResponse.json(fallback, { status: 200 });
    }

    recordEvent({ service: 'job-detection', type: 'RPC_RESPONSE', payload: { prediction: data.prediction } });
    return NextResponse.json({ prediction: Number(data.prediction), confidence: Number(data.confidence) });
  } catch (error) {
    const fallback = heuristicJobDetection(description);
    recordEvent({ service: 'frontend', type: 'RPC_FAILURE', payload: { error: error instanceof Error ? error.message : 'unknown', prediction: fallback.prediction } });
    return NextResponse.json(fallback, { status: 200 });
  }
}
