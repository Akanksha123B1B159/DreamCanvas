export interface ServiceBeacon {
  serviceId: string;
  serviceName: string;
  role: string;
  lastHeartbeatEpoch: number;
  intervalMs: number;
  status: 'HEALTHY' | 'WARNING' | 'FAILED';
  missedBeacons: number;
  ipAddress: string;
}

export class HeartbeatBeaconMonitor {
  private beacons: Map<string, ServiceBeacon> = new Map();

  constructor() {
    this.seedDefaultBeacons();
  }

  private seedDefaultBeacons() {
    const now = Date.now();
    const defaults: ServiceBeacon[] = [
      {
        serviceId: 'ml-srv',
        serviceName: 'Job Detection ML Service',
        role: 'FastAPI Prediction Pod',
        lastHeartbeatEpoch: now - 1500, // 1.5s ago
        intervalMs: 3000,
        status: 'HEALTHY',
        missedBeacons: 0,
        ipAddress: '10.244.1.14:8000',
      },
      {
        serviceId: 'ai-srv',
        serviceName: 'AI Career Coach Engine',
        role: 'Groq Cloud Gateway',
        lastHeartbeatEpoch: now - 800, // 0.8s ago
        intervalMs: 3000,
        status: 'HEALTHY',
        missedBeacons: 0,
        ipAddress: '198.51.100.24:443',
      },
      {
        serviceId: 'redis-srv',
        serviceName: 'Redis Broker & State Node',
        role: 'In-Memory Key-Value Store',
        lastHeartbeatEpoch: now - 7200, // 7.2s ago
        intervalMs: 3000,
        status: 'WARNING',
        missedBeacons: 2,
        ipAddress: '10.244.2.8:6379',
      },
      {
        serviceId: 'worker-srv',
        serviceName: 'Roadmap Background Worker',
        role: 'Queue Consumer Daemon',
        lastHeartbeatEpoch: now - 2200, // 2.2s ago
        intervalMs: 3000,
        status: 'HEALTHY',
        missedBeacons: 0,
        ipAddress: '10.244.1.22:3000',
      },
      {
        serviceId: 'gateway-srv',
        serviceName: 'Next.js Frontend Ingress',
        role: 'Edge Reverse Proxy & SSR',
        lastHeartbeatEpoch: now - 400, // 0.4s ago
        intervalMs: 3000,
        status: 'HEALTHY',
        missedBeacons: 0,
        ipAddress: '127.0.0.1:3000',
      },
    ];

    defaults.forEach((b) => this.beacons.set(b.serviceId, b));
  }

  public getBeacons(): Array<ServiceBeacon & { elapsedSeconds: number }> {
    const now = Date.now();
    const result: Array<ServiceBeacon & { elapsedSeconds: number }> = [];

    this.beacons.forEach((b) => {
      const elapsed = Math.floor((now - b.lastHeartbeatEpoch) / 1000);

      // Recompute status according to beacon protocol lease decay:
      // <= 4s -> HEALTHY
      // 5s to 9s -> WARNING
      // >= 10s -> FAILED
      let status: ServiceBeacon['status'] = 'HEALTHY';
      let missed = 0;
      if (elapsed >= 10) {
        status = 'FAILED';
        missed = Math.floor(elapsed / 3);
      } else if (elapsed >= 5) {
        status = 'WARNING';
        missed = Math.floor(elapsed / 3);
      }

      b.status = status;
      b.missedBeacons = missed;

      result.push({
        ...b,
        elapsedSeconds: elapsed,
      });
    });

    return result;
  }

  public recordHeartbeat(serviceId: string): boolean {
    const b = this.beacons.get(serviceId);
    if (!b) return false;
    b.lastHeartbeatEpoch = Date.now();
    b.status = 'HEALTHY';
    b.missedBeacons = 0;
    return true;
  }

  public simulateHeartbeatLoss(serviceId: string) {
    const b = this.beacons.get(serviceId);
    if (b) {
      // Set to 12s ago to trigger FAILED immediately
      b.lastHeartbeatEpoch = Date.now() - 12000;
      b.status = 'FAILED';
      b.missedBeacons = 4;
    }
  }
}

export const heartbeatBeaconMonitor = new HeartbeatBeaconMonitor();
