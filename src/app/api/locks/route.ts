import { NextRequest, NextResponse } from 'next/server';
import { distributedLockManager } from '@/services/synchronization/distributedLock';
import { messageBroker } from '@/services/messaging/messageBroker';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource') || 'roadmap-generation';
  const state = await distributedLockManager.getLockState(resource);
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const { action, resource = 'roadmap-generation', requestedBy = 'Node-A', token, ttlMs = 8000 } = body;

  if (action === 'acquire') {
    const result = await distributedLockManager.acquireLock(resource, requestedBy, ttlMs);
    if (result.success) {
      await messageBroker.publish(
        'LOCK_ACQUIRED',
        requestedBy,
        { resource, ttlMs, token: result.token?.slice(0, 8) }
      );
    }
    return NextResponse.json(result);
  }

  if (action === 'release') {
    if (!token) return NextResponse.json({ error: 'Lock token required to release' }, { status: 400 });
    const result = await distributedLockManager.releaseLock(resource, token);
    await messageBroker.publish(
      'LOCK_RELEASED',
      'LockManager',
      { resource, result }
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid action. Use acquire or release' }, { status: 400 });
}
