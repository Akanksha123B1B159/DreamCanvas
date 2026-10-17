export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';

export interface RegisteredService {
  serviceId: string;
  serviceName: string;
  serviceType: 'compute' | 'storage' | 'ai' | 'ml' | 'broker' | 'gateway';
  host: string;
  port: number | string;
  endpoint: string;
  health: ServiceHealthStatus;
  lastHeartbeat: string;
  capabilities: string[];
  latencyMs: number;
  responsibility: string;
  version: string;
}

class ServiceRegistry {
  private services: Map<string, RegisteredService> = new Map();

  constructor() {
    this.seedDefaultServices();
  }

  private seedDefaultServices() {
    const defaultServices: RegisteredService[] = [
      {
        serviceId: 'ml-001',
        serviceName: 'Job Fraud ML Service',
        serviceType: 'ml',
        host: process.env.JOB_DETECTION_HOST || 'localhost',
        port: 8000,
        endpoint: `${process.env.JOB_DETECTION_URL || 'http://localhost:8000'}/rpc/predict-job`,
        health: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['rpc', 'bert-svm-classification', 'jsonrpc-2.0', 'explainable-ai-proxy'],
        latencyMs: 14,
        responsibility: 'Performs natural language classification on job descriptions to identify fraudulent offers.',
        version: '1.2.0',
      },
      {
        serviceId: 'ai-001',
        serviceName: 'Groq Cloud LLM Service',
        serviceType: 'ai',
        host: 'api.groq.com',
        port: 443,
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        health: process.env.GROQ_API_KEY ? 'HEALTHY' : 'DEGRADED',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['roadmap-synthesis', 'skill-gap-analysis', 'career-coaching-chatbot'],
        latencyMs: 185,
        responsibility: 'Generates structured 30-day learning roadmaps and provides 24/7 AI career counseling.',
        version: 'qwen3.6-27b',
      },
      {
        serviceId: 'redis-001',
        serviceName: 'Redis Distributed Broker',
        serviceType: 'broker',
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
        endpoint: process.env.REDIS_URL || 'redis://localhost:6379',
        health: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['pub-sub', 'distributed-locks', 'fifo-queues', 'event-history', 'caching'],
        latencyMs: 3,
        responsibility: 'Provides asynchronous decoupling, event messaging, and mutual exclusion locking.',
        version: '7.2-alpine',
      },
      {
        serviceId: 'db-001',
        serviceName: 'Supabase PostgreSQL DB',
        serviceType: 'storage',
        host: 'supabase.co',
        port: 5432,
        endpoint: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase-managed.co',
        health: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['relational-acid', 'jwt-auth', 'row-level-security', 'realtime-subscriptions'],
        latencyMs: 42,
        responsibility: 'Persistent store for user profiles, roadmaps, streaks, badges, and progress logs.',
        version: 'PostgreSQL 15',
      },
      {
        serviceId: 'gateway-001',
        serviceName: 'Next.js Frontend & API Gateway',
        serviceType: 'gateway',
        host: 'localhost',
        port: 3000,
        endpoint: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        health: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['edge-routing', 'reverse-proxy', 'sse-streaming', 'session-middleware', 'webrtc-signaling'],
        latencyMs: 2,
        responsibility: 'Ingress entry point serving client UI, orchestrating RPC calls, and streaming events.',
        version: 'Next.js 16 (Turbopack)',
      },
      {
        serviceId: 'media-001',
        serviceName: 'WebRTC Signaling & P2P Gateway',
        serviceType: 'gateway',
        host: 'localhost',
        port: 3000,
        endpoint: '/api/signaling',
        health: 'HEALTHY',
        lastHeartbeat: new Date().toISOString(),
        capabilities: ['sdp-negotiation', 'ice-exchange', 'datachannel-broker', 'presence-sync'],
        latencyMs: 5,
        responsibility: 'Coordinates real-time peer discovery for collaborative video/audio and DataChannel study rooms.',
        version: 'RFC 8829',
      },
    ];

    defaultServices.forEach((s) => this.services.set(s.serviceId, s));
  }

  public getAll(): RegisteredService[] {
    return Array.from(this.services.values());
  }

  public getById(id: string): RegisteredService | undefined {
    return this.services.get(id);
  }

  public register(service: RegisteredService): void {
    this.services.set(service.serviceId, {
      ...service,
      lastHeartbeat: new Date().toISOString(),
    });
  }

  public recordHeartbeat(serviceId: string, latencyMs?: number): boolean {
    const service = this.services.get(serviceId);
    if (!service) return false;
    service.lastHeartbeat = new Date().toISOString();
    service.health = 'HEALTHY';
    if (latencyMs !== undefined) service.latencyMs = latencyMs;
    return true;
  }

  public updateHealth(serviceId: string, status: ServiceHealthStatus): boolean {
    const service = this.services.get(serviceId);
    if (!service) return false;
    service.health = status;
    return true;
  }

  public async runLiveHealthChecks(): Promise<RegisteredService[]> {
    const list = this.getAll();
    const now = Date.now();

    for (const service of list) {
      if (service.serviceId === 'ml-001') {
        try {
          const t0 = Date.now();
          const base = (process.env.JOB_DETECTION_URL || 'http://localhost:8000').replace(/\/$/, '');
          const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
          service.latencyMs = Date.now() - t0;
          service.health = res.ok ? 'HEALTHY' : 'FAILED';
          service.lastHeartbeat = new Date().toISOString();
        } catch {
          // If offline, check if simulated
          service.health = 'FAILED';
          service.latencyMs = 0;
        }
      } else if (service.serviceId === 'db-001') {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (url) {
          try {
            const t0 = Date.now();
            const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { signal: AbortSignal.timeout(2000) });
            service.latencyMs = Date.now() - t0;
            service.health = res.ok ? 'HEALTHY' : 'DEGRADED';
            service.lastHeartbeat = new Date().toISOString();
          } catch {
            service.health = 'DEGRADED';
          }
        }
      } else if (service.serviceId === 'gateway-001') {
        service.health = 'HEALTHY';
        service.lastHeartbeat = new Date().toISOString();
        service.latencyMs = 1;
      }
    }

    return this.getAll();
  }
}

export const serviceRegistry = new ServiceRegistry();
