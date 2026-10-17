import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const frontend = process.env.FRONTEND_URL || 'http://frontend:3000';
const events = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const parsedHeartbeatInterval = Number.parseInt(process.env.HEARTBEAT_INTERVAL || '10', 10);
const heartbeatIntervalSeconds = Number.isInteger(parsedHeartbeatInterval) && parsedHeartbeatInterval > 0
  ? parsedHeartbeatInterval
  : 10;
const heartbeatKey = process.env.WORKER_HEARTBEAT_KEY || 'dreamcanvas:health:worker';
const heartbeatTtlSeconds = Math.max(heartbeatIntervalSeconds * 3, 15);
const workerStartedAt = Date.now();
let logicalClock = 0;

function advanceClock(type, receivedTimestamp) {
  if (type === 'receive' && Number.isSafeInteger(receivedTimestamp) && receivedTimestamp >= 0) {
    logicalClock = Math.max(logicalClock, receivedTimestamp) + 1;
  } else {
    logicalClock += 1;
  }
  return logicalClock;
}

async function publish(event) {
  const serialized = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
    physicalTimestamp: event.physicalTimestamp || new Date().toISOString(),
  });
  try {
    await events.lpush(process.env.DISTRIBUTED_EVENT_HISTORY_KEY || 'dreamcanvas:distributed:event-history', serialized);
    await events.ltrim(process.env.DISTRIBUTED_EVENT_HISTORY_KEY || 'dreamcanvas:distributed:event-history', 0, 499);
  } catch (error) {
    console.error('Roadmap worker could not persist a distributed event:', error);
  }
  try {
    await events.publish('dreamcanvas:events', serialized);
  } catch (error) {
    console.error('Roadmap worker could not publish a distributed event:', error);
  }
}

async function recordEvent(eventName, { correlationId, jobId, eventType = 'local', receivedTimestamp, status = 'INFO', error } = {}) {
  const logicalTimestamp = advanceClock(eventType, receivedTimestamp);
  await publish({
    eventId: crypto.randomUUID(),
    service: 'frontend',
    type: eventName,
    processName: 'roadmap-worker',
    eventType,
    logicalClock: logicalTimestamp,
    logicalTimestamp,
    correlationId,
    jobId,
    status,
    error,
    physicalTimestamp: new Date().toISOString(),
  });
  return logicalTimestamp;
}

async function publishHeartbeat() {
  await events.set(
    heartbeatKey,
    JSON.stringify({
      service: 'roadmap-worker',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - workerStartedAt) / 1000),
    }),
    'EX',
    heartbeatTtlSeconds,
  );
}

await publishHeartbeat();
setInterval(() => {
  publishHeartbeat().catch((error) => {
    console.error('Roadmap worker heartbeat failed:', error);
  });
}, heartbeatIntervalSeconds * 1000);

for (;;) {
  let message;
  try {
    const result = await redis.brpop('dreamcanvas:roadmap:jobs', 0);
    message = JSON.parse(result[1]);
  } catch (error) {
    console.error('Roadmap worker could not receive a queue message:', error);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    continue;
  }

  const { jobId } = message.payload;
  const correlationId = typeof message.correlationId === 'string' ? message.correlationId : jobId;
  const receivedTimestamp = Number.isSafeInteger(message.lamportTimestamp) ? message.lamportTimestamp : undefined;

  try {
    await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({
      jobId,
      status: 'RUNNING',
      messageId: message.messageId,
      correlationId,
      logicalTimestamp: await recordEvent('REQUEST_RECEIVED', {
        correlationId,
        jobId,
        eventType: 'receive',
        receivedTimestamp,
      }),
    }));

    const requestTimestamp = await recordEvent('ROADMAP_GENERATION_SENT', {
      correlationId,
      jobId,
      eventType: 'send',
    });
    const response = await fetch(`${frontend}/api/generate-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'x-lamport-timestamp': String(requestTimestamp),
        'x-lamport-process': 'roadmap-worker',
        'x-lamport-event': 'WORKER_ROADMAP_REQUEST',
      },
      body: JSON.stringify({ skills: message.payload.skills, role: message.payload.role }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Roadmap generation failed');
    const responseTimestamp = Number(response.headers.get('x-lamport-timestamp') || data.logicalTimestamp);
    const resultReceived = await recordEvent('AI_ANALYSIS_COMPLETED', {
      correlationId,
      jobId,
      eventType: 'receive',
      receivedTimestamp: Number.isSafeInteger(responseTimestamp) ? responseTimestamp : undefined,
      status: 'SUCCESS',
    });

    await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({
      jobId,
      status: 'COMPLETED',
      result: data,
      correlationId,
      logicalTimestamp: resultReceived,
    }));
    await recordEvent('ROADMAP_JOB_RESULT_STORED', {
      correlationId,
      jobId,
      status: 'SUCCESS',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown roadmap worker error.';
    try {
      await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({
        jobId,
        status: 'FAILED',
        error: detail,
        correlationId,
        logicalTimestamp: await recordEvent('LEARNING_PLAN_FAILED', {
          correlationId,
          jobId,
          status: 'FAILED',
          error: detail,
        }),
      }));
    } catch (stateError) {
      console.error('Roadmap worker failed to persist job failure:', stateError);
    }
  }
}
