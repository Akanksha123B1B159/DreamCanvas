'use client';

import React, { useState, useEffect } from 'react';
import { Server, Database, Cpu, Globe, Shield, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowDown } from 'lucide-react';

interface ServiceInfo {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  endpoint: string;
  health: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  latencyMs: number;
  responsibility: string;
  version?: string;
}

export default function ArchitectureDiagram() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.services) {
        setServices(data.services);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 15000);
    return () => clearInterval(timer);
  }, []);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> DEGRADED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            Distributed System Architecture Topology
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time topology map of DreamCanvas multi-tier distributed microservices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Last checked: {lastRefreshed || 'Just now'}</span>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Health
          </button>
        </div>
      </div>

      {/* Visual Interactive Diagram */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col items-center space-y-6 max-w-4xl mx-auto">
          {/* Tier 1: User Browser */}
          <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-cyan-950/60 border border-cyan-500/30 text-center shadow-lg">
            <div className="flex items-center justify-center gap-2 font-semibold text-cyan-300 text-sm">
              <Globe className="w-4 h-4" /> Tier 1: Client Layer (Web Browser)
            </div>
            <p className="text-xs text-slate-400 mt-1">
              React 19 SPA · Local Storage · WebRTC Media & DataChannels · SSE Listener
            </p>
          </div>

          <ArrowDown className="w-6 h-6 text-slate-600 animate-bounce" />

          {/* Tier 2: Next.js Gateway & Middleware */}
          <div className="w-full max-w-xl p-5 rounded-xl bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-500/40 text-center shadow-xl">
            <div className="flex items-center justify-center gap-2 font-bold text-emerald-300 text-base">
              <Server className="w-5 h-5" /> Tier 2: API Gateway & Middleware Layer (Next.js 16)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-slate-300">
              <div className="p-2 bg-slate-900/80 rounded border border-slate-700/60">
                <span className="text-emerald-400 font-mono">Edge Middleware</span>
                <p className="text-[10px] text-slate-400">Session Auth & Route Guard</p>
              </div>
              <div className="p-2 bg-slate-900/80 rounded border border-slate-700/60">
                <span className="text-cyan-400 font-mono">JSON-RPC 2.0 Proxy</span>
                <p className="text-[10px] text-slate-400">Retries & Correlation IDs</p>
              </div>
              <div className="p-2 bg-slate-900/80 rounded border border-slate-700/60">
                <span className="text-purple-400 font-mono">Circuit Breaker</span>
                <p className="text-[10px] text-slate-400">Fast-Fail & Graceful Fallback</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl flex justify-around">
            <ArrowDown className="w-6 h-6 text-slate-600" />
            <ArrowDown className="w-6 h-6 text-slate-600" />
            <ArrowDown className="w-6 h-6 text-slate-600" />
          </div>

          {/* Tier 3: Distributed Microservices */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* AI Service */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
                  <Cpu className="w-4 h-4" /> AI Cloud Service
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">GROQ LLM</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                30-day adaptive roadmap generation, explainable career coach chatbot.
              </p>
              <div className="mt-3 text-[11px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded">
                REST / HTTPS · qwen3.6-27b
              </div>
            </div>

            {/* FastAPI ML Service */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                  <Shield className="w-4 h-4" /> Job Detection ML
                </div>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">FastAPI</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                BERT + SVM job fraud classification served via JSON-RPC 2.0 protocol.
              </p>
              <div className="mt-3 text-[11px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded">
                POST /rpc/predict-job · Port 8000
              </div>
            </div>

            {/* Redis Broker */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-rose-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                  <Server className="w-4 h-4" /> Redis Message Broker
                </div>
                <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded">Redis 7</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Asynchronous task queues, Pub/Sub event bus, DLQ, and distributed mutual exclusion locks.
              </p>
              <div className="mt-3 text-[11px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded">
                TCP redis://localhost:6379
              </div>
            </div>
          </div>

          <ArrowDown className="w-6 h-6 text-slate-600" />

          {/* Tier 4: Persistence Tier */}
          <div className="w-full max-w-xl p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/60 border border-indigo-500/30 text-center shadow-lg">
            <div className="flex items-center justify-center gap-2 font-semibold text-indigo-300 text-sm">
              <Database className="w-4 h-4" /> Tier 4: Data & State Persistence (PostgreSQL + Supabase)
            </div>
            <p className="text-xs text-slate-400 mt-1">
              ACID Relational Storage · User Profiles · Roadmaps · Streaks · Badges · Chained Audit Ledger
            </p>
          </div>
        </div>
      </div>

      {/* Service Health Directory Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Registered Distributed Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div key={svc.serviceId} className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">{svc.serviceName}</h4>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {svc.serviceId}</p>
                </div>
                {getHealthBadge(svc.health)}
              </div>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">{svc.responsibility}</p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500 truncate max-w-[180px]">{svc.endpoint}</span>
                <span className="font-mono text-cyan-400">{svc.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Explanation Section */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-400" />
          Distributed Systems Syllabus: Architectural Foundations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <h4 className="font-semibold text-emerald-300">1. Client-Server & 3-Tier Architecture</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              DreamCanvas separates concerns across Presentation (Next.js/React SPA), Application/Business Logic (Next.js API layer + FastAPI ML services), and Data Tier (Supabase PostgreSQL + Redis). This ensures loose coupling, independent scalability, and security isolation.
            </p>
          </div>

          <div className="space-y-2 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <h4 className="font-semibold text-cyan-300">2. Middleware & Transparent Communication</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              The Next.js API layer acts as distributed middleware providing location transparency, authentication enforcement via Supabase JWT session middleware, correlation ID tagging (`X-Request-Id`), and RPC proxying with automatic retry backoff.
            </p>
          </div>

          <div className="space-y-2 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <h4 className="font-semibold text-purple-300">3. Distributed Computation & Asynchrony</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Long-running AI roadmap generation and batch job checks are decoupled from client HTTP cycles. Heavy computations are pushed onto a Redis FIFO queue and consumed by dedicated worker daemons, maintaining low interactive latency.
            </p>
          </div>

          <div className="space-y-2 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <h4 className="font-semibold text-amber-300">4. Fault Tolerance & Cloud Virtualization</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Services are containerized with Docker and orchestrated using Kubernetes manifests (`k8s/`). Fault resilience is guaranteed via Circuit Breakers, healthcheck probes, exponential backoff retries, and fallback heuristic engines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
