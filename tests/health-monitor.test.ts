import {
  HeartbeatHealthMonitor,
  type HealthCheck,
  type HealthProbeResult,
} from '../src/app/_libs/healthMonitor';

const healthyResult: HealthProbeResult = {
  status: 'HEALTHY',
  responseTimeMs: 12,
  uptimeSeconds: 100,
};

function check(serviceId: string, probe: HealthCheck['check']): HealthCheck {
  return { serviceId, serviceName: `Service ${serviceId}`, check: probe };
}

describe('Real heartbeat health monitor', () => {
  it('records a healthy probe and heartbeat metadata', async () => {
    const monitor = new HeartbeatHealthMonitor();
    const [service] = await monitor.checkAll([check('api', async () => healthyResult)], 100);

    expect(service.status).toBe('HEALTHY');
    expect(service.lastHeartbeat).not.toBeNull();
    expect(service.responseTimeMs).toBe(12);
    expect(service.uptimeSeconds).toBe(100);
    expect(monitor.getHistory(1)[0].event).toBe('HEALTHY');
  });

  it('marks repeated failed probes down and counts failures', async () => {
    const monitor = new HeartbeatHealthMonitor(2);
    const failed = check('ai', async () => {
      throw new Error('Connection refused');
    });

    const [first] = await monitor.checkAll([failed], 100);
    const [second] = await monitor.checkAll([failed], 100);

    expect(first.status).toBe('DEGRADED');
    expect(second.status).toBe('DOWN');
    expect(second.failureCount).toBe(2);
    expect(second.lastError).toBe('Connection refused');
    expect(monitor.getHistory(2).map((event) => event.event)).toEqual(['DOWN', 'DEGRADED']);
  });

  it('detects a heartbeat timeout without hanging the monitor', async () => {
    const monitor = new HeartbeatHealthMonitor(2);
    const [service] = await monitor.checkAll([
      check('slow', () => new Promise<HealthProbeResult>(() => undefined)),
    ], 5);

    expect(service.status).toBe('DEGRADED');
    expect(service.lastError).toBe('Health check timed out.');
    expect(monitor.getHistory(1)[0].event).toBe('TIMEOUT');
  });

  it('recovers after a failed service returns a healthy heartbeat', async () => {
    const monitor = new HeartbeatHealthMonitor(2);
    const failed = check('ai', async () => {
      throw new Error('Connection refused');
    });
    await monitor.checkAll([failed], 100);
    await monitor.checkAll([failed], 100);

    const [recovered] = await monitor.checkAll([check('ai', async () => healthyResult)], 100);

    expect(recovered.status).toBe('HEALTHY');
    expect(recovered.lastError).toBeNull();
    expect(recovered.failureCount).toBe(2);
    expect(monitor.getHistory(1)[0].event).toBe('RECOVERED');
  });

  it('updates heartbeat timestamps on successful checks', async () => {
    const monitor = new HeartbeatHealthMonitor();
    const healthCheck = check('api', async () => healthyResult);
    const [first] = await monitor.checkAll([healthCheck], 100);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const [second] = await monitor.checkAll([healthCheck], 100);

    expect(second.lastHeartbeat).not.toBe(first.lastHeartbeat);
  });

  it('checks multiple services independently when one fails', async () => {
    const monitor = new HeartbeatHealthMonitor();
    const services = await monitor.checkAll([
      check('api', async () => healthyResult),
      check('redis', async () => {
        throw new Error('Redis unavailable');
      }),
    ], 100);

    expect(services.map((service) => service.status)).toEqual(['HEALTHY', 'DEGRADED']);
  });

  it('treats an invalid service response as a failure, not a healthy fallback', async () => {
    const monitor = new HeartbeatHealthMonitor();
    const [service] = await monitor.checkAll([
      check('invalid', async () => {
        throw new Error('Health endpoint returned an invalid response.');
      }),
    ], 100);

    expect(service.status).toBe('DEGRADED');
    expect(service.lastError).toMatch(/invalid response/);
  });

  it('simulates timeout and down transitions, then resumes real health checks on restore', async () => {
    const monitor = new HeartbeatHealthMonitor();
    const aiCheck = check('ai-service', async () => healthyResult);
    await monitor.checkAll([aiCheck], 100);

    expect(monitor.simulateFailure('ai-service')).toBe(true);
    const [down] = await monitor.checkAll([aiCheck], 100);
    expect(down.status).toBe('DOWN');
    expect(down.simulated).toBe(true);
    expect(monitor.getHistory(2).map((event) => event.event)).toEqual(['DOWN', 'TIMEOUT']);

    expect(monitor.restoreService('ai-service')).toBe(true);
    const [restored] = await monitor.checkAll([aiCheck], 100);
    expect(restored.status).toBe('HEALTHY');
    expect(restored.simulated).toBe(false);
    expect(monitor.getHistory(2).some((event) => event.event === 'RESTORED')).toBe(true);
  });
});
