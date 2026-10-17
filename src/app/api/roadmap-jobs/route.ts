import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  getRedis,
  QueueMessage,
  recordEvent,
  recordPropagatedWorkflowEvent,
  recordWorkflowEvent,
} from '@/app/_libs/distributed';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.skills || !body?.role) return NextResponse.json({ error: 'skills and role are required' }, { status: 400 });

  const correlationId = req.headers.get('x-correlation-id') || randomUUID();
  const timestampText = req.headers.get('x-lamport-timestamp');
  const parsedTimestamp = timestampText && /^\d+$/.test(timestampText) ? Number(timestampText) : undefined;
  const incomingTimestamp = parsedTimestamp !== undefined && Number.isSafeInteger(parsedTimestamp)
    ? parsedTimestamp
    : undefined;
  if (incomingTimestamp !== undefined) {
    const sourceProcess = req.headers.get('x-lamport-process') === 'roadmap-worker'
      ? 'roadmap-worker'
      : 'dreamcanvas-browser';
    recordPropagatedWorkflowEvent({
      service: 'frontend',
      eventName: req.headers.get('x-lamport-event') === 'LEARNING_PLAN_REQUESTED'
        ? 'LEARNING_PLAN_REQUESTED'
        : 'LEARNING_PLAN_REQUEST_SENT',
      processName: sourceProcess,
      correlationId,
      logicalTimestamp: incomingTimestamp,
      status: 'SUCCESS',
    });
  }
  recordWorkflowEvent({
    service: 'frontend',
    eventName: 'REQUEST_RECEIVED',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'receive',
    receivedTimestamp: incomingTimestamp,
  });

  const jobId = randomUUID();
  const queueSent = recordWorkflowEvent({
    service: 'redis',
    eventName: 'ROADMAP_JOB_SEND',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'send',
    status: 'INFO',
    jobId,
  });
  const message: QueueMessage = {
    messageId: randomUUID(),
    type: 'GENERATE_ROADMAP',
    userId: body.userId || 'authenticated-user',
    timestamp: new Date().toISOString(),
    correlationId,
    lamportTimestamp: queueSent.logicalTimestamp,
    payload: { jobId, skills: String(body.skills), role: String(body.role) },
  };

  try {
    const client = getRedis();
    await client.connect().catch(() => undefined);
    await client.lpush('dreamcanvas:roadmap:jobs', JSON.stringify(message));
    await client.set(`dreamcanvas:job:${jobId}`, JSON.stringify({
      jobId,
      status: 'QUEUED',
      messageId: message.messageId,
      correlationId,
      logicalTimestamp: queueSent.logicalTimestamp,
    }));
    recordEvent({ service: 'frontend', type: 'QUEUE_MESSAGE_CREATED', jobId, payload: { messageId: message.messageId, type: message.type } });
    const accepted = recordWorkflowEvent({
      service: 'redis',
      eventName: 'ROADMAP_JOB_ENQUEUED',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'receive',
      receivedTimestamp: queueSent.logicalTimestamp,
      status: 'SUCCESS',
      jobId,
    });
    const response = NextResponse.json({
      jobId,
      status: 'QUEUED',
      messageId: message.messageId,
      correlationId,
      logicalTimestamp: accepted.logicalTimestamp,
    }, { status: 202 });
    response.headers.set('x-correlation-id', correlationId);
    response.headers.set('x-lamport-timestamp', String(accepted.logicalTimestamp));
    return response;
  } catch (error) {
    const failure = recordWorkflowEvent({
      service: 'redis',
      eventName: 'LEARNING_PLAN_FAILED',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'local',
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Redis queue is unavailable.',
      jobId,
    });
    const responseEvent = recordWorkflowEvent({
      service: 'frontend',
      eventName: 'LEARNING_PLAN_RESPONSE_SENT',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'send',
      status: 'FAILED',
      error: failure.error,
      jobId,
    });
    const response = NextResponse.json({
      error: 'Redis queue is unavailable',
      detail: error instanceof Error ? error.message : 'unknown',
      correlationId,
      logicalTimestamp: responseEvent.logicalTimestamp,
    }, { status: 503 });
    response.headers.set('x-correlation-id', correlationId);
    response.headers.set('x-lamport-timestamp', String(responseEvent.logicalTimestamp));
    return response;
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  try {
    const client = getRedis();
    await client.connect().catch(() => undefined);
    const value = await client.get(`dreamcanvas:job:${jobId}`);
    const result = value ? JSON.parse(value) : { jobId, status: 'UNKNOWN' };
    if (typeof result.correlationId !== 'string' || !Number.isSafeInteger(result.logicalTimestamp)) {
      return NextResponse.json(result);
    }
    recordWorkflowEvent({
      service: 'redis',
      eventName: 'ROADMAP_JOB_STATUS_RECEIVED',
      processName: 'dreamcanvas-api',
      correlationId: result.correlationId,
      eventType: 'receive',
      receivedTimestamp: result.logicalTimestamp,
      status: result.status === 'FAILED' ? 'FAILED' : result.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
      jobId,
    });
    const sent = recordWorkflowEvent({
      service: 'frontend',
      eventName: 'ROADMAP_JOB_STATUS_SENT',
      processName: 'dreamcanvas-api',
      correlationId: result.correlationId,
      eventType: 'send',
      status: result.status === 'FAILED' ? 'FAILED' : result.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
      jobId,
    });
    const response = NextResponse.json({ ...result, logicalTimestamp: sent.logicalTimestamp });
    response.headers.set('x-correlation-id', result.correlationId);
    response.headers.set('x-lamport-timestamp', String(sent.logicalTimestamp));
    return response;
  } catch (error) {
    console.error('Could not read roadmap job status from Redis:', error);
    return NextResponse.json({ error: 'Redis queue is unavailable' }, { status: 503 });
  }
}
