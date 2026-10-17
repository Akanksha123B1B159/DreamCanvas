import { NextRequest } from 'next/server';
import Redis from 'ioredis';
import { getDistributedEventHistoryKey, getEvents, services, subscribeToEvents } from '@/app/_libs/distributed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      controller.enqueue(encoder.encode(': connected\n\n'));
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (error) {
          console.error('Could not send an event to the distributed timeline:', error);
        }
      };
      getEvents().forEach(send);
      const unsubscribe = subscribeToEvents(send);
      const subscriber = new Redis(services.redis, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 1500,
        retryStrategy: (attempt) => attempt <= 1 ? 100 : null,
      });
      subscriber.on('message', (_channel, value) => {
        try {
          send(JSON.parse(value));
        } catch (error) {
          console.error('Could not parse a distributed event from Redis:', error);
        }
      });
      const keepAlive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 15000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        subscriber.disconnect();
        try {
          controller.close();
        } catch (error) {
          console.error('Could not close the distributed event stream:', error);
        }
      };
      req.signal.addEventListener('abort', close, { once: true });

      void (async () => {
        try {
          await subscriber.connect();
          await subscriber.subscribe('dreamcanvas:events');
          const history = await subscriber.lrange(getDistributedEventHistoryKey(), 0, 499);
          history.reverse().forEach((event) => send(JSON.parse(event)));
        } catch (error) {
          console.error(
            'Distributed event stream is using process-local history because Redis is unavailable:',
            error instanceof Error ? error.message : error,
          );
          subscriber.disconnect();
        }
      })();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
