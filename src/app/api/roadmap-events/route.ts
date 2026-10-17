import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEvents, recordPropagatedWorkflowEvent, recordWorkflowEvent } from '@/app/_libs/distributed';

export const runtime = 'nodejs';

const allowedEventNames = new Set(['LEARNING_PLAN_SAVED', 'LEARNING_PLAN_FAILED']);

export async function POST(request: NextRequest) {
  const bearerToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!bearerToken || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Sign in before recording roadmap events.' }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(bearerToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'The roadmap event session is not valid.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.eventName !== 'string' || !allowedEventNames.has(body.eventName)) {
    return NextResponse.json({ error: 'A valid learning-plan save or failure event is required.' }, { status: 400 });
  }

  const correlationId = request.headers.get('x-correlation-id');
  const timestampText = request.headers.get('x-lamport-timestamp');
  const logicalTimestamp = timestampText && /^\d+$/.test(timestampText) ? Number(timestampText) : NaN;
  if (
    !correlationId
    || correlationId.length > 128
    || !Number.isSafeInteger(logicalTimestamp)
    || logicalTimestamp < 0
  ) {
    return NextResponse.json({ error: 'A valid correlation ID and Lamport timestamp are required.' }, { status: 400 });
  }

  const status = body.eventName === 'LEARNING_PLAN_SAVED' ? 'SUCCESS' : 'FAILED';
  const error = status === 'FAILED' && typeof body.error === 'string'
    ? body.error.slice(0, 300)
    : undefined;

  recordPropagatedWorkflowEvent({
    service: 'frontend',
    eventName: body.eventName,
    processName: 'dreamcanvas-browser',
    correlationId,
    logicalTimestamp,
    status,
    error,
  });
  recordWorkflowEvent({
    service: 'frontend',
    eventName: 'WORKFLOW_EVENT_RECEIVED',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'receive',
    receivedTimestamp: logicalTimestamp,
    status,
    error,
  });
  const acknowledged = recordWorkflowEvent({
    service: 'frontend',
    eventName: 'WORKFLOW_EVENT_ACKNOWLEDGED',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'send',
    status,
  });

  const response = NextResponse.json({
    accepted: true,
    correlationId,
    logicalTimestamp: acknowledged.logicalTimestamp,
    events: getEvents().filter((event) => event.correlationId === correlationId),
  });
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-lamport-timestamp', String(acknowledged.logicalTimestamp));
  return response;
}
