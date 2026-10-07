import { NextResponse } from 'next/server';
import { services, withRetry } from '@/app/_libs/distributed';

export async function GET() {
  const result: Record<string, string> = { frontend: 'ONLINE', database: 'UNCONFIGURED', groq: process.env.GROQ_API_KEY ? 'AVAILABLE' : 'UNAVAILABLE', youtube: process.env.YOUTUBE_API_KEY ? 'AVAILABLE' : 'UNAVAILABLE' };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
        signal: AbortSignal.timeout(4000),
      });
      result.database = response.ok ? 'ONLINE' : 'OFFLINE';
    } catch {
      result.database = 'OFFLINE';
    }
  }
  try { const response = await withRetry(() => fetch(`${services['job-detection']}/health`), 1, 2000); result['job-detection'] = response.ok ? 'ONLINE' : 'OFFLINE'; } catch { result['job-detection'] = 'OFFLINE'; }
  try { const redis = (await import('@/app/_libs/distributed')).getRedis(); await redis.connect().catch(() => undefined); result.redis = (await redis.ping()) === 'PONG' ? 'ONLINE' : 'OFFLINE'; } catch { result.redis = 'OFFLINE'; }
  return NextResponse.json(result);
}
