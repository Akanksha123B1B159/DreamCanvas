import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { POST as generateRoadmap } from '@/app/api/generate-roadmap/route';
import { getEvents, getProcessLogicalTime, recordWorkflowEvent } from '@/app/_libs/distributed';
import { LamportLogicalClock } from '@/services/synchronization/lamportLogicalClock';

describe('Lamport logical clocks', () => {
  it('increments for local events and attaches the incremented time to sent messages', () => {
    const clock = new LamportLogicalClock();

    expect(clock.localEvent()).toBe(1);
    expect(clock.sendMessage()).toBe(2);
    expect(clock.current()).toBe(2);
  });

  it('updates a receiver clock using max(local, received) + 1', () => {
    const receiver = new LamportLogicalClock(5);

    expect(receiver.receiveMessage(8)).toBe(9);
    expect(receiver.current()).toBe(9);
  });

  it('rejects timestamps that cannot be represented safely', () => {
    const clock = new LamportLogicalClock(Number.MAX_SAFE_INTEGER);

    expect(() => clock.localEvent()).toThrow(RangeError);
    expect(() => new LamportLogicalClock().receiveMessage(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(() => new LamportLogicalClock().receiveMessage(-1)).toThrow(RangeError);
  });

  it('keeps state independent for different processes', () => {
    const apiProcess = new LamportLogicalClock();
    const workerProcess = new LamportLogicalClock();

    apiProcess.localEvent();
    apiProcess.localEvent();

    expect(apiProcess.current()).toBe(2);
    expect(workerProcess.current()).toBe(0);
  });

  it('does not lose increments when asynchronous callers tick concurrently', async () => {
    const clock = new LamportLogicalClock();
    const timestamps = await Promise.all(
      Array.from({ length: 250 }, async () => clock.localEvent()),
    );

    expect(clock.current()).toBe(250);
    expect(new Set(timestamps).size).toBe(250);
    expect(Math.min(...timestamps)).toBe(1);
    expect(Math.max(...timestamps)).toBe(250);
  });

  it('propagates a correlation ID through a real DevOps Engineer roadmap API request', async () => {
    const correlationId = `lamport-success-${randomUUID()}`;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              missingSkills: ['Kubernetes'],
              roadmap: [{ day: 1, topic: 'Linux', subtasks: ['Review processes'] }],
            }),
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    try {
      const request = new NextRequest('http://localhost/api/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          'x-lamport-timestamp': '8',
          'x-lamport-process': 'dreamcanvas-browser',
          'x-lamport-event': 'LEARNING_PLAN_REQUESTED',
        },
        body: JSON.stringify({
          skills: 'Linux, Docker, Git, networking',
          role: 'DevOps Engineer',
        }),
      });
      const response = await generateRoadmap(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.correlationId).toBe(correlationId);
      expect(response.headers.get('x-correlation-id')).toBe(correlationId);
      expect(Number(response.headers.get('x-lamport-timestamp'))).toBe(result.logicalTimestamp);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        'x-correlation-id': correlationId,
        'x-lamport-timestamp': expect.any(String),
      });

      const workflow = getEvents().filter((event) => event.correlationId === correlationId);
      expect(workflow.map((event) => event.type)).toEqual(expect.arrayContaining([
        'LEARNING_PLAN_REQUESTED',
        'REQUEST_RECEIVED',
        'AI_ANALYSIS_STARTED',
        'AI_REQUEST_SENT',
        'AI_ANALYSIS_COMPLETED',
        'LEARNING_PLAN_RESPONSE_SENT',
      ]));
      const requestReceived = workflow.find((event) => event.type === 'REQUEST_RECEIVED');
      expect(requestReceived?.logicalTimestamp).toBe(9);
      expect(workflow.some((event) => event.type === 'LEARNING_PLAN_SAVED')).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('records AI failure without logging a successful learning-plan save', async () => {
    const correlationId = `lamport-failure-${randomUUID()}`;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'not a roadmap' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const request = new NextRequest('http://localhost/api/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          'x-lamport-timestamp': '3',
        },
        body: JSON.stringify({ skills: 'Linux and Docker', role: 'DevOps Engineer' }),
      });
      const response = await generateRoadmap(request);
      const workflow = getEvents().filter((event) => event.correlationId === correlationId);

      expect(response.status).toBe(500);
      expect(workflow.some((event) => event.type === 'LEARNING_PLAN_FAILED' && event.status === 'FAILED')).toBe(true);
      expect(workflow.some((event) => event.type === 'LEARNING_PLAN_SAVED' && event.status === 'SUCCESS')).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('records a network failure without logging a successful learning-plan save', async () => {
    const correlationId = `lamport-network-failure-${randomUUID()}`;
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection refused'));

    try {
      const request = new NextRequest('http://localhost/api/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          'x-lamport-timestamp': '3',
        },
        body: JSON.stringify({ skills: 'Linux and Docker', role: 'DevOps Engineer' }),
      });
      const response = await generateRoadmap(request);
      const workflow = getEvents().filter((event) => event.correlationId === correlationId);

      expect(response.status).toBe(500);
      expect(workflow.some((event) => event.type === 'LEARNING_PLAN_FAILED' && event.status === 'FAILED')).toBe(true);
      expect(workflow.some((event) => event.type === 'LEARNING_PLAN_SAVED' && event.status === 'SUCCESS')).toBe(false);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('maintains independent service counters while handling interleaved requests', () => {
    const requestId = randomUUID();
    const apiProcess = `test-api-${requestId}`;
    const workerProcess = `test-worker-${requestId}`;

    const apiFirst = recordWorkflowEvent({
      service: 'frontend',
      eventName: 'API_LOCAL_EVENT',
      processName: apiProcess,
      correlationId: requestId,
      eventType: 'local',
    });
    const workerFirst = recordWorkflowEvent({
      service: 'frontend',
      eventName: 'WORKER_LOCAL_EVENT',
      processName: workerProcess,
      correlationId: requestId,
      eventType: 'local',
    });
    const apiSecond = recordWorkflowEvent({
      service: 'frontend',
      eventName: 'API_SECOND_LOCAL_EVENT',
      processName: apiProcess,
      correlationId: requestId,
      eventType: 'local',
    });

    expect(apiFirst.logicalTimestamp).toBe(1);
    expect(workerFirst.logicalTimestamp).toBe(1);
    expect(apiSecond.logicalTimestamp).toBe(2);
    expect(getProcessLogicalTime(apiProcess)).toBe(2);
    expect(getProcessLogicalTime(workerProcess)).toBe(1);
  });
});
