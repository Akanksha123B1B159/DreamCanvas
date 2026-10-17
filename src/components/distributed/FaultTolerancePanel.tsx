'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw, ZapOff, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { CircuitState, CircuitBreakerStats } from '@/services/faultTolerance/circuitBreaker';

export default function FaultTolerancePanel() {
  const [stats, setStats] = useState<CircuitBreakerStats>({
    serviceName: 'FastAPI-ML-Job-Detection',
    state: 'CLOSED',
    failureCount: 0,
    successCount: 12,
    totalCalls: 14,
    lastFailureTime: null,
    lastStateChange: new Date().toISOString(),
    nextAttemptAllowedInMs: 0,
    isSimulationActive: false,
  });
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.circuitBreaker) {
        setStats(data.circuitBreaker);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulateFailure',
          simulateOutage: !stats.isSimulationActive,
        }),
      });
      const data = await res.json();
      if (data.circuitStats) setStats(data.circuitStats);
      setTestResult(data.message);
    } catch {
      // Local fallback
      setStats((prev) => ({
        ...prev,
        isSimulationActive: !prev.isSimulationActive,
        state: !prev.isSimulationActive ? 'OPEN' : 'HALF_OPEN',
      }));
    } finally {
      setLoading(false);
    }
  };

  const testRpcThroughBreaker = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'predictJob',
          params: { description: 'Senior Full Stack Distributed Systems Architect' },
        }),
      });
      const data = await res.json();
      setTestResult(
        data.fromFallback
          ? `[Degraded Fallback Active] Circuit State: ${data.circuitState}. Returned fallback response.`
          : `[Direct RPC Successful] Circuit State: ${data.circuitState}. ML Prediction completed.`
      );
      fetchStats();
    } catch (err: unknown) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'RPC failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: CircuitState) => {
    switch (state) {
      case 'CLOSED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'OPEN':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'HALF_OPEN':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            Circuit Breaker & Real Fault Tolerance
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Guarantees high availability through fast-failure, exponential backoff retries, and graceful degradation
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={toggleSimulation}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
              stats.isSimulationActive
                ? 'bg-rose-600/30 text-rose-300 border-rose-500/40 hover:bg-rose-600/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <ZapOff className="w-3.5 h-3.5" />
            {stats.isSimulationActive ? 'Disable Failure Simulation' : 'Simulate ML Service Failure'}
          </button>

          <button
            onClick={testRpcThroughBreaker}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-lg shadow-purple-500/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Test RPC Call
          </button>
        </div>
      </div>

      {/* State Machine Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Closed State */}
        <div
          className={`p-4 rounded-xl border transition ${
            stats.state === 'CLOSED'
              ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/40 border-slate-800/80 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-emerald-400">1. CLOSED (Normal)</span>
            {stats.state === 'CLOSED' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            All RPC requests flow directly to the FastAPI service. Failures are counted toward threshold (3).
          </p>
        </div>

        {/* Open State */}
        <div
          className={`p-4 rounded-xl border transition ${
            stats.state === 'OPEN'
              ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/30'
              : 'bg-slate-900/40 border-slate-800/80 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-rose-400">2. OPEN (Tripped)</span>
            {stats.state === 'OPEN' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Downstream failure detected. Fast-fails immediately with graceful heuristic fallback without latency.
          </p>
        </div>

        {/* Half-Open State */}
        <div
          className={`p-4 rounded-xl border transition ${
            stats.state === 'HALF_OPEN'
              ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-slate-900/40 border-slate-800/80 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-amber-400">3. HALF-OPEN (Testing)</span>
            {stats.state === 'HALF_OPEN' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Reset timeout elapsed. Sends limited probe requests to verify if ML service has self-healed.
          </p>
        </div>
      </div>

      {/* Metrics Card */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Live Circuit Breaker Metrics</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStateColor(stats.state)}`}>
            STATE: {stats.state}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Failures Recorded</span>
            <span className="font-mono text-rose-400 text-lg font-bold">{stats.failureCount} / 3</span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Successful Calls</span>
            <span className="font-mono text-emerald-400 text-lg font-bold">{stats.successCount}</span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Total Invocations</span>
            <span className="font-mono text-cyan-400 text-lg font-bold">{stats.totalCalls}</span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Simulation Active</span>
            <span className="font-mono text-purple-400 text-lg font-bold">
              {stats.isSimulationActive ? 'YES (DOWN)' : 'NO (UP)'}
            </span>
          </div>
        </div>

        {testResult && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs text-slate-200 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>{testResult}</span>
          </div>
        )}
      </div>
    </div>
  );
}
