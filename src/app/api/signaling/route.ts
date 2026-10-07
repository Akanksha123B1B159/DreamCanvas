import { NextRequest, NextResponse } from 'next/server';

type Signal = { roomId: string; senderId: string; targetId?: string; kind: 'offer' | 'answer' | 'candidate' | 'presence'; payload?: unknown };
const rooms = new Map<string, Signal[]>();

export async function POST(req: NextRequest) {
  const signal = await req.json() as Signal;
  if (!signal.roomId || !signal.senderId || !signal.kind) return NextResponse.json({ error: 'roomId, senderId and kind are required' }, { status: 400 });
  const messages = rooms.get(signal.roomId) || [];
  messages.push(signal);
  rooms.set(signal.roomId, messages.slice(-100));
  return NextResponse.json({ accepted: true });
}

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId');
  const participantId = req.nextUrl.searchParams.get('participantId');
  if (!roomId || !participantId) return NextResponse.json({ error: 'roomId and participantId are required' }, { status: 400 });
  const messages = (rooms.get(roomId) || []).filter((message) => message.senderId !== participantId && (!message.targetId || message.targetId === participantId));
  return NextResponse.json(messages);
}
