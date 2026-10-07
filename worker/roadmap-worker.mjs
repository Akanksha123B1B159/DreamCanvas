import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const frontend = process.env.FRONTEND_URL || 'http://frontend:3000';
const events = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

async function publish(event) {
  await events.publish('dreamcanvas:events', JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
}

for (;;) {
  const result = await redis.brpop('dreamcanvas:roadmap:jobs', 0);
  const message = JSON.parse(result[1]);
  const { jobId } = message.payload;
  await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({ jobId, status: 'RUNNING', messageId: message.messageId }));
  await publish({ eventId: crypto.randomUUID(), service: 'frontend', type: 'WORKER_STARTED', logicalClock: Date.now(), jobId });
  try {
    await publish({ eventId: crypto.randomUUID(), service: 'groq', type: 'ROADMAP_GENERATION_STARTED', logicalClock: Date.now(), jobId });
    const response = await fetch(`${frontend}/api/generate-roadmap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: message.payload.skills, role: message.payload.role }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Roadmap generation failed');
    await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({ jobId, status: 'COMPLETED', result: data }));
    await publish({ eventId: crypto.randomUUID(), service: 'database', type: 'ROADMAP_COMPLETED', logicalClock: Date.now(), jobId });
  } catch (error) {
    await redis.set(`dreamcanvas:job:${jobId}`, JSON.stringify({ jobId, status: 'FAILED', error: error.message }));
    await publish({ eventId: crypto.randomUUID(), service: 'frontend', type: 'WORKER_FAILED', logicalClock: Date.now(), jobId });
  }
}
