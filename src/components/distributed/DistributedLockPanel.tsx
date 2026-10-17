'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Shield, Users } from 'lucide-react';
import { LockState } from '@/services/synchronization/distributedLock';

export default function DistributedLockPanel() {
  const [lockState, setLockState] = useState<LockState>({
    resource: 'roadmap-generation',
    isLocked: false,
    lockHolder: null,
    token: null,
    acquiredAt: null,
    expiresAt: null,
    ttlRemainingMs: 0,
    waitingQueue: [],
  });
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchLock = async () => {
    try {
      const res = await fetch('/api/locks?resource=roadmap-generation');
      const data = await res.json();
      setLockState(data);
    } catch {}
  };

  useEffect(() => {
    fetchLock();
    const interval = setInterval(fetchLock, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAcquire = async (nodeName: string) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acquire',
          resource: 'roadmap-generation',
          requestedBy: nodeName,
          ttlMs: 10000,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentToken(data.token);
        setStatusMsg(`Lock successfully acquired by ${nodeName}! Lease valid for 10s.`);
      } else {
        setStatusMsg(`Contention: ${data.error} (Held by ${data.holder}). ${nodeName} placed in waiting queue.`);
      }
      fetchLock();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Lock acquire failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!currentToken) {
      setStatusMsg('No active token available to release.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release',
          resource: 'roadmap-generation',
          token: currentToken,
        }),
      });
      const data = await res.json();
      setStatusMsg(data.message);
      setCurrentToken(null);
      fetchLock();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Lock release failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-400" />
            Distributed Mutual Exclusion (Redis Distributed Lock)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Atomic key lease with auto-expiring TTL (<code className="text-rose-300">SET key token NX PX</code>) preventing race conditions
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleAcquire('Node-A (Frontend)')}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
          >
            Acquire as Node-A
          </button>
          <button
            onClick={() => handleAcquire('Node-B (ML Worker)')}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
          >
            Acquire as Node-B
          </button>
          <button
            onClick={handleRelease}
            disabled={loading || !lockState.isLocked}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition disabled:opacity-40"
          >
            <Unlock className="w-3.5 h-3.5" /> Release Lock
          </button>
        </div>
      </div>

      {/* Lock State Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              Resource: <span className="font-mono text-cyan-300">{lockState.resource}</span>
            </h3>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                lockState.isLocked
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {lockState.isLocked ? 'STATUS: LOCKED' : 'STATUS: UNLOCKED'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Current Lock Holder:</span>
              <span className="font-semibold text-white font-mono">{lockState.lockHolder || 'None (Free)'}</span>
            </div>

            <div className="flex justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Lock Token:</span>
              <span className="font-mono text-slate-300">{lockState.token || 'None'}</span>
            </div>

            <div className="flex justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Remaining Lease Time:</span>
              <span className="font-mono text-amber-400 font-bold">
                {lockState.ttlRemainingMs > 0 ? `${(lockState.ttlRemainingMs / 1000).toFixed(1)}s` : '0s'}
              </span>
            </div>
          </div>

          {statusMsg && (
            <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              {statusMsg}
            </p>
          )}
        </div>

        {/* Wait Queue & Educational Breakdown */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            Contention & Waiting Queue
          </h3>

          {lockState.waitingQueue.length === 0 ? (
            <p className="text-xs text-slate-500 p-4 text-center bg-slate-900 rounded-xl border border-slate-800/60">
              No processes waiting. Any active node can acquire the lock immediately.
            </p>
          ) : (
            <div className="space-y-2">
              {lockState.waitingQueue.map((waiter, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between text-xs font-mono"
                >
                  <span className="text-slate-300">
                    Queue Position #{i + 1}: {waiter}
                  </span>
                  <span className="text-amber-400 font-bold">WAITING</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-400 space-y-2 border-t border-slate-800">
            <h4 className="font-semibold text-slate-300">Mutual Exclusion Paradigms</h4>
            <p>
              • <strong>Centralized:</strong> Coordinator grants permissions via atomic operations (used here via Redis).
            </p>
            <p>
              • <strong>Distributed (Ricart-Agrawala):</strong> Nodes broadcast timestamps; all must grant OK to enter critical section.
            </p>
            <p>
              • <strong>Token Ring:</strong> Circulating token grants permission when received by node.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
