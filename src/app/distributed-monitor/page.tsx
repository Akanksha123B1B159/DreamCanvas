'use client';

import { useEffect, useState } from 'react';

type Event = { eventId: string; service: string; type: string; timestamp: string; logicalClock: number; jobId?: string };

export default function DistributedMonitorPage() {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    const source = new EventSource('/api/distributed-events');
    source.onmessage = (message) => setEvents((current) => [JSON.parse(message.data), ...current].slice(0, 100));
    return () => source.close();
  }, []);
  return <main className="min-h-screen bg-[#0d1117] px-6 py-10 text-white"><div className="mx-auto max-w-5xl"><p className="text-sm uppercase tracking-[0.25em] text-emerald-400">Distributed computation</p><h1 className="mt-3 text-4xl font-bold">System event monitor</h1><p className="mt-2 text-slate-400">Live SSE feed of requests, queue messages, RPC calls, and worker stages.</p><div className="mt-8 overflow-hidden rounded-2xl border border-slate-800"><div className="grid grid-cols-[1fr_1fr_100px] gap-4 border-b border-slate-800 bg-slate-900 px-5 py-3 text-xs uppercase text-slate-500"><span>Event</span><span>Service</span><span>Clock</span></div>{events.length === 0 ? <p className="p-8 text-slate-500">Waiting for distributed events...</p> : events.map((event) => <div key={event.eventId} className="grid grid-cols-[1fr_1fr_100px] gap-4 border-b border-slate-800/70 px-5 py-4 text-sm"><div><p className="font-medium text-white">{event.type}</p><p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</p></div><span className="text-emerald-300">{event.service}</span><span className="font-mono text-cyan-300">L{event.logicalClock}</span></div>)}</div></div></main>;
}
