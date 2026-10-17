'use client';

import React, { useState } from 'react';
import { GitBranch, Send, RotateCcw, ArrowRight } from 'lucide-react';
import { vectorClockSimulator, VectorClockSimulator, VectorEvent, ProcessId, VectorTime, CausalRelation } from '@/services/synchronization/vectorClock';

export default function VectorClockVisualizer() {
  const [vectors, setVectors] = useState(vectorClockSimulator.getVectors());
  const [events, setEvents] = useState<VectorEvent[]>(vectorClockSimulator.getEvents());

  const [compareIdx1, setCompareIdx1] = useState(0);
  const [compareIdx2, setCompareIdx2] = useState(1);
  const [relationResult, setRelationResult] = useState<CausalRelation | null>(null);

  const refresh = () => {
    setVectors(vectorClockSimulator.getVectors());
    setEvents(vectorClockSimulator.getEvents());
  };

  const handleLocal = (p: ProcessId) => {
    vectorClockSimulator.triggerLocalEvent(p, `Local operation at Node ${p}`);
    refresh();
  };

  const handleSend = (from: ProcessId, to: ProcessId) => {
    vectorClockSimulator.triggerSendEvent(from, to, `Message from ${from}`);
    refresh();
  };

  const handleReceive = (to: ProcessId) => {
    vectorClockSimulator.triggerReceiveEvent(to);
    refresh();
  };

  const handleReset = () => {
    vectorClockSimulator.reset();
    refresh();
    setRelationResult(null);
  };

  const compareSelectedEvents = () => {
    if (events[compareIdx1] && events[compareIdx2]) {
      const res = VectorClockSimulator.compareVectors(events[compareIdx1].vector, events[compareIdx2].vector);
      setRelationResult(res);
    }
  };

  const formatVector = (v: VectorTime) => `[${v[0]}, ${v[1]}, ${v[2]}]`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            Vector Clocks (Causality & Concurrency Detection)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detects causal dependencies (<code className="text-emerald-300">A &lt; B</code>) and concurrent executions (<code className="text-purple-300">A ∥ C</code>)
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Vectors
        </button>
      </div>

      {/* Vector Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map((proc, idx) => (
          <div key={proc} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-white text-base">Node {proc}</h4>
                <p className="text-[11px] text-slate-500 font-mono">Process index: {idx}</p>
              </div>
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block font-mono">Vector Clock</span>
                <span className="text-lg font-bold font-mono text-indigo-300">{formatVector(vectors[proc])}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleLocal(proc)}
                className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium transition text-left px-3"
              >
                + Local Event (V[{idx}]++)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSend(proc, proc === 'A' ? 'B' : proc === 'B' ? 'C' : 'A')}
                  className="py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" /> Send
                </button>

                <button
                  onClick={() => handleReceive(proc)}
                  className="py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition flex items-center justify-center gap-1"
                >
                  <ArrowRight className="w-3 h-3" /> Receive
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vector Comparison & Concurrency Analyzer */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Causal Relationship & Concurrency Analyzer</h3>
        
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={compareIdx1}
            onChange={(e) => setCompareIdx1(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200"
          >
            {events.map((e, idx) => (
              <option key={e.id} value={idx}>
                #{idx + 1} [{e.process}] {formatVector(e.vector)} - {e.label}
              </option>
            ))}
          </select>

          <span className="text-slate-500 font-mono text-xs">vs</span>

          <select
            value={compareIdx2}
            onChange={(e) => setCompareIdx2(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200"
          >
            {events.map((e, idx) => (
              <option key={e.id} value={idx}>
                #{idx + 1} [{e.process}] {formatVector(e.vector)} - {e.label}
              </option>
            ))}
          </select>

          <button
            onClick={compareSelectedEvents}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            Compare Causal Order
          </button>
        </div>

        {relationResult && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            {relationResult === 'PRECEDES' && (
              <span className="text-emerald-400 font-bold">
                Event 1 &lt; Event 2 (Event 1 causally happened before Event 2)
              </span>
            )}
            {relationResult === 'SUCCEEDS' && (
              <span className="text-blue-400 font-bold">
                Event 1 &gt; Event 2 (Event 2 causally happened before Event 1)
              </span>
            )}
            {relationResult === 'CONCURRENT' && (
              <span className="text-purple-400 font-bold">
                Event 1 ∥ Event 2 (CONCURRENT EVENTS: Neither causally influenced the other)
              </span>
            )}
            {relationResult === 'EQUAL' && <span className="text-slate-400 font-bold">Identical Vector Timestamps</span>}
          </div>
        )}
      </div>
    </div>
  );
}
