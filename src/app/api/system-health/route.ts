import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { pool } from '@/app/_libs/db';
import { services } from '@/app/_libs/distributed';
import {
  heartbeatFailureThreshold,
  heartbeatHealthMonitor,
  heartbeatIntervalSeconds,
  heartbeatTimeoutMs,
  type HealthCheck,
  type HealthProbeResult,
} from '@/app/_libs/healthMonitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const workerHeartbeatKey = process.env.WORKER_HEARTBEAT_KEY || 'dreamcanvas:health:worker';

function responseHealth(status: number, body: unknown, responseTimeMs: number): HealthProbeResult {
  if (!body || typeof body !== 'object') {
    throw new Error('Health endpoint returned an invalid response.');
  }
  const data = body as Record<string, unknown>;
  if (!('status' in data)) throw new Error('Health endpoint response is missing its status.');
  const serviceStatus = String(data.status).toLowerCase();
  const healthy = status >= 200 && status < 300 && (serviceStatus === 'healthy' || serviceStatus === 'online');
  const explicitlyDegraded = serviceStatus === 'degraded';
  const unknown = serviceStatus === 'unknown' || serviceStatus === 'unconfigured';
  const rejectedCredentials = status === 401 || status === 403;
  return {
    status: healthy
      ? 'HEALTHY'
      : explicitlyDegraded || rejectedCredentials
        ? 'DEGRADED'
        : unknown
          ? 'UNKNOWN'
          : 'DOWN',
    responseTimeMs,
    uptimeSeconds: typeof data.uptimeSeconds === 'number' ? data.uptimeSeconds : undefined,
    lastError: healthy
      ? null
      : unknown
        ? typeof data.detail === 'string' ? data.detail : 'The service is not configured.'
      : typeof data.detail === 'string'
        ? data.detail
        : `Health endpoint responded with HTTP ${status} and status ${serviceStatus}.`,
  };
}

async function fetchHealth(url: string, signal: AbortSignal): Promise<HealthProbeResult> {
  const startedAt = Date.now();
  const response = await fetch(url, { signal, cache: 'no-store' });
  const body = await response.json().catch(() => null);
  return responseHealth(response.status, body, Date.now() - startedAt);
}

