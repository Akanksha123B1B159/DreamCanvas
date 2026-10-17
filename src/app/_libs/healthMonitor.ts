export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
export type HealthEventType = HealthStatus | 'TIMEOUT' | 'RECOVERED' | 'RESTORED';

export type HealthProbeResult = {
  status: HealthStatus;
  responseTimeMs?: number | null;
  uptimeSeconds?: number;
  lastError?: string | null;
};

export type HealthCheck = {
  serviceId: string;
  serviceName: string;
  failureMessage?: string;
  check: (signal: AbortSignal) => Promise<HealthProbeResult>;
};

export type ServiceHealth = {
  serviceId: string;
  serviceName: string;
  status: HealthStatus;
  lastHeartbeat: string | null;
  checkedAt: string | null;
  responseTimeMs: number | null;
  failureCount: number;
  lastError: string | null;
  uptimeSeconds: number | null;
  simulated: boolean;
};

export type HealthHistoryEvent = {
  id: number;
  serviceId: string;
  serviceName: string;
  event: HealthEventType;
  status: HealthStatus;
  timestamp: string;
  responseTimeMs: number | null;
  detail: string | null;
};

type ServiceState = ServiceHealth & {
  consecutiveFailures: number;
};

type ProbeOutcome =
  | { kind: 'result'; result: HealthProbeResult; responseTimeMs: number }
  | { kind: 'timeout'; responseTimeMs: number }
  | { kind: 'error'; error: string; responseTimeMs: number };

export class HeartbeatHealthMonitor {
  private readonly states = new Map<string, ServiceState>();
  private readonly checks = new Map<string, HealthCheck>();
  private readonly simulatedFailures = new Set<string>();
  private readonly history: HealthHistoryEvent[] = [];
  private nextEventId = 1;

  constructor(
    private readonly failureThreshold = 2,
    private readonly historyLimit = 100,
  ) {}

  async checkAll(checks: HealthCheck[], timeoutMs: number): Promise<ServiceHealth[]> {
    checks.forEach((check) => this.checks.set(check.serviceId, check));
    await Promise.all(checks.map((check) => this.checkOne(check, timeoutMs)));
    return checks.map((check) => this.getService(check.serviceId)!);
  }

  getServices(): ServiceHealth[] {
    return [...this.states.values()].map((state) => this.toServiceHealth(state));
  }

  getHistory(limit = 50): HealthHistoryEvent[] {
    if (limit <= 0) return [];
    return this.history.slice(-Math.max(0, limit)).reverse();
  }

  isSimulated(serviceId: string): boolean {
    return this.simulatedFailures.has(serviceId);
  }

  simulateFailure(serviceId: string): boolean {
    const check = this.checks.get(serviceId);
    if (!check) return false;
    if (this.simulatedFailures.has(serviceId)) return true;

    const current = this.states.get(serviceId) ?? this.createUnknownState(check);
    const now = new Date().toISOString();
    const detail = 'Simulated heartbeat timeout in development/demo mode.';

    this.simulatedFailures.add(serviceId);
    current.status = 'DEGRADED';
    current.checkedAt = now;
    current.responseTimeMs = null;
    current.failureCount += 1;
    current.consecutiveFailures = 1;
    current.lastError = detail;
    current.simulated = true;
    this.recordEvent(current, 'TIMEOUT', detail);

    current.status = 'DOWN';
    current.failureCount += 1;
    current.consecutiveFailures = this.failureThreshold;
    this.recordEvent(current, 'DOWN', detail);
    this.states.set(serviceId, current);
    return true;
  }

  restoreService(serviceId: string): boolean {
    const check = this.checks.get(serviceId);
    if (!check) return false;
    const wasSimulated = this.simulatedFailures.delete(serviceId);
    if (!wasSimulated) return true;

    const current = this.states.get(serviceId) ?? this.createUnknownState(check);
    current.status = 'UNKNOWN';
    current.checkedAt = new Date().toISOString();
    current.responseTimeMs = null;
    current.consecutiveFailures = 0;
    current.lastError = 'Simulation cleared; waiting for the next real health check.';
    current.simulated = false;
    this.states.set(serviceId, current);
    this.recordEvent(current, 'RESTORED', current.lastError);
    return true;
  }

