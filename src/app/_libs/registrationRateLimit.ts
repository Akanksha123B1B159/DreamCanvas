import { createHash } from 'crypto';
import Redis from 'ioredis';

const MAX_REGISTRATION_ATTEMPTS = 5;
const REGISTRATION_WINDOW_SECONDS = 15 * 60;
const REDIS_KEY_PREFIX = 'dreamcanvas:auth:register:v1';

const incrementWithExpiryScript = `
  local attempts = redis.call('INCR', KEYS[1])
  if attempts == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return { attempts, redis.call('TTL', KEYS[1]) }
`;

let redis: Redis | undefined;
let redisConnection: Promise<void> | undefined;

async function getRedisClient(): Promise<Redis> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Registration rate limiting requires REDIS_URL.');
  }

  if (!redis || redis.status === 'end') {
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      retryStrategy: (attempt) => attempt <= 1 ? 100 : null,
    });
    redisConnection = undefined;
  }

  const client = redis;
  if (client.status === 'wait') {
    redisConnection ??= client.connect().catch((error: unknown) => {
      redisConnection = undefined;
      throw error;
    });
  }
  if (redisConnection) await redisConnection;
  if (client.status !== 'ready') {
    throw new Error('Registration rate limiter is unavailable.');
  }
  return client;
}

function getClientAddress(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstForwardedAddress = forwardedFor?.split(',')[0]?.trim();
  return firstForwardedAddress || 'unknown';
}

export async function consumeRegistrationAttempt(
  request: Request,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const addressHash = createHash('sha256')
    .update(getClientAddress(request))
    .digest('hex');
  const key = `${REDIS_KEY_PREFIX}:${addressHash}`;
  const client = await getRedisClient();
  const result = await client.eval(
    incrementWithExpiryScript,
    1,
    key,
    REGISTRATION_WINDOW_SECONDS,
  ) as [number, number];
  const attempts = Number(result[0]);
  const ttl = Math.max(1, Number(result[1]));

  return {
    allowed: attempts <= MAX_REGISTRATION_ATTEMPTS,
    retryAfterSeconds: ttl,
  };
}