function createHealthChecks(): HealthCheck[] {
  const checks: HealthCheck[] = [
    {
      serviceId: 'frontend-api',
      serviceName: 'Frontend / API',
      failureMessage: 'Frontend/API health endpoint could not be reached.',
      check: async (signal) => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
          return { status: 'UNKNOWN', responseTimeMs: null, lastError: 'NEXT_PUBLIC_APP_URL is not configured.' };
        }
        return fetchHealth(`${appUrl.replace(/\/$/, '')}/api/health`, signal);
      },
    },
    {
      serviceId: 'ai-service',
      serviceName: 'AI/ML Job Detection Service',
      failureMessage: 'AI/ML health endpoint could not be reached.',
      check: async (signal) => {
        return fetchHealth(`${services['job-detection'].replace(/\/$/, '')}/health`, signal);
      },
    },
    {
      serviceId: 'groq-ai',
      serviceName: 'Groq AI Provider',
      failureMessage: 'Groq AI provider health check failed.',
      check: async (signal) => {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return { status: 'UNKNOWN', responseTimeMs: null, lastError: 'GROQ_API_KEY is not configured.' };
        }
        const startedAt = Date.now();
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal,
          cache: 'no-store',
        });
        return {
          status: response.ok ? 'HEALTHY' : 'DOWN',
          responseTimeMs: Date.now() - startedAt,
          lastError: response.ok ? null : `Groq health request returned HTTP ${response.status}.`,
        };
      },
    },
    {
      serviceId: 'database',
      serviceName: process.env.DATABASE_URL ? 'PostgreSQL Database' : 'Supabase Database',
      failureMessage: 'Database health check failed; inspect the server logs.',
      check: async (signal) => {
        if (process.env.DATABASE_URL) {
          const startedAt = Date.now();
          await pool.query('SELECT 1');
          return { status: 'HEALTHY', responseTimeMs: Date.now() - startedAt };
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) {
          return { status: 'UNKNOWN', responseTimeMs: null, lastError: 'Supabase database is not configured.' };
        }

        const startedAt = Date.now();
        const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          signal,
          cache: 'no-store',
        });
        return {
          status: response.ok ? 'HEALTHY' : response.status === 401 || response.status === 403 ? 'DEGRADED' : 'DOWN',
          responseTimeMs: Date.now() - startedAt,
          lastError: response.ok
            ? null
            : response.status === 401 || response.status === 403
              ? `Supabase rejected the configured health-check credentials (HTTP ${response.status}).`
              : `Supabase REST health request returned HTTP ${response.status}.`,
        };
      },
    },
    {
      serviceId: 'redis',
      serviceName: 'Redis Broker',
      failureMessage: 'Redis health check failed; inspect the server logs.',
      check: async (signal) => {
        if (!process.env.REDIS_URL) {
          return { status: 'UNKNOWN', responseTimeMs: null, lastError: 'REDIS_URL is not configured.' };
        }
        const client = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: heartbeatTimeoutMs,
        });
        const startedAt = Date.now();
        const disconnectOnAbort = () => client.disconnect();
        signal.addEventListener('abort', disconnectOnAbort, { once: true });
        try {
          await client.connect();
          const response = await client.ping();
          if (response !== 'PONG') throw new Error('Redis returned an invalid PING response.');
          return { status: 'HEALTHY', responseTimeMs: Date.now() - startedAt };
        } finally {
          signal.removeEventListener('abort', disconnectOnAbort);
          client.disconnect();
        }
      },
    },
    {
      serviceId: 'roadmap-worker',
      serviceName: 'Roadmap Background Worker',
      failureMessage: 'Worker heartbeat could not be read from Redis.',
      check: async (signal) => {
        if (!process.env.REDIS_URL) {
          return { status: 'UNKNOWN', responseTimeMs: null, lastError: 'Worker heartbeat requires REDIS_URL.' };
        }
        const client = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: heartbeatTimeoutMs,
        });
        const disconnectOnAbort = () => client.disconnect();
        signal.addEventListener('abort', disconnectOnAbort, { once: true });
        try {
          const startedAt = Date.now();
          await client.connect();
          const heartbeat = await client.get(workerHeartbeatKey);
          if (!heartbeat) {
            return {
              status: 'DOWN',
              responseTimeMs: Date.now() - startedAt,
              lastError: 'No worker heartbeat is present in Redis.',
            };
          }
          const payload = JSON.parse(heartbeat) as {
            timestamp?: unknown;
            service?: unknown;
            uptimeSeconds?: unknown;
          };
          if (
            payload.service !== 'roadmap-worker'
            || typeof payload.timestamp !== 'string'
            || !Number.isFinite(Date.parse(payload.timestamp))
          ) {
            throw new Error('Worker heartbeat has an invalid payload.');
          }
          const heartbeatAgeMs = Date.now() - Date.parse(payload.timestamp);
          const leaseMs = Math.max(heartbeatIntervalSeconds * 3000, heartbeatTimeoutMs * 2);
          if (heartbeatAgeMs > leaseMs) {
            return {
              status: 'DOWN',
              responseTimeMs: Date.now() - startedAt,
              lastError: `Worker heartbeat expired ${Math.floor(heartbeatAgeMs / 1000)} seconds ago.`,
            };
          }
          return {
            status: 'HEALTHY',
            responseTimeMs: Date.now() - startedAt,
            uptimeSeconds: typeof payload.uptimeSeconds === 'number' ? payload.uptimeSeconds : undefined,
          };
        } finally {
          signal.removeEventListener('abort', disconnectOnAbort);
          client.disconnect();
        }
      },
    },
  ];

  return checks;
}

function simulationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.HEALTH_DEMO_MODE === 'true';
}

export async function GET() {
  const servicesHealth = await heartbeatHealthMonitor.checkAll(createHealthChecks(), heartbeatTimeoutMs);
  const response = NextResponse.json({
    services: servicesHealth,
    history: heartbeatHealthMonitor.getHistory(50),
    checkedAt: new Date().toISOString(),
    config: {
      heartbeatIntervalSeconds,
      timeoutMs: heartbeatTimeoutMs,
      failureThreshold: heartbeatFailureThreshold,
    },
    simulationEnabled: simulationEnabled(),
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: NextRequest) {
  if (!simulationEnabled()) {
    return NextResponse.json({ error: 'Failure simulation is disabled in production.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || (body.action !== 'simulate' && body.action !== 'restore') || body.serviceId !== 'ai-service') {
    return NextResponse.json({ error: 'A valid simulate/restore action for ai-service is required.' }, { status: 400 });
  }

  const checks = createHealthChecks();
  await heartbeatHealthMonitor.checkAll(checks, heartbeatTimeoutMs);
  const changed = body.action === 'simulate'
    ? heartbeatHealthMonitor.simulateFailure(body.serviceId)
    : heartbeatHealthMonitor.restoreService(body.serviceId);
  if (!changed) {
    return NextResponse.json({ error: 'The requested service is not registered.' }, { status: 404 });
  }

  const result = await heartbeatHealthMonitor.checkAll(checks, heartbeatTimeoutMs);
  return NextResponse.json({
    services: result,
    history: heartbeatHealthMonitor.getHistory(50),
    checkedAt: new Date().toISOString(),
    config: {
      heartbeatIntervalSeconds,
      timeoutMs: heartbeatTimeoutMs,
      failureThreshold: heartbeatFailureThreshold,
    },
    simulationEnabled: simulationEnabled(),
  });
}
