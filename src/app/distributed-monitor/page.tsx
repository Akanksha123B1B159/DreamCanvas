'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, ArrowUpRight, Clock3, Search } from 'lucide-react';
import {
  persistRoadmapWorkflowEvents,
  readRoadmapWorkflowEvents,
} from '@/services/synchronization/roadmapWorkflowEvents';

type EventStatus = 'SUCCESS' | 'FAILED' | 'INFO';

type DistributedEvent = {
  eventId: string;
  service: string;
  type: string;
  timestamp: string;
  physicalTimestamp?: string;
  logicalClock: number;
  logicalTimestamp?: number;
  processName?: string;
  eventType?: 'local' | 'send' | 'receive';
  correlationId?: string;
  status?: EventStatus;
  error?: string;
  jobId?: string;
};

function eventTypeLabel(eventType?: DistributedEvent['eventType']): string {
  if (eventType === 'send') return 'SEND';
  if (eventType === 'receive') return 'RECEIVE';
  return 'LOCAL';
}

function eventStatusClass(status?: EventStatus): string {
  if (status === 'SUCCESS') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'FAILED') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export default function DistributedMonitorPage() {
  const [events, setEvents] = useState<DistributedEvent[]>([]);
  const [correlationFilter, setCorrelationFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('all');
  const [connectionStatus, setConnectionStatus] = useState('Starting live updates');

  useEffect(() => {
    const requestId = new URLSearchParams(window.location.search).get('requestId');
    if (requestId) setCorrelationFilter(requestId);
    setEvents(readRoadmapWorkflowEvents());

    const refreshFromStorage = () => setEvents(readRoadmapWorkflowEvents());
    window.addEventListener('storage', refreshFromStorage);
    window.addEventListener('lamport-workflow-events-updated', refreshFromStorage);

    const source = new EventSource('/api/distributed-events');
    source.onopen = () => setConnectionStatus('Live updates connected');
    source.onerror = () => setConnectionStatus('Showing saved events · live stream reconnecting');
    source.onmessage = (message) => {
      try {
        const incoming = JSON.parse(message.data) as DistributedEvent;
        if (!incoming.eventId || !Number.isSafeInteger(incoming.logicalTimestamp ?? incoming.logicalClock)) {
          console.error('Ignoring malformed distributed event:', incoming);
          return;
        }
        setEvents((current) => {
          if (current.some((event) => event.eventId === incoming.eventId)) return current;
          const next = [...current, incoming].slice(-500);
          persistRoadmapWorkflowEvents(next);
          return next;
        });
      } catch (error) {
        console.error('Could not parse distributed event:', error);
      }
    };
    return () => {
      source.close();
      window.removeEventListener('storage', refreshFromStorage);
      window.removeEventListener('lamport-workflow-events-updated', refreshFromStorage);
    };
  }, []);

  const processes = useMemo(
    () => [...new Set(events.map((event) => event.processName || event.service))].sort(),
    [events],
  );
  const visibleEvents = useMemo(() => {
    const correlationId = correlationFilter.trim().toLowerCase();
    return events
      .filter((event) => {
        const processName = event.processName || event.service;
        const matchesCorrelation = !correlationId || (event.correlationId || '').toLowerCase().includes(correlationId);
        const matchesProcess = processFilter === 'all' || processName === processFilter;
        return matchesCorrelation && matchesProcess;
      })
      .sort((left, right) => {
        const logicalDifference = (left.logicalTimestamp ?? left.logicalClock) - (right.logicalTimestamp ?? right.logicalClock);
        if (logicalDifference !== 0) return logicalDifference;
        const processDifference = (left.processName || left.service).localeCompare(right.processName || right.service);
        return processDifference || left.eventId.localeCompare(right.eventId);
      });
  }, [correlationFilter, events, processFilter]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#07111b] via-[#0d1724] to-[#062c2b] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-emerald-300">
              <ArrowLeft className="h-4 w-4" /> DreamCanvas home
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Logical clocks · Causal ordering · Live events</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Lamport Clock Monitor</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              Follow each learning-plan request as it moves between processes. See local, send, and receive events with their
              logical timestamps and request ID.
            </p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Implemented concepts">
              {['Local events', 'Message send / receive', 'Causal ordering', 'Request tracing'].map((concept) => (
                <span
                  key={concept}
                  className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1 text-[11px] font-medium text-emerald-100/80"
                >
                  {concept}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500"
            >
              Generate a plan <ArrowUpRight className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-2 self-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <Activity className="h-3.5 w-3.5" /> {connectionStatus}
            </span>
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] sm:p-5">
          <label className="relative block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Request ID</span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-500" />
            <input
              value={correlationFilter}
              onChange={(event) => setCorrelationFilter(event.target.value)}
              placeholder="Search requests"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-3 font-mono text-sm text-white outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-emerald-500/60"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Process</span>
            <select
              value={processFilter}
              onChange={(event) => setProcessFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60"
            >
              <option value="all">All processes</option>
              {processes.map((processName) => <option key={processName} value={processName}>{processName}</option>)}
            </select>
          </label>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-xl shadow-black/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-bold">Request timeline</h2>
              <p className="mt-1 text-xs text-slate-500">Events are ordered by logical time.</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-300">
              {visibleEvents.length} events
            </span>
          </div>
          {visibleEvents.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                {events.length === 0
                  ? 'No requests yet. Generate a learning plan to see its events here.'
                  : 'No requests match this filter.'}
              </p>
              {correlationFilter && (
                <button
                  type="button"
                  onClick={() => setCorrelationFilter('')}
                  className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
                >
                  Clear request filter
                </button>
              )}
            </div>
          ) : (
            <ol className="divide-y divide-white/5">
              {visibleEvents.map((event) => {
                const processName = event.processName || event.service;
                const logicalTimestamp = event.logicalTimestamp ?? event.logicalClock;
                return (
                  <li key={event.eventId} className="grid gap-3 px-4 py-4 transition hover:bg-white/[0.02] sm:grid-cols-[100px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(120px,0.7fr)] sm:items-center sm:px-6">
                    <div>
                      <span className="font-mono text-xl font-bold text-cyan-300">L{logicalTimestamp}</span>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{eventTypeLabel(event.eventType)}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold text-white">{event.type}</p>
                        {event.status && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${eventStatusClass(event.status)}`}>
                            {event.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-emerald-300">{processName}</p>
                      {event.error && <p className="mt-1 break-words text-xs text-rose-300">{event.error}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Request / correlation ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-300">{event.correlationId || event.jobId || '—'}</p>
                    </div>
                    <time className="text-xs text-slate-500 sm:text-right">
                      <span className="block text-[10px] uppercase tracking-wide">Physical time</span>
                      <span className="mt-1 block">{new Date(event.physicalTimestamp || event.timestamp).toLocaleString()}</span>
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
