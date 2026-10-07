import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export type ServiceName = 'frontend' | 'job-detection' | 'redis' | 'database' | 'signaling' | 'groq' | 'youtube';

export type QueueMessage<T = unknown> = {
  messageId: string;
  type: 'GENERATE_ROADMAP' | 'ANALYZE_JOB' | 'UPDATE_PROGRESS' | 'FETCH_RESOURCES';
  userId: string;
  timestamp: string;
  payload: T;
};

export type DistributedEvent = {
  eventId: string;
  service: ServiceName;
  type: string;
  timestamp: string;
  logicalClock: number;
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

let logicalClock = 0;
const eventHistory: DistributedEvent[] = [];
const eventListeners = new Set<(event: DistributedEvent) => void>();

export function recordEvent(input: Omit<DistributedEvent, 'eventId' | 'timestamp' | 'logicalClock'>) {
  const event = {
    ...input,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    logicalClock: ++logicalClock,
  } satisfies DistributedEvent;
  eventHistory.push(event);
  if (eventHistory.length > 200) eventHistory.shift();
  eventListeners.forEach((listener) => listener(event));
  return event;
}

export function getEvents() {
  return [...eventHistory].reverse();
}

export function subscribeToEvents(listener: (event: DistributedEvent) => void) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
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
