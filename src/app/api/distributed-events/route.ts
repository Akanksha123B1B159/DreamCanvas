import { NextRequest } from 'next/server';
import Redis from 'ioredis';
import { getEvents, services, subscribeToEvents } from '@/app/_libs/distributed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      getEvents().forEach(send);
      const unsubscribe = subscribeToEvents(send);
      let subscriber: Redis | undefined;
      try {
        subscriber = new Redis(services.redis, { lazyConnect: true, maxRetriesPerRequest: 1 });
        await subscriber.connect();
        await subscriber.subscribe('dreamcanvas:events');
        subscriber.on('message', (_channel, value) => send(JSON.parse(value)));
      } catch {
        subscriber?.disconnect();
      }
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(': keep-alive\n\n')), 15000);
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
        subscriber?.disconnect();
        controller.close();
      });
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
