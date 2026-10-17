import { randomUUID } from 'crypto';

export interface JsonRpcRequest<T = Record<string, unknown>> {
  jsonrpc: '2.0';
  method: string;
  params: T;
  id: string;
  requestId: string;
  timestamp: string;
}

export interface JsonRpcResponse<R = unknown> {
  jsonrpc: '2.0';
  id: string;
  requestId: string;
  method?: string;
  result?: R;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  latencyMs?: number;
}

export interface RpcClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class RpcClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private initialBackoffMs: number;

  constructor(options: RpcClientOptions = {}) {
    this.baseUrl = options.baseUrl || (process.env.JOB_DETECTION_URL || 'http://localhost:8000');
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
    this.initialBackoffMs = options.initialBackoffMs ?? 200;
  }

  public async call<P extends Record<string, unknown>, R>(
    endpoint: string,
    method: string,
    params: P,
    customTimeoutMs?: number
  ): Promise<JsonRpcResponse<R>> {
    const requestId = randomUUID();
    const startTime = Date.now();
    const timeout = customTimeoutMs ?? this.timeoutMs;

    const payload: JsonRpcRequest<P> = {
      jsonrpc: '2.0',
      method,
      params,
      id: requestId,
      requestId,
      timestamp: new Date().toISOString(),
    };

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(errorBody.detail || `HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const latencyMs = Date.now() - startTime;

        return {
          jsonrpc: '2.0',
          id: data.id || requestId,
          requestId,
          method,
          result: (data.result !== undefined ? data.result : data) as R,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          latencyMs,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt <= this.maxRetries) {
          const delay = this.initialBackoffMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      jsonrpc: '2.0',
      id: requestId,
      requestId,
      method,
      error: {
        code: -32603,
        message: lastError ? lastError.message : 'Internal RPC error',
      },
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      latencyMs,
    };
  }
}

export const defaultRpcClient = new RpcClient();
