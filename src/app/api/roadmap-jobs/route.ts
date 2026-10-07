import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getRedis, QueueMessage, recordEvent } from '@/app/_libs/distributed';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.skills || !body?.role) return NextResponse.json({ error: 'skills and role are required' }, { status: 400 });

  const jobId = randomUUID();
  const message: QueueMessage = {
    messageId: randomUUID(),
    type: 'GENERATE_ROADMAP',
    userId: body.userId || 'authenticated-user',
    timestamp: new Date().toISOString(),
    payload: { jobId, skills: String(body.skills), role: String(body.role) },
  };

  try {
    const client = getRedis();
    await client.connect().catch(() => undefined);
    await client.lpush('dreamcanvas:roadmap:jobs', JSON.stringify(message));
    await client.set(`dreamcanvas:job:${jobId}`, JSON.stringify({ jobId, status: 'QUEUED', messageId: message.messageId }));
    recordEvent({ service: 'frontend', type: 'QUEUE_MESSAGE_CREATED', jobId, payload: { messageId: message.messageId, type: message.type } });
    return NextResponse.json({ jobId, status: 'QUEUED', messageId: message.messageId }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: 'Redis queue is unavailable', detail: error instanceof Error ? error.message : 'unknown' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  try {
    const client = getRedis();
    await client.connect().catch(() => undefined);
    const value = await client.get(`dreamcanvas:job:${jobId}`);
    return NextResponse.json(value ? JSON.parse(value) : { jobId, status: 'UNKNOWN' });
  } catch {
    return NextResponse.json({ error: 'Redis queue is unavailable' }, { status: 503 });
  }
}
