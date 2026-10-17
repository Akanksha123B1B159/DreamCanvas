'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertTriangle, Shield, Play } from 'lucide-react';

export default function RpcWorkbench() {
  const [method, setMethod] = useState('predictJob');
  const [description, setDescription] = useState(
    'Urgent hiring! Earn $4,000/week working from home. No interview or qualifications required. Send personal banking details and $50 registration fee via gift card.'
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);

  const executeRpc = async () => {
    setLoading(true);
    setResponse(null);

    const payload = {
      jsonrpc: '2.0',
      method,
      params: { description },
      requestId: `req-${Date.now().toString(36)}`,
    };

    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': payload.requestId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      setResponse({
        jsonrpc: '2.0',
        error: { code: -32603, message: err instanceof Error ? err.message : 'Network failure' },
        status: 'ERROR',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            JSON-RPC 2.0 Client & Monitoring Workbench
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Test Remote Procedure Calls between Next.js Gateway and FastAPI ML Service
          </p>
        </div>
        <button
          onClick={executeRpc}
          disabled={loading || !description.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Execute RPC Call
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Configuration Panel */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-cyan-400" /> RPC Request Configuration
          </h3>

          <div>
            <label className="text-xs font-medium text-slate-400">RPC Method</label>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">
              Parameter: <code className="text-cyan-400">description</code> (Job Posting Text)
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 resize-none font-sans"
              placeholder="Enter job description..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                setDescription(
                  'Urgent hiring! Earn $4,000/week working from home. No interview or qualifications required. Send personal banking details and $50 registration fee via gift card.'
                )
              }
              className="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Preset: Suspicious/Fake Job
            </button>
            <button
              onClick={() =>
                setDescription(
                  'Senior Software Engineer at Stripe. Requirements: 5+ years of experience with distributed systems, Go, Kubernetes, and PostgreSQL. Competitive salary, healthcare, and equity.'
                )
              }
              className="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Preset: Legitimate Tech Role
            </button>
          </div>
        </div>

        {/* RPC Response & Monitoring Panel */}
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">RPC Response & Latency Inspector</h3>
            {response && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  response.status === 'SUCCESS'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {response.status === 'SUCCESS' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {String(response.status)}
              </span>
            )}
          </div>

          {response ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Method</span>
                  <span className="font-mono text-cyan-300">{String(response.method || method)}</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Latency</span>
                  <span className="font-mono text-emerald-300">
                    {response.latencyMs ? `${response.latencyMs} ms` : '< 20 ms'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Circuit State</span>
                  <span className="font-mono text-purple-300">
                    {String(response.circuitState || 'CLOSED')}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Type</span>
                  <span className="font-mono text-amber-300">
                    {response.fromFallback ? 'Fallback' : 'Direct ML'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-1">JSON-RPC 2.0 Payload:</span>
                <pre className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-56">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <Shield className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">
                Click &quot;Execute RPC Call&quot; to invoke the FastAPI ML classification endpoint.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
