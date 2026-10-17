import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { jsonrepair } from 'jsonrepair';
import {
  getEvents,
  groqModel,
  recordPropagatedWorkflowEvent,
  recordWorkflowEvent,
} from '@/app/_libs/distributed';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function parseRoadmapResponse(content: unknown) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty response from Groq');
  }

  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fencedMatches = [...withoutThinking.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  const candidate = fencedMatches.at(-1)?.[1] ?? withoutThinking;
  const roadmapStarts = [...candidate.matchAll(/\{\s*"missingSkills"\s*:/g)];
  const start = roadmapStarts.at(-1)?.index ?? candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('Groq response did not contain a JSON object');
  }

  return JSON.parse(jsonrepair(candidate.slice(start, end + 1)));
}

export const runtime = 'nodejs';

function workflowResponse(
  correlationId: string,
  body: Record<string, unknown>,
  statusCode: number,
  eventStatus: 'SUCCESS' | 'FAILED',
) {
  const sent = recordWorkflowEvent({
    service: 'frontend',
    eventName: 'LEARNING_PLAN_RESPONSE_SENT',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'send',
    status: eventStatus,
  });
  const response = NextResponse.json({
    ...body,
    correlationId,
    logicalTimestamp: sent.logicalTimestamp,
    events: getEvents().filter((event) => event.correlationId === correlationId),
  }, { status: statusCode });
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-lamport-timestamp', String(sent.logicalTimestamp));
  return response;
}

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || randomUUID();
  const incomingText = req.headers.get('x-lamport-timestamp');
  const parsedTimestamp = incomingText && /^\d+$/.test(incomingText) ? Number(incomingText) : undefined;
  const incomingTimestamp = parsedTimestamp !== undefined && Number.isSafeInteger(parsedTimestamp)
    ? parsedTimestamp
    : undefined;

  if (incomingTimestamp !== undefined) {
    const sourceProcess = req.headers.get('x-lamport-process') === 'roadmap-worker'
      ? 'roadmap-worker'
      : 'dreamcanvas-browser';
    recordPropagatedWorkflowEvent({
      service: 'frontend',
      eventName: req.headers.get('x-lamport-event') === 'LEARNING_PLAN_REQUESTED'
        ? 'LEARNING_PLAN_REQUESTED'
        : 'LEARNING_PLAN_REQUEST_SENT',
      processName: sourceProcess,
      correlationId,
      logicalTimestamp: incomingTimestamp,
      status: 'SUCCESS',
    });
  }

  recordWorkflowEvent({
    service: 'frontend',
    eventName: 'REQUEST_RECEIVED',
    processName: 'dreamcanvas-api',
    correlationId,
    eventType: 'receive',
    receivedTimestamp: incomingTimestamp,
  });

  try {
    const body = await req.json().catch(() => null);
    const skills = body && typeof body.skills === 'string' ? body.skills.trim() : '';
    const role = body && typeof body.role === 'string' ? body.role.trim() : '';

    if (!skills || !role) {
      recordWorkflowEvent({
        service: 'frontend',
        eventName: 'LEARNING_PLAN_FAILED',
        processName: 'dreamcanvas-api',
        correlationId,
        eventType: 'local',
        status: 'FAILED',
        error: 'Missing fields: skills or role',
      });
      return workflowResponse(correlationId, { error: 'Missing fields: skills or role' }, 400, 'FAILED');
    }

    recordWorkflowEvent({
      service: 'frontend',
      eventName: 'AI_ANALYSIS_STARTED',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'local',
    });

    const prompt = `
You are a helpful career assistant.

The user wants to become a "${role}". They currently have these skills: ${skills}.

1. Identify essential skills they are missing.
2. Build a 30-day learning roadmap.
3. For each day, include:
  - "day" (number)
  - "topic" (short descriptive title)
  - "subtasks" (2-4 bullet points)

4. Don't fail to give subtasks for each day.
Respond ONLY in JSON using this format:

{
  "missingSkills": ["skill1", "skill2"],
  "roadmap": [
    { "day": 1, "topic": "Title", "subtasks": ["task1", "task2"] }
  ]
}
Do not include markdown or explanations.
`;

    const aiRequestSent = recordWorkflowEvent({
      service: 'groq',
      eventName: 'AI_REQUEST_SENT',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'send',
      status: 'SUCCESS',
    });

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'x-lamport-timestamp': String(aiRequestSent.logicalTimestamp),
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      recordWorkflowEvent({
        service: 'groq',
        eventName: 'LEARNING_PLAN_FAILED',
        processName: 'dreamcanvas-api',
        correlationId,
        eventType: 'receive',
        receivedTimestamp: aiRequestSent.logicalTimestamp,
        status: 'FAILED',
        error: `Groq API request failed with HTTP ${response.status}`,
      });
      console.error('❌ Groq API Error:', response.status, errorText);
      return workflowResponse(
        correlationId,
        { error: 'Groq API request failed', detail: errorText },
        response.status,
        'FAILED',
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let result: { missingSkills?: unknown; roadmap?: unknown };

    try {
      result = parseRoadmapResponse(content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid response from the AI service.';
      recordWorkflowEvent({
        service: 'groq',
        eventName: 'LEARNING_PLAN_FAILED',
        processName: 'dreamcanvas-api',
        correlationId,
        eventType: 'receive',
        receivedTimestamp: aiRequestSent.logicalTimestamp,
        status: 'FAILED',
        error: detail,
      });
      console.error('❌ JSON parsing failed:', error);
      return workflowResponse(correlationId, { error: 'Invalid JSON format in LLM response' }, 500, 'FAILED');
    }

    if (!Array.isArray(result.roadmap)) {
      recordWorkflowEvent({
        service: 'groq',
        eventName: 'LEARNING_PLAN_FAILED',
        processName: 'dreamcanvas-api',
        correlationId,
        eventType: 'receive',
        receivedTimestamp: aiRequestSent.logicalTimestamp,
        status: 'FAILED',
        error: 'Response missing valid roadmap array',
      });
      return workflowResponse(correlationId, { error: 'Response missing valid roadmap array' }, 500, 'FAILED');
    }

    recordWorkflowEvent({
      service: 'groq',
      eventName: 'AI_ANALYSIS_COMPLETED',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'receive',
      receivedTimestamp: aiRequestSent.logicalTimestamp,
      status: 'SUCCESS',
    });
    return workflowResponse(correlationId, result, 200, 'SUCCESS');
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    recordWorkflowEvent({
      service: 'frontend',
      eventName: 'LEARNING_PLAN_FAILED',
      processName: 'dreamcanvas-api',
      correlationId,
      eventType: 'local',
      status: 'FAILED',
      error: detail,
    });
    console.error('❌ API error:', detail);
    return workflowResponse(correlationId, { error: 'Failed to fetch roadmap from LLaMA 3', detail }, 500, 'FAILED');
  }
}
