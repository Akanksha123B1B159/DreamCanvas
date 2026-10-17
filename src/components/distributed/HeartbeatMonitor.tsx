'use client';

import React, { useState, useEffect } from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, ZapOff, RefreshCw } from 'lucide-react';
import { heartbeatBeaconMonitor, ServiceBeacon } from '@/services/synchronization/heartbeatBeacon';

export default function HeartbeatMonitor() {
  const [beacons, setBeacons] = useState<Array<ServiceBeacon & { elapsedSeconds: number }>>([]);

  const refresh = () => {
    setBeacons(heartbeatBeaconMonitor.getBeacons());
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleHeartbeat = (id: string) => {
    heartbeatBeaconMonitor.recordHeartbeat(id);
    refresh();
  };

  const handleSimulateLoss = (id: string) => {
    heartbeatBeaconMonitor.simulateHeartbeatLoss(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-400 animate-pulse" />
            Beacon Protocol & Heartbeat Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracks heartbeat lease expiry (&lt;5s Healthy, 5-9s Warning, &gt;=10s Failed) across independent cluster nodes
          </p>
        </div>

        <button
          onClick={() => beacons.forEach((b) => heartbeatBeaconMonitor.recordHeartbeat(b.serviceId))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-500/20"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Ping All Heartbeats
        </button>
      </div>

      {/* Heartbeat Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {beacons.map((b) => (
          <div
            key={b.serviceId}
            className={`p-5 rounded-2xl border transition ${
              b.status === 'HEALTHY'
                ? 'bg-slate-950/80 border-slate-800'
                : b.status === 'WARNING'
                ? 'bg-amber-950/30 border-amber-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-white text-sm">{b.serviceName}</h4>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{b.ipAddress}</p>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  b.status === 'HEALTHY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : b.status === 'WARNING'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {b.status === 'HEALTHY' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : b.status === 'WARNING' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {b.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Last Heartbeat:</span>
                <span className="font-mono text-cyan-300 font-semibold">{b.elapsedSeconds}s ago</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Beacon Interval:</span>
                <span className="font-mono text-slate-300">3000 ms</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Missed Beacons:</span>
                <span className="font-mono text-rose-400">{b.missedBeacons}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex gap-2">
              <button
                onClick={() => handleHeartbeat(b.serviceId)}
                className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60 transition"
              >
                Ping Heartbeat
              </button>
              <button
                onClick={() => handleSimulateLoss(b.serviceId)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs border border-rose-500/30 transition"
                title="Simulate dropped heartbeat to observe lease expiry"
              >
                <ZapOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
