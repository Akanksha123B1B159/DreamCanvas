import { NextRequest, NextResponse } from 'next/server';
import { auditLedger } from '@/services/ledger/auditLedger';

export const runtime = 'nodejs';

export async function GET() {
  const chain = auditLedger.getChain();
  const verification = auditLedger.verifyLedger();

  return NextResponse.json({
    chain,
    verification,
    blockCount: chain.length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const { action, event = 'USER_AUDIT_LOG', data = {}, blockIndex = 1 } = body;

  if (action === 'add') {
    const newBlock = auditLedger.addBlock(event, data);
    return NextResponse.json({ success: true, block: newBlock, verification: auditLedger.verifyLedger() });
  }

  if (action === 'verify') {
    const verification = auditLedger.verifyLedger();
    return NextResponse.json({ success: true, verification });
  }

  if (action === 'tamper') {
    auditLedger.simulateTampering(blockIndex, data);
    const verification = auditLedger.verifyLedger();
    return NextResponse.json({
      success: true,
      message: `Simulated tampering applied to Block #${blockIndex}. Run Verify to observe cryptographic detection.`,
      verification,
    });
  }

  if (action === 'repair') {
    auditLedger.repairLedger();
    return NextResponse.json({
      success: true,
      message: 'Ledger restored and cryptographic hashes recalculated.',
      verification: auditLedger.verifyLedger(),
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
