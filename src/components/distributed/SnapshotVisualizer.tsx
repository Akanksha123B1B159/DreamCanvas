'use client';

import React, { useState } from 'react';
import { Camera, CheckCircle2, MessageSquare } from 'lucide-react';
import { chandyLamportSimulator, GlobalSnapshot } from '@/services/synchronization/chandyLamport';

export default function SnapshotVisualizer() {
  const [snapshot, setSnapshot] = useState<GlobalSnapshot | null>(null);
  const [nodes] = useState(chandyLamportSimulator.getNodes());
  const [inTransit] = useState(chandyLamportSimulator.getInTransitMessages());

  const handleCapture = () => {
    const snap = chandyLamportSimulator.captureGlobalState('Node-A');
    setSnapshot(snap);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            Global State & Chandy-Lamport Snapshot Algorithm
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Capture a provably consistent distributed cut across decoupled processes and in-flight communication channels
          </p>
        </div>

        <button
          onClick={handleCapture}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-500/20"
        >
          <Camera className="w-4 h-4" />
          Capture Global State
        </button>
      </div>

      {/* Live System Nodes & In-Transit Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node States */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Distributed Process States</h3>

          <div className="space-y-3">
            {Object.values(nodes).map((node) => (
              <div key={node.processId} className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white">{node.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold ${
                      node.state === 'RUNNING'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : node.state === 'PROCESSING'
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {node.state}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans">{node.currentTask}</p>
              </div>
            ))}
          </div>
        </div>

        {/* In-Transit Channels */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            In-Transit Communication Channels (FIFO)
          </h3>

          <div className="space-y-3">
            {inTransit.map((msg) => (
              <div key={msg.id} className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-cyan-400">
                    {msg.from} → {msg.to}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">IN_TRANSIT</span>
                </div>
                <pre className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2 rounded">
                  {JSON.stringify(msg.payload)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Snapshot Results Panel */}
      {snapshot && (
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Global State Snapshot Recorded ({snapshot.snapshotId})
            </h3>
            <span className="text-xs text-emerald-400 font-mono">Consistent Cut: True</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            {snapshot.explanation}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-semibold text-xs font-sans">Frozen Node States</span>
              {Object.entries(snapshot.nodeStates).map(([id, s]) => (
                <div key={id} className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span className="text-cyan-300">{id}:</span>
                  <span className="text-emerald-400">{s.state}</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-semibold text-xs font-sans">Recorded Channel State</span>
              {snapshot.channelStates.map((msg) => (
                <div key={msg.id} className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span className="text-slate-300">{msg.id}:</span>
                  <span className="text-purple-400">Captured in flight</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
