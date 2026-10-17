'use client';

import { browserLamportClock } from './lamportLogicalClock';
import { supabase } from '@/app/_libs/supabaseClient';

export type RoadmapWorkflowEventName = 'LEARNING_PLAN_SAVED' | 'LEARNING_PLAN_FAILED';

export type RoadmapTimelineEvent = {
  eventId: string;
  service: string;
  type: string;
  timestamp: string;
  logicalClock: number;
  logicalTimestamp: number;
  processName: string;
  eventType: 'local' | 'send' | 'receive';
  correlationId?: string;
  status?: 'SUCCESS' | 'FAILED' | 'INFO';
  error?: string;
  jobId?: string;
};

const timelineStorageKey = 'lamportWorkflowEvents';
const timelineUpdateEvent = 'lamport-workflow-events-updated';

export function persistRoadmapWorkflowEvents(events: unknown): void {
  if (typeof window === 'undefined' || !Array.isArray(events)) return;

  try {
    const stored = localStorage.getItem(timelineStorageKey);
    const existing = stored ? JSON.parse(stored) as RoadmapTimelineEvent[] : [];
    const byId = new Map(existing.map((event) => [event.eventId, event]));
    for (const event of events) {
      if (
        event
        && typeof event.eventId === 'string'
        && Number.isSafeInteger(event.logicalTimestamp ?? event.logicalClock)
      ) {
        byId.set(event.eventId, event as RoadmapTimelineEvent);
      }
    }
    localStorage.setItem(timelineStorageKey, JSON.stringify([...byId.values()].slice(-500)));
    window.dispatchEvent(new Event(timelineUpdateEvent));
  } catch (error) {
    console.error('Could not save Lamport events in this browser:', error);
  }
}

export function readRoadmapWorkflowEvents(): RoadmapTimelineEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(timelineStorageKey);
    return stored ? JSON.parse(stored) as RoadmapTimelineEvent[] : [];
  } catch (error) {
    console.error('Could not read Lamport events from this browser:', error);
    return [];
  }
}

export async function reportRoadmapWorkflowEvent(
  correlationId: string,
  eventName: RoadmapWorkflowEventName,
  errorMessage?: string,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) {
    throw new Error(error?.message || 'Sign in again before recording roadmap events.');
  }

  const timestamp = browserLamportClock.sendMessage();
  const response = await fetch('/api/roadmap-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-correlation-id': correlationId,
      'x-lamport-timestamp': String(timestamp),
    },
    body: JSON.stringify({ eventName, error: errorMessage }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    persistRoadmapWorkflowEvents(body?.events);
    throw new Error(body?.error || 'Could not record the roadmap workflow event.');
  }

  const result = await response.json();
  persistRoadmapWorkflowEvents(result.events);
  const responseTimestamp = Number(response.headers.get('x-lamport-timestamp'));
  if (Number.isSafeInteger(responseTimestamp) && responseTimestamp >= 0) {
    browserLamportClock.receiveMessage(responseTimestamp);
  }
}
