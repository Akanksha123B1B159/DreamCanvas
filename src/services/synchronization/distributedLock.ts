import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface LockState {
  resource: string;
  isLocked: boolean;
  lockHolder: string | null;
  token: string | null;
  acquiredAt: string | null;
  expiresAt: string | null;
  ttlRemainingMs: number;
  waitingQueue: string[];
}

export class DistributedLockManager {
  private redis: Redis | null = null;
  private memoryLocks: Map<
    string,
    { holder: string; token: string; acquiredAt: number; expiresAt: number; timer: NodeJS.Timeout }
  > = new Map();
  private waitQueues: Map<string, string[]> = new Map();

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    try {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: () => null,
      });
      this.redis.on('error', () => {});
    } catch {
      this.redis = null;
    }
  }

  public async acquireLock(
    resource: string,
    requestedBy: string,
    ttlMs = 10000
  ): Promise<{ success: boolean; token?: string; error?: string; holder?: string }> {
    const token = randomUUID();

    // 1. Try Redis first if available
    if (this.redis) {
      try {
        if (this.redis.status !== 'ready') await this.redis.connect().catch(() => {});
        const key = `lock:${resource}`;
        // SET key token NX PX ttlMs
        const res = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
        if (res === 'OK') {
          await this.redis.set(`lockholder:${resource}`, requestedBy, 'PX', ttlMs);
          this.removeFromWaitQueue(resource, requestedBy);
          return { success: true, token };
        } else {
          const currentHolder = (await this.redis.get(`lockholder:${resource}`)) || 'Unknown process';
          this.addToWaitQueue(resource, requestedBy);
          return { success: false, error: 'Resource locked by another process', holder: currentHolder };
        }
      } catch {
        // Fallback to in-memory lock
      }
    }

    // 2. In-memory distributed lock model
    const existing = this.memoryLocks.get(resource);
    if (existing && Date.now() < existing.expiresAt) {
      this.addToWaitQueue(resource, requestedBy);
      return { success: false, error: 'Resource locked by another process', holder: existing.holder };
    }

    // Clear old timer if expired
    if (existing) clearTimeout(existing.timer);

    const now = Date.now();
    const timer = setTimeout(() => {
      this.releaseLock(resource, token);
      this.promoteNextWaiter(resource, ttlMs);
    }, ttlMs);

    this.memoryLocks.set(resource, {
      holder: requestedBy,
      token,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      timer,
    });

    this.removeFromWaitQueue(resource, requestedBy);
    return { success: true, token };
  }

  public async releaseLock(resource: string, token: string): Promise<{ success: boolean; message: string }> {
    if (this.redis) {
      try {
        if (this.redis.status !== 'ready') await this.redis.connect().catch(() => {});
        const key = `lock:${resource}`;
        // Atomic compare-and-delete Lua script
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            redis.call("del", "lockholder:" .. KEYS[2])
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await this.redis.eval(luaScript, 1, key, resource, token);
        if (res === 1) {
          this.promoteNextWaiter(resource, 10000);
          return { success: true, message: 'Lock released successfully' };
        }
      } catch {}
    }

    const current = this.memoryLocks.get(resource);
    if (current && current.token === token) {
      clearTimeout(current.timer);
      this.memoryLocks.delete(resource);
      this.promoteNextWaiter(resource, 10000);
      return { success: true, message: 'Lock released successfully' };
    }

    return { success: false, message: 'Token invalid or lock expired' };
  }

  public async getLockState(resource: string): Promise<LockState> {
    const queue = this.waitQueues.get(resource) || [];

    if (this.redis) {
      try {
        if (this.redis.status !== 'ready') await this.redis.connect().catch(() => {});
        const key = `lock:${resource}`;
        const token = await this.redis.get(key);
        if (token) {
          const holder = await this.redis.get(`lockholder:${resource}`);
          const pttl = await this.redis.pttl(key);
          return {
            resource,
            isLocked: true,
            lockHolder: holder || 'Worker Process',
            token: token.slice(0, 8) + '...',
            acquiredAt: new Date(Date.now() - (10000 - pttl)).toISOString(),
            expiresAt: new Date(Date.now() + Math.max(0, pttl)).toISOString(),
            ttlRemainingMs: Math.max(0, pttl),
            waitingQueue: queue,
          };
        }
      } catch {}
    }

    const memory = this.memoryLocks.get(resource);
    if (memory && Date.now() < memory.expiresAt) {
      const remaining = memory.expiresAt - Date.now();
      return {
        resource,
        isLocked: true,
        lockHolder: memory.holder,
        token: memory.token.slice(0, 8) + '...',
        acquiredAt: new Date(memory.acquiredAt).toISOString(),
        expiresAt: new Date(memory.expiresAt).toISOString(),
        ttlRemainingMs: remaining,
        waitingQueue: queue,
      };
    }

    return {
      resource,
      isLocked: false,
      lockHolder: null,
      token: null,
      acquiredAt: null,
      expiresAt: null,
      ttlRemainingMs: 0,
      waitingQueue: queue,
    };
  }

  private addToWaitQueue(resource: string, node: string) {
    if (!this.waitQueues.has(resource)) this.waitQueues.set(resource, []);
    const q = this.waitQueues.get(resource)!;
    if (!q.includes(node)) q.push(node);
  }

  private removeFromWaitQueue(resource: string, node: string) {
    const q = this.waitQueues.get(resource);
    if (q) {
      const idx = q.indexOf(node);
      if (idx !== -1) q.splice(idx, 1);
    }
  }

  private promoteNextWaiter(resource: string, ttlMs: number) {
    const q = this.waitQueues.get(resource);
    if (q && q.length > 0) {
      const nextNode = q.shift()!;
      this.acquireLock(resource, nextNode, ttlMs);
    }
  }
}

export const distributedLockManager = new DistributedLockManager();
