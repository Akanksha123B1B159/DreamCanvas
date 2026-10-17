import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export type EventType =
  | 'ROADMAP_GENERATED'
  | 'JOB_ANALYSIS_STARTED'
  | 'JOB_ANALYSIS_COMPLETED'
  | 'VIDEO_SEARCH_REQUESTED'
  | 'PROGRESS_UPDATED'
  | 'BADGE_EARNED'
  | 'SYSTEM_HEARTBEAT'
  | 'LOCK_ACQUIRED'
  | 'LOCK_RELEASED';

export interface BrokerMessage<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  producer: string;
  consumer?: string;
  payload: T;
  timestamp: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DLQ';
  retryCount?: number;
  error?: string;
}

class MessageBroker {
  private redisClient: Redis | null = null;
  private inMemoryQueue: BrokerMessage[] = [];
  private inMemoryDLQ: BrokerMessage[] = [];
  private inMemoryHistory: BrokerMessage[] = [];
  private subscribers: Map<string, Array<(msg: BrokerMessage) => void>> = new Map();

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    try {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: () => null, // disable endless reconnect
      });
      this.redisClient.on('error', () => {
        // Fallback gracefully to in-memory mode
      });
    } catch {
      this.redisClient = null;
    }
  }

  public async publish<T extends Record<string, unknown>>(
    eventType: EventType,
    producer: string,
    payload: T,
    consumer: string = 'broadcast'
  ): Promise<BrokerMessage<T>> {
    const message: BrokerMessage<T> = {
      eventId: `evt-${randomUUID().slice(0, 8)}`,
      eventType,
      producer,
      consumer,
      payload,
      timestamp: new Date().toISOString(),
      status: 'PROCESSED',
      retryCount: 0,
    };

    // Store in history
    this.inMemoryHistory.unshift(message as BrokerMessage<Record<string, unknown>>);
    if (this.inMemoryHistory.length > 200) this.inMemoryHistory.pop();

    // Trigger local memory subscribers
    const subs = this.subscribers.get(eventType) || [];
    subs.forEach((cb) => {
      try {
        cb(message as BrokerMessage<Record<string, unknown>>);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });

    // Try Redis Pub/Sub if connected
    if (this.redisClient) {
      try {
        if (this.redisClient.status !== 'ready') {
          await this.redisClient.connect().catch(() => {});
        }
        await this.redisClient.publish('dreamcanvas:events', JSON.stringify(message));
        await this.redisClient.lpush('dreamcanvas:event_history', JSON.stringify(message));
        await this.redisClient.ltrim('dreamcanvas:event_history', 0, 199);
      } catch {
        // In-memory fallback
      }
    }

    return message;
  }

  public async enqueue<T extends Record<string, unknown>>(
    eventType: EventType,
    producer: string,
    payload: T
  ): Promise<BrokerMessage<T>> {
    const message: BrokerMessage<T> = {
      eventId: `msg-${randomUUID().slice(0, 8)}`,
      eventType,
      producer,
      payload,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
    };

    this.inMemoryQueue.push(message as BrokerMessage<Record<string, unknown>>);

    if (this.redisClient) {
      try {
        if (this.redisClient.status !== 'ready') {
          await this.redisClient.connect().catch(() => {});
        }
        await this.redisClient.lpush('dreamcanvas:queue', JSON.stringify(message));
      } catch {
        // Fallback in-memory
      }
    }

    return message;
  }

  public async sendToDeadLetterQueue(message: BrokerMessage, errorReason: string): Promise<void> {
    const dlqMessage: BrokerMessage = {
      ...message,
      status: 'DLQ',
      error: errorReason,
      timestamp: new Date().toISOString(),
    };

    this.inMemoryDLQ.unshift(dlqMessage);
    if (this.inMemoryDLQ.length > 50) this.inMemoryDLQ.pop();

    if (this.redisClient) {
      try {
        await this.redisClient.lpush('dreamcanvas:dlq', JSON.stringify(dlqMessage));
      } catch {}
    }
  }

  public async getRecentMessages(limit = 50): Promise<BrokerMessage[]> {
    if (this.redisClient) {
      try {
        if (this.redisClient.status !== 'ready') {
          await this.redisClient.connect().catch(() => {});
        }
        const rows = await this.redisClient.lrange('dreamcanvas:event_history', 0, limit - 1);
        if (rows && rows.length > 0) {
          return rows.map((r) => JSON.parse(r));
        }
      } catch {}
    }

    // Default to in-memory events if Redis is empty or unpopulated
    if (this.inMemoryHistory.length === 0) {
      this.seedInitialEvents();
    }
    return this.inMemoryHistory.slice(0, limit);
  }

  public async getDLQMessages(): Promise<BrokerMessage[]> {
    return this.inMemoryDLQ;
  }

  public subscribe(eventType: EventType | '*', callback: (msg: BrokerMessage) => void): () => void {
    const key = eventType;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(callback);

    return () => {
      const arr = this.subscribers.get(key) || [];
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  private seedInitialEvents() {
    const initialEvents: Array<{ type: EventType; producer: string; consumer: string; payload: Record<string, unknown> }> = [
      {
        type: 'ROADMAP_GENERATED',
        producer: 'Next.js Frontend',
        consumer: 'Supabase Database',
        payload: { role: 'Full Stack Engineer', durationDays: 30, topicsCount: 30 },
      },
      {
        type: 'JOB_ANALYSIS_STARTED',
        producer: 'JobDetection Page',
        consumer: 'FastAPI ML Service',
        payload: { jobId: 'job-982', sampleLength: 420 },
      },
      {
        type: 'JOB_ANALYSIS_COMPLETED',
        producer: 'FastAPI ML Service',
        consumer: 'Explainable AI Engine',
        payload: { prediction: 'REAL', confidence: 0.94 },
      },
      {
        type: 'VIDEO_SEARCH_REQUESTED',
        producer: 'Roadmap Viewer',
        consumer: 'YouTube Data API',
        payload: { query: 'Next.js 16 App Router Tutorial', maxResults: 3 },
      },
      {
        type: 'PROGRESS_UPDATED',
        producer: 'Calendar Checklist',
        consumer: 'Gamification Engine',
        payload: { completedDay: 1, currentStreak: 3 },
      },
      {
        type: 'BADGE_EARNED',
        producer: 'Gamification Engine',
        consumer: 'User Profile & BadgeWall',
        payload: { badgeId: 'day1_start', title: 'Starter Day Badge' },
      },
    ];

    const now = Date.now();
    initialEvents.forEach((item, index) => {
      this.inMemoryHistory.push({
        eventId: `evt-init-00${index + 1}`,
        eventType: item.type,
        producer: item.producer,
        consumer: item.consumer,
        payload: item.payload,
        timestamp: new Date(now - (6 - index) * 45000).toISOString(),
        status: 'PROCESSED',
        retryCount: 0,
      });
    });
  }
}

export const messageBroker = new MessageBroker();