  private async checkOne(check: HealthCheck, timeoutMs: number): Promise<void> {
    if (this.simulatedFailures.has(check.serviceId)) return;

    const current = this.states.get(check.serviceId) ?? this.createUnknownState(check);
    const previousStatus = current.status;
    const outcome = await this.runWithTimeout(check, timeoutMs);
    const checkedAt = new Date().toISOString();
    current.checkedAt = checkedAt;

    if (outcome.kind === 'result') {
      const result = outcome.result;
      current.status = result.status;
      current.responseTimeMs = result.responseTimeMs ?? outcome.responseTimeMs;
      current.uptimeSeconds = result.uptimeSeconds ?? current.uptimeSeconds;
      current.lastError = result.lastError ?? null;

      if (result.status === 'HEALTHY' || result.status === 'DEGRADED') {
        current.lastHeartbeat = checkedAt;
        current.consecutiveFailures = 0;
        if (result.status === 'DEGRADED') current.failureCount += 1;
      } else if (result.status === 'DOWN') {
        current.failureCount += 1;
        current.consecutiveFailures += 1;
        if (current.consecutiveFailures < this.failureThreshold) current.status = 'DEGRADED';
      }

      const event: HealthEventType = current.status === 'HEALTHY' && previousStatus !== 'HEALTHY'
        ? previousStatus === 'DOWN' || previousStatus === 'DEGRADED'
          ? 'RECOVERED'
          : 'HEALTHY'
        : current.status;
      this.recordEvent(current, event, current.lastError);
    } else {
      current.failureCount += 1;
      current.consecutiveFailures += 1;
      current.responseTimeMs = outcome.responseTimeMs;
      current.lastError = outcome.kind === 'timeout'
        ? 'Health check timed out.'
        : check.failureMessage ?? outcome.error;
      current.status = current.consecutiveFailures >= this.failureThreshold ? 'DOWN' : 'DEGRADED';
      const event: HealthEventType = current.status === 'DOWN'
        ? 'DOWN'
        : outcome.kind === 'timeout'
          ? 'TIMEOUT'
          : 'DEGRADED';
      this.recordEvent(current, event, current.lastError);
    }

    current.simulated = false;
    this.states.set(check.serviceId, current);
  }

  private async runWithTimeout(check: HealthCheck, timeoutMs: number): Promise<ProbeOutcome> {
    const controller = new AbortController();
    const startedAt = Date.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        check.check(controller.signal).then((value) => ({
          kind: 'result' as const,
          result: value,
          responseTimeMs: Date.now() - startedAt,
        })),
        new Promise<ProbeOutcome>((resolve) => {
          timeout = setTimeout(() => {
            controller.abort();
            resolve({ kind: 'timeout', responseTimeMs: Date.now() - startedAt });
          }, timeoutMs);
        }),
      ]);
      return result;
    } catch (error) {
      return {
        kind: 'error',
        error: error instanceof Error ? error.message : 'Health check failed with an unknown error.',
        responseTimeMs: Date.now() - startedAt,
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private createUnknownState(check: HealthCheck): ServiceState {
    return {
      serviceId: check.serviceId,
      serviceName: check.serviceName,
      status: 'UNKNOWN',
      lastHeartbeat: null,
      checkedAt: null,
      responseTimeMs: null,
      failureCount: 0,
      lastError: 'No health check has completed yet.',
      uptimeSeconds: null,
      simulated: false,
      consecutiveFailures: 0,
    };
  }

  private getService(serviceId: string): ServiceHealth | undefined {
    const state = this.states.get(serviceId);
    return state ? this.toServiceHealth(state) : undefined;
  }

  private toServiceHealth(state: ServiceState): ServiceHealth {
    return {
      serviceId: state.serviceId,
      serviceName: state.serviceName,
      status: state.status,
      lastHeartbeat: state.lastHeartbeat,
      checkedAt: state.checkedAt,
      responseTimeMs: state.responseTimeMs,
      failureCount: state.failureCount,
      lastError: state.lastError,
      uptimeSeconds: state.uptimeSeconds,
      simulated: state.simulated,
    };
  }

  private recordEvent(state: ServiceState, event: HealthEventType, detail: string | null): void {
    this.history.push({
      id: this.nextEventId++,
      serviceId: state.serviceId,
      serviceName: state.serviceName,
      event,
      status: state.status,
      timestamp: state.checkedAt ?? new Date().toISOString(),
      responseTimeMs: state.responseTimeMs,
      detail,
    });
    if (this.history.length > this.historyLimit) this.history.splice(0, this.history.length - this.historyLimit);
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const heartbeatIntervalSeconds = positiveInteger(process.env.HEARTBEAT_INTERVAL, 10);
export const heartbeatTimeoutMs = positiveInteger(process.env.HEARTBEAT_TIMEOUT, 4) * 1000;
export const heartbeatFailureThreshold = positiveInteger(process.env.HEARTBEAT_FAILURE_THRESHOLD, 2);
export const heartbeatHealthMonitor = new HeartbeatHealthMonitor(heartbeatFailureThreshold);
