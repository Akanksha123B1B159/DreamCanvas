'use client';

import React, { useState } from 'react';
import { Activity, Play, CheckCircle2, Radio } from 'lucide-react';

interface StreamLog {
  stage: string;
  progress: number;
  timestamp: string;
  detail: string;
}

export default function StreamVisualizer() {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState<StreamLog[]>([]);

  const runStreamSimulation = () => {
    setIsStreaming(true);
    setProgress(0);
    setStreamLogs([]);

    const stages: Array<{ progress: number; stage: string; detail: string; delay: number }> = [
      { progress: 10, stage: '0% → 10% Initializing', detail: 'Received roadmap generation RPC request. Allocating worker slot.', delay: 400 },
      { progress: 25, stage: '25% Gap Detection', detail: 'Analyzing target role vs current user skills to isolate missing modules.', delay: 1000 },
      { progress: 50, stage: '50% LLM Synthesis', detail: 'Groq LLM streaming 30-day curriculum breakdown with daily subtasks.', delay: 2000 },
      { progress: 75, stage: '75% Resource Matching', detail: 'Querying YouTube Data API for tutorials and documentation links.', delay: 1500 },
      { progress: 100, stage: '100% Complete', detail: 'Persisted to Supabase PostgreSQL database. Ready for client render.', delay: 1200 },
    ];

    let currentIdx = 0;

    const processNext = () => {
      if (currentIdx >= stages.length) {
        setIsStreaming(false);
        return;
      }

      const item = stages[currentIdx];
      setTimeout(() => {
        setProgress(item.progress);
        setCurrentStage(item.stage);
        setStreamLogs((prev) => [
          {
            stage: item.stage,
            progress: item.progress,
            timestamp: new Date().toLocaleTimeString(),
            detail: item.detail,
          },
          ...prev,
        ]);
        currentIdx++;
        processNext();
      }, item.delay);
    };

    processNext();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            Stream-Oriented Communication (Server-Sent Events)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time unidirectional stream pushing roadmap & ML processing stages without client polling
          </p>
        </div>

        <button
          onClick={runStreamSimulation}
          disabled={isStreaming}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {isStreaming ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Start Real-Time Stream
        </button>
      </div>

      {/* Progress Bar Display */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex justify-between items-center text-sm font-semibold">
          <span className="text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Current Status: <span className="text-emerald-400 font-mono">{currentStage}</span>
          </span>
          <span className="text-emerald-300 font-mono text-lg">{progress}%</span>
        </div>

        <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stages Milestones */}
        <div className="grid grid-cols-5 gap-2 pt-2 text-[11px] font-mono text-center">
          {['0% Queued', '25% Gap Check', '50% LLM Gen', '75% YouTube', '100% Ready'].map((s, idx) => (
            <div
              key={s}
              className={`p-1.5 rounded border ${
                progress >= (idx + 1) * 20 || (idx === 0 && progress >= 0)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Streamed Event Log */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">SSE Event Push Log (Continuous Connection)</h3>

        {streamLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No active stream. Click &quot;Start Real-Time Stream&quot; to begin receiving server-pushed chunk events.
          </p>
        ) : (
          <div className="space-y-2">
            {streamLogs.map((log, index) => (
              <div
                key={index}
                className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-start justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold text-white">{log.stage}</span>
                  </div>
                  <p className="text-slate-400 text-xs pl-5.5">{log.detail}</p>
                </div>
                <span className="font-mono text-slate-500 text-[11px]">{log.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
