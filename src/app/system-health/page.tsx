'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CircleX,
  Clock3,
  Database,
  HeartPulse,
  RefreshCw,
  RotateCcw,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { HealthHistoryEvent, ServiceHealth } from '@/app/_libs/healthMonitor';

type HealthSnapshot = {
  services: ServiceHealth[];
  history: HealthHistoryEvent[];
  checkedAt: string;
  config: {
    heartbeatIntervalSeconds: number;
    timeoutMs: number;
    failureThreshold: number;
  };
  simulationEnabled: boolean;
};

const statusStyles: Record<ServiceHealth['status'], string> = {
  HEALTHY: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  DEGRADED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  DOWN: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  UNKNOWN: 'border-slate-600 bg-slate-800/70 text-slate-300',
};

function StatusIcon({ status }: { status: ServiceHealth['status'] }) {
  if (status === 'HEALTHY') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'DEGRADED') return <CircleAlert className="h-4 w-4" />;
  if (status === 'DOWN') return <CircleX className="h-4 w-4" />;
  return <CircleHelp className="h-4 w-4" />;
}

function formatAgo(timestamp: string | null): string {
  if (!timestamp) return 'No successful heartbeat yet';
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return 'Invalid heartbeat timestamp';
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function formatClock(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function serviceIcon(serviceId: string) {
  if (serviceId === 'database') return Database;
  if (serviceId === 'ai-service' || serviceId === 'groq-ai') return Bot;
  if (serviceId === 'redis') return Activity;
  if (serviceId === 'roadmap-worker') return HeartPulse;
  return Server;
}

export default function SystemHealthPage() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(10_000);
  const [checking, setChecking] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setChecking(true);
    try {
      const response = await fetch('/api/system-health', { cache: 'no-store' });
      setLastPollAt(Date.now());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load system health.');
      setSnapshot(data as HealthSnapshot);
      setPollIntervalMs(data.config.heartbeatIntervalSeconds * 1000);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'System health request failed.');
    } finally {
      requestInFlight.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let pollInFlight = false;

    const poll = async () => {
      if (stopped || pollInFlight) return;
      pollInFlight = true;
      await refresh();
      pollInFlight = false;
      if (!stopped) timer = window.setTimeout(() => void poll(), pollIntervalMs);
    };

    const pollWhenVisible = () => {
      if (document.visibilityState !== 'visible' || pollInFlight) return;
      if (timer !== undefined) window.clearTimeout(timer);
      void poll();
    };

    void poll();
    document.addEventListener('visibilitychange', pollWhenVisible);
    window.addEventListener('focus', pollWhenVisible);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', pollWhenVisible);
      window.removeEventListener('focus', pollWhenVisible);
    };
  }, [pollIntervalMs, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const runDemoAction = async (action: 'simulate' | 'restore') => {
    setActionBusy(true);
    try {
      const response = await fetch('/api/system-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serviceId: 'ai-service' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update the demo failure state.');
      setSnapshot(data as HealthSnapshot);
      setLastPollAt(Date.now());
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Demo action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const statuses = snapshot?.services.map((service) => service.status) ?? [];
  const overallStatus: ServiceHealth['status'] = statuses.includes('DOWN')
    ? 'DOWN'
    : statuses.includes('DEGRADED')
      ? 'DEGRADED'
      : statuses.length > 0 && statuses.every((status) => status === 'HEALTHY')
        ? 'HEALTHY'
        : statuses.length > 0 && statuses.every((status) => status === 'UNKNOWN' || status === 'HEALTHY')
          ? 'UNKNOWN'
          : 'DEGRADED';
  const secondsUntilNextCheck = lastPollAt === null
    ? null
    : Math.max(0, Math.ceil((lastPollAt + pollIntervalMs - clockNow) / 1000));

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#07111b] via-[#0d1724] to-[#062c2b] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-emerald-300">
              <ArrowLeft className="h-4 w-4" /> DreamCanvas home
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                <HeartPulse className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Operations · Beacon Protocol</p>
                <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">DreamCanvas System Health</h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Live checks against the running app, AI services, configured database, Redis, and worker heartbeat.
              Each refresh sends real probes; unavailable or unconfigured dependencies are reported honestly.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs font-medium text-emerald-300 sm:inline-flex">
              <span className={`h-2 w-2 rounded-full bg-emerald-400 ${checking ? 'animate-ping' : 'animate-pulse'}`} />
              AUTO-CHECK {checking ? 'CHECKING' : 'ON'}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${statusStyles[overallStatus]}`}>
              <StatusIcon status={overallStatus} /> SYSTEM {overallStatus}
            </span>
            <button
              onClick={() => void refresh()}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-emerald-400/50 hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Check now
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section aria-label="Monitored services" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot?.services.map((service) => {
            const Icon = serviceIcon(service.serviceId);
            const isAiService = service.serviceId === 'ai-service';
            return (
              <article key={service.serviceId} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-white">{service.serviceName}</h2>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{service.serviceId}</p>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusStyles[service.status]}`}>
                    <StatusIcon status={service.status} /> {service.status}
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/5 pt-4 text-xs">
                  <div>
                    <dt className="text-slate-500">Last heartbeat</dt>
                    <dd className="mt-1 text-slate-200">{formatAgo(service.lastHeartbeat)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Response time</dt>
                    <dd className="mt-1 font-mono text-slate-200">{service.responseTimeMs === null ? '—' : `${service.responseTimeMs} ms`}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Failure count</dt>
                    <dd className="mt-1 font-mono text-slate-200">{service.failureCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Uptime</dt>
                    <dd className="mt-1 text-slate-200">{service.uptimeSeconds === null ? '—' : `${Math.floor(service.uptimeSeconds / 60)}m ${service.uptimeSeconds % 60}s`}</dd>
                  </div>
                </dl>
                {service.lastError && (
                  <p className={`mt-4 rounded-lg px-3 py-2 text-xs ${service.status === 'UNKNOWN' ? 'bg-slate-900 text-slate-400' : 'bg-rose-950/40 text-rose-200'}`}>
                    {service.lastError}
                  </p>
                )}
                {isAiService && service.simulated && (
                  <p className="mt-3 text-xs font-medium text-amber-300">Demo failure is active. The real service was not stopped.</p>
                )}
                {isAiService && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                    <button
                      onClick={() => void runDemoAction('simulate')}
                      disabled={!snapshot.simulationEnabled || actionBusy || service.simulated}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <WifiOff className="h-3.5 w-3.5" /> Simulate AI Service Failure
                    </button>
                    <button
                      onClick={() => void runDemoAction('restore')}
                      disabled={!snapshot.simulationEnabled || actionBusy || !service.simulated}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore Service
                    </button>
                    {!snapshot.simulationEnabled && (
                      <p className="w-full text-[11px] text-slate-500">Simulation is only enabled in development/demo mode.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!snapshot && (
            <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
              {checking ? 'Sending first heartbeat checks…' : 'No health data is available yet. Automatic checks will retry.'}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><Activity className="h-5 w-5 text-cyan-300" /> Health History</h2>
                <p className="mt-1 text-xs text-slate-500">Most recent probe results and failure-detector transitions</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" /> Every {snapshot?.config.heartbeatIntervalSeconds ?? 10}s
              </span>
            </div>
            <div className="mt-5 divide-y divide-white/5">
              {!snapshot || snapshot.history.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Waiting for the first health check.</p>
              ) : snapshot.history.slice(0, 20).map((event) => (
                <div key={event.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <span className={`rounded-md px-2 py-1 font-mono text-[10px] font-bold ${statusStyles[event.status]}`}>{event.event}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{event.serviceName}</p>
                    {event.detail && <p className="mt-0.5 truncate text-xs text-slate-500">{event.detail}</p>}
                  </div>
                  <time className="whitespace-nowrap font-mono text-[11px] text-slate-500">{formatClock(event.timestamp)}</time>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-emerald-500/15 bg-emerald-950/20 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Wifi className="h-5 w-5 text-emerald-300" /> Failure detector</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              The dashboard polls real health endpoints every {snapshot?.config.heartbeatIntervalSeconds ?? 10} seconds.
              A missed check is logged as a timeout; after {snapshot?.config.failureThreshold ?? 2} consecutive failures, the service is marked DOWN.
              A successful response clears the failure streak and records recovery.
            </p>
            <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Demo safety</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Simulate changes only the monitor’s local status for the AI/ML service. It never stops a process or changes production infrastructure.
              </p>
            </div>
            <p className="mt-4 text-[11px] text-slate-500">
              {snapshot?.checkedAt
                ? `Last checked ${formatAgo(snapshot.checkedAt)}${secondsUntilNextCheck === null ? '' : ` · next check in ${secondsUntilNextCheck}s`}`
                : 'Waiting for checks.'}
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
