'use client';

import React, { useState } from 'react';
import { Database, Play, CheckCircle2, ArrowRight } from 'lucide-react';
import { mapReduceEngine, MapReduceExecutionTrace } from '@/services/mapreduce/mapReduceEngine';

export default function MapReduceVisualizer() {
  const [trace, setTrace] = useState<MapReduceExecutionTrace | null>(() => mapReduceEngine.runJob());
  const [activeTab, setActiveTab] = useState<'reduce' | 'shuffle' | 'map' | 'input'>('reduce');

  const runJob = () => {
    const res = mapReduceEngine.runJob();
    setTrace(res);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            Apache Hadoop & MapReduce Paradigm Simulation
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Map (token $\to$ 1) $\to$ Shuffle &amp; Partition $\to$ Reduce ($\sum$) on DreamCanvas career skill datasets
          </p>
        </div>

        <button
          onClick={runJob}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-sm transition shadow-lg shadow-amber-500/20"
        >
          <Play className="w-4 h-4" />
          Execute MapReduce Job
        </button>
      </div>

      {trace && (
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Execution Metrics: Input Size {trace.inputSize} tokens</h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
              Execution Time: {trace.executionTimeMs} ms
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            {trace.explanation}
          </p>

          {/* Phase Tabs */}
          <div className="flex border-b border-slate-800 gap-4 text-xs font-medium">
            {(
              [
                { id: 'reduce', label: '1. Reduce Output (Final Frequencies)' },
                { id: 'shuffle', label: '2. Shuffle & Partition Phase' },
                { id: 'map', label: '3. Map Output Pairs' },
                { id: 'input', label: '4. Raw Input Tokens' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`pb-2.5 transition border-b-2 font-mono ${
                  activeTab === t.id
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          {activeTab === 'reduce' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {trace.reduceOutput.map((item) => (
                <div
                  key={item.key}
                  className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{item.key}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.reducerId}</span>
                  </div>
                  <span className="font-mono text-amber-400 text-base font-bold bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                    {item.totalCount}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shuffle' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {trace.shuffleOutput.map((group) => (
                <div key={group.key} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="text-cyan-300 font-bold">{group.key}</span>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Bucketed: [{group.values.join(', ')}]
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {trace.mapOutput.map((m, idx) => (
                <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono flex justify-between">
                  <span className="text-slate-300">{m.key}</span>
                  <span className="text-amber-400 font-bold">({m.key}, 1)</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'input' && (
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed">
              {trace.rawInput.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
