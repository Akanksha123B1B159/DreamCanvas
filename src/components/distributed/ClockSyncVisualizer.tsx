'use client';

import React, { useState } from 'react';
import { Clock, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { clockSyncEngine, SyncResult } from '@/services/synchronization/clockSync';

export default function ClockSyncVisualizer() {
  const [nodes, setNodes] = useState(clockSyncEngine.getNodes());
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const runBerkeley = () => {
    const res = clockSyncEngine.runBerkeleySync();
    setSyncResult(res);
    setNodes(clockSyncEngine.getNodes());
  };

  const runCristian = () => {
    const res = clockSyncEngine.runCristianSync();
    setSyncResult(res);
    setNodes(clockSyncEngine.getNodes());
  };

  const introduceDrift = () => {
    clockSyncEngine.updateNodeOffset('node-a', Math.floor(Math.random() * 8) - 4);
    clockSyncEngine.updateNodeOffset('node-b', Math.floor(Math.random() * 12) + 2);
    clockSyncEngine.updateNodeOffset('node-c', -Math.floor(Math.random() * 6) - 2);
    clockSyncEngine.updateNodeOffset('node-d', Math.floor(Math.random() * 10) - 5);
    setNodes(clockSyncEngine.getNodes());
    setSyncResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Physical Clock Synchronization (Berkeley & Cristian Algorithms)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate distributed nodes with independent oscillator drift, skew, and coordinated synchronization
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={introduceDrift}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            Introduce Random Clock Skew
          </button>
          <button
            onClick={runBerkeley}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-lg shadow-amber-500/20"
          >
            Run Berkeley Sync (Master-Slave)
          </button>
          <button
            onClick={runCristian}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-lg shadow-blue-500/20"
          >
            Run Cristian Sync (RTT Client)
          </button>
        </div>
      </div>

      {/* Nodes Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border ${
              n.isMaster ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-white text-sm">{n.name}</h4>
                <span className="text-[10px] text-slate-500 font-mono">ID: {n.id}</span>
              </div>
              {n.isMaster && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded font-mono">
                  MASTER
                </span>
              )}
            </div>

            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Offset:</span>
                <span className={`font-mono ${n.offsetSeconds !== 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                  {n.offsetSeconds > 0 ? `+${n.offsetSeconds}s` : `${n.offsetSeconds}s`}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Drift Rate:</span>
                <span className="font-mono text-slate-300">{n.driftRatePpm} ppm</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Synchronization Execution Results */}
      {syncResult && (
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {syncResult.algorithm} Algorithm Execution Results
            </h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Synchronized Time: {syncResult.synchronizedTime}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            {syncResult.explanation}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-semibold text-rose-300">Before Synchronization (Drifted)</h4>
              {Object.entries(syncResult.timeBeforeSync).map(([id, time]) => (
                <div key={id} className="flex justify-between font-mono text-slate-300">
                  <span className="text-slate-500">{id}:</span>
                  <span className="text-rose-400">{time}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-semibold text-emerald-300">After Synchronization (Aligned)</h4>
              {Object.entries(syncResult.timeAfterSync).map(([id, time]) => (
                <div key={id} className="flex justify-between font-mono text-slate-300">
                  <span className="text-slate-500">{id}:</span>
                  <span className="text-emerald-400">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
