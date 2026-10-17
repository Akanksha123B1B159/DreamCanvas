jest.mock('ioredis', () => {
  const state = {
    attempts: 0,
    keys: [] as string[],
    scripts: [] as string[],
  };

  class MockRedis {
    status = 'wait';

    constructor() {}

    async connect() {
      this.status = 'ready';
    }

    async eval(script: string, keyCount: number, key: string, windowSeconds: number) {
      if (keyCount !== 1) throw new Error('Unexpected rate-limit key count.');
      state.attempts += 1;
      state.keys.push(key);
      state.scripts.push(script);
      return [state.attempts, windowSeconds];
    }
  }

  return {
    __esModule: true,
    default: MockRedis,
    __state: state,
  };
});

import { consumeRegistrationAttempt } from '@/app/_libs/registrationRateLimit';

const redisState = jest.requireMock('ioredis').__state as {
  attempts: number;
  keys: string[];
  scripts: string[];
};

describe('registration rate limiter', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisState.attempts = 0;
    redisState.keys.length = 0;
    redisState.scripts.length = 0;
  });

  it('allows five attempts per client and rejects subsequent attempts in the shared window', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      headers: { 'X-Real-IP': '192.0.2.10' },
    });

    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(await consumeRegistrationAttempt(request));
    }

    expect(results.map(({ allowed }) => allowed)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(results[5].retryAfterSeconds).toBe(900);
    expect(new Set(redisState.keys).size).toBe(1);
    expect(redisState.keys[0]).not.toContain('192.0.2.10');
    expect(redisState.scripts[0]).toContain("redis.call('INCR'");
    expect(redisState.scripts[0]).toContain("redis.call('EXPIRE'");
  });
});
