'use client';

import React, { useState } from 'react';
import { GitCommit, Send, RotateCcw, ArrowRight } from 'lucide-react';
import { lamportClockSimulator, LamportEvent } from '@/services/synchronization/lamportClock';

export default function LamportVisualizer() {
  const [clocks, setClocks] = useState(lamportClockSimulator.getClocks());
  const [events, setEvents] = useState<LamportEvent[]>(lamportClockSimulator.getEvents());
  const inFlight = lamportClockSimulator.getInFlightMessages();

  const refreshState = () => {
    setClocks(lamportClockSimulator.getClocks());
    setEvents(lamportClockSimulator.getEvents());
  };

  const handleInternal = (nodeId: 'A' | 'B' | 'C') => {
    lamportClockSimulator.triggerInternalEvent(nodeId, `Local compute event at Node ${nodeId}`);
    refreshState();
  };

  const handleSend = (from: 'A' | 'B' | 'C', to: 'A' | 'B' | 'C') => {
    lamportClockSimulator.triggerSendEvent(from, to, `Send message from ${from} to ${to}`);
    refreshState();
  };

  const handleReceive = (nodeId: 'A' | 'B' | 'C') => {
    lamportClockSimulator.triggerReceiveEvent(nodeId);
    refreshState();
  };

  const handleReset = () => {
    lamportClockSimulator.reset();
    refreshState();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-cyan-400" />
            Lamport Logical Clocks (Causal Ordering)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rules: Local event: <code className="text-cyan-300">L = L + 1</code> · Receive: <code className="text-emerald-300">L = max(L_rec, L_msg) + 1</code>
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Timeline
        </button>
      </div>

      {/* Clocks Status & Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map((node) => (
          <div key={node} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-white text-base">Node {node}</h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {node === 'A' ? 'Frontend Client' : node === 'B' ? 'FastAPI ML Pod' : 'Supabase Worker'}
                </p>
              </div>
              <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block font-mono">Lamport L</span>
                <span className="text-xl font-bold font-mono text-cyan-300">{clocks[node]}</span>
              </div>
            </div>

            {/* Action Buttons for this node */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleInternal(node)}
                className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium transition text-left px-3"
              >
                + Local Event (L = L + 1)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSend(node, node === 'A' ? 'B' : node === 'B' ? 'C' : 'A')}
                  className="py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" /> Send Msg
                </button>

                <button
                  onClick={() => handleReceive(node)}
                  className="py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition flex items-center justify-center gap-1"
                >
                  <ArrowRight className="w-3 h-3" /> Receive
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Events Timeline */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Event Causality Timeline Log</h3>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg font-mono font-bold flex items-center justify-center text-xs ${
                    evt.nodeId === 'A'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : evt.nodeId === 'B'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {evt.nodeId}
                </span>

                <div>
                  <span className="font-semibold text-white">{evt.description}</span>
                  <span className="text-[11px] text-slate-500 block font-mono">Type: {evt.type}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-cyan-300 text-sm font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  L = {evt.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
