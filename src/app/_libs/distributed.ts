import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { LamportLogicalClock } from '@/services/synchronization/lamportLogicalClock';

export type ServiceName = 'frontend' | 'job-detection' | 'redis' | 'database' | 'signaling' | 'groq' | 'youtube';

export type QueueMessage<T = unknown> = {
  messageId: string;
  type: 'GENERATE_ROADMAP' | 'ANALYZE_JOB' | 'UPDATE_PROGRESS' | 'FETCH_RESOURCES';
  userId: string;
  timestamp: string;
  correlationId?: string;
  lamportTimestamp?: number;
  payload: T;
};

export type DistributedEvent = {
  eventId: string;
  service: ServiceName;
  type: string;
  timestamp: string;
  logicalClock: number;
  logicalTimestamp: number;
  processName: string;
  eventType: 'local' | 'send' | 'receive';
  correlationId?: string;
  status?: 'SUCCESS' | 'FAILED' | 'INFO';
  error?: string;
  jobId?: string;
  payload?: Record<string, unknown>;
};

export type WorkflowEventInput = {
  service: ServiceName;
  eventName: string;
  processName: string;
  correlationId: string;
  eventType: 'local' | 'send' | 'receive';
  receivedTimestamp?: number;
  status?: 'SUCCESS' | 'FAILED' | 'INFO';
  error?: string;
  jobId?: string;
  payload?: Record<string, unknown>;
};

export const services: Record<ServiceName, string> = {
  frontend: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'job-detection': process.env.JOB_DETECTION_URL || 'http://localhost:8000',
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  database: process.env.DATABASE_URL || 'Supabase-managed database',
  signaling: process.env.SIGNALING_URL || 'Next.js /api/signaling',
  groq: 'https://api.groq.com',
  youtube: 'https://www.googleapis.com/youtube/v3',
};

export const groqModel = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b';

const processClocks = new Map<string, LamportLogicalClock>();
const eventHistory: DistributedEvent[] = [];
const eventListeners = new Set<(event: DistributedEvent) => void>();
const eventHistoryKey = process.env.DISTRIBUTED_EVENT_HISTORY_KEY || 'dreamcanvas:distributed:event-history';
let eventRedis: Redis | undefined;

function clockFor(processName: string): LamportLogicalClock {
  let clock = processClocks.get(processName);
  if (!clock) {
    clock = new LamportLogicalClock();
    processClocks.set(processName, clock);
  }
  return clock;
}

function storeEvent(event: DistributedEvent): DistributedEvent {
  eventHistory.push(event);
  if (eventHistory.length > 500) eventHistory.shift();
  eventListeners.forEach((listener) => listener(event));
  if (process.env.REDIS_URL) {
    if (!eventRedis || eventRedis.status === 'end') {
      eventRedis = new Redis(services.redis, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 1500,
        retryStrategy: (attempt) => attempt <= 1 ? 100 : null,
      });
    }
    const client = eventRedis;
    void client.lpush(eventHistoryKey, JSON.stringify(event))
      .then(() => client.ltrim(eventHistoryKey, 0, 499))
      .then(() => client.publish('dreamcanvas:events', JSON.stringify(event)))
      .catch((error: unknown) => {
        console.error('Could not publish distributed event to Redis:', error instanceof Error ? error.message : error);
      });
  }
  return event;
}

export function recordWorkflowEvent(input: WorkflowEventInput): DistributedEvent {
  const clock = clockFor(input.processName);
  const logicalTimestamp = input.eventType === 'receive'
    ? input.receivedTimestamp === undefined
      ? clock.localEvent()
      : clock.receiveMessage(input.receivedTimestamp)
    : input.eventType === 'send'
      ? clock.sendMessage()
      : clock.localEvent();

  return storeEvent({
    eventId: randomUUID(),
    service: input.service,
    type: input.eventName,
    timestamp: new Date().toISOString(),
    logicalClock: logicalTimestamp,
    logicalTimestamp,
    processName: input.processName,
    eventType: input.eventType,
    correlationId: input.correlationId,
    status: input.status,
    error: input.error,
    jobId: input.jobId,
    payload: input.payload,
  });
}

export function recordPropagatedWorkflowEvent(
  input: Omit<WorkflowEventInput, 'eventType' | 'receivedTimestamp'> & { logicalTimestamp: number },
): DistributedEvent {
  if (!Number.isSafeInteger(input.logicalTimestamp) || input.logicalTimestamp < 0) {
    throw new RangeError('Propagated Lamport timestamp must be a non-negative safe integer.');
  }
  return storeEvent({
    eventId: randomUUID(),
    service: input.service,
    type: input.eventName,
    timestamp: new Date().toISOString(),
    logicalClock: input.logicalTimestamp,
    logicalTimestamp: input.logicalTimestamp,
    processName: input.processName,
    eventType: 'send',
    correlationId: input.correlationId,
    status: input.status,
    error: input.error,
    jobId: input.jobId,
    payload: input.payload,
  });
}

export function recordEvent(input: Omit<DistributedEvent, 'eventId' | 'timestamp' | 'logicalClock' | 'logicalTimestamp' | 'processName' | 'eventType'>) {
  const processName = input.service;
  const logicalTimestamp = clockFor(processName).localEvent();
  const event = {
    ...input,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    logicalClock: logicalTimestamp,
    logicalTimestamp,
    processName,
    eventType: 'local' as const,
  } satisfies DistributedEvent;
  return storeEvent(event);
}

export function getEvents() {
  return [...eventHistory].reverse();
}

export function getDistributedEventHistoryKey() {
  return eventHistoryKey;
}

export function subscribeToEvents(listener: (event: DistributedEvent) => void) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function getProcessLogicalTime(processName: string): number {
  return clockFor(processName).current();
}

let redis: Redis | undefined;
export function getRedis() {
  if (!redis) redis = new Redis(services.redis, { lazyConnect: true, maxRetriesPerRequest: 1 });
  return redis;
}

export async function withRetry<T>(operation: () => Promise<T>, attempts = 2, timeoutMs = 8000) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service request timed out')), timeoutMs)),
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Service request failed');
}
