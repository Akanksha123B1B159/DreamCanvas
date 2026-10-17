import { NextRequest } from 'next/server';
import { messageBroker, BrokerMessage } from '@/services/messaging/messageBroker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (eventType: string, data: unknown) => {
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {}
      };

      // 1. Initial greeting and recent message replay
      sendEvent('connected', {
        timestamp: new Date().toISOString(),
        stream: 'DreamCanvas Real-Time SSE Stream',
      });

      const recents = await messageBroker.getRecentMessages(10);
      recents.forEach((msg) => sendEvent('message', msg));

      // 2. Subscribe to new broker messages
      const unsubscribe = messageBroker.subscribe('*', (msg: BrokerMessage) => {
        sendEvent('message', msg);
      });

      // 3. Keep-alive heartbeat every 10 seconds
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 10000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
