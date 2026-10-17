import { NextRequest, NextResponse } from 'next/server';
import { serviceRegistry } from '@/services/discovery/serviceRegistry';
import { mlCircuitBreaker } from '@/services/faultTolerance/circuitBreaker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const liveServices = await serviceRegistry.runLiveHealthChecks();
  const circuitStats = mlCircuitBreaker.getStats();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    services: liveServices,
    circuitBreaker: circuitStats,
    totalServices: liveServices.length,
    healthyCount: liveServices.filter((s) => s.health === 'HEALTHY').length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Request body required' }, { status: 400 });

  const { action, serviceId, simulateOutage } = body;

  if (action === 'simulateFailure') {
    const shouldFail = simulateOutage !== false;
    mlCircuitBreaker.setSimulation(shouldFail);
    serviceRegistry.updateHealth('ml-001', shouldFail ? 'FAILED' : 'HEALTHY');

    return NextResponse.json({
      success: true,
      simulationActive: shouldFail,
      message: shouldFail
        ? 'Simulated ML service failure activated. Circuit Breaker tripped to OPEN.'
        : 'Simulated failure deactivated. Circuit Breaker resetting.',
      circuitStats: mlCircuitBreaker.getStats(),
    });
  }

  if (action === 'heartbeat' && serviceId) {
    serviceRegistry.recordHeartbeat(serviceId);
    return NextResponse.json({ success: true, serviceId, timestamp: new Date().toISOString() });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
