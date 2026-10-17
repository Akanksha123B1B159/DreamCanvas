'use client';

import React, { useState, useEffect } from 'react';
import { Blocks, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, Plus, RotateCcw } from 'lucide-react';
import { AuditBlock, VerificationResult } from '@/services/ledger/auditLedger';

export default function LedgerVisualizer() {
  const [blocks, setBlocks] = useState<AuditBlock[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      setBlocks(data.chain);
      setVerification(data.verification);
    } catch {}
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const data = await res.json();
      setVerification(data.verification);
      setStatusMsg(data.verification.isValid ? 'Ledger cryptographically intact.' : data.verification.errorReason);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleTamper = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tamper',
          blockIndex: 1,
          data: { targetRole: 'HACKED ADMIN ROLE', salary: '$999,999' },
        }),
      });
      const data = await res.json();
      setStatusMsg(data.message);
      fetchLedger();
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair' }),
      });
      const data = await res.json();
      setStatusMsg(data.message);
      fetchLedger();
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async () => {
    setLoading(true);
    try {
      await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          event: 'MILESTONE_COMPLETED_AUDIT',
          data: { studentId: 'student-401', topicCompleted: 'Distributed Systems Unit 4' },
        }),
      });
      fetchLedger();
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
            <Blocks className="w-5 h-5 text-emerald-400" />
            Blockchain & Distributed Ledger Technologies (Audit Chain)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable SHA-256 chained ledger logging milestone audits with cryptographic tamper detection
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddBlock}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Append Block
          </button>

          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-lg shadow-blue-500/20"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Verify Ledger
          </button>

          <button
            onClick={handleTamper}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 text-xs font-semibold border border-rose-500/40 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Simulate Tampering
          </button>

          <button
            onClick={handleRepair}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Repair
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            verification.isValid
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {verification.isValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span className="font-semibold">
              {verification.isValid
                ? 'All SHA-256 Block Hashes Validated · Immutability Intact'
                : `CRYPTOGRAPHIC INTEGRITY BROKEN: ${verification.errorReason}`}
            </span>
          </div>

          <span className="font-mono text-slate-400">Total Blocks: {verification.totalBlocks}</span>
        </div>
      )}

      {statusMsg && (
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
          {statusMsg}
        </div>
      )}

      {/* Blocks Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blocks.map((b) => (
          <div
            key={b.index}
            className={`p-5 rounded-2xl bg-slate-950/80 border transition ${
              verification && !verification.isValid && verification.brokenBlockIndex === b.index
                ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-950/20'
                : 'border-slate-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">BLOCK #{b.index}</span>
                <h4 className="font-semibold text-white text-xs mt-0.5">{b.event}</h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Nonce: {b.nonce}</span>
            </div>

            <div className="mt-3 p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-300">
              <pre className="whitespace-pre-wrap">{JSON.stringify(b.data, null, 2)}</pre>
            </div>

            <div className="mt-3 space-y-1.5 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block">Previous Hash:</span>
                <span className="text-slate-400 truncate block">{b.previousHash}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Block Hash:</span>
                <span className="text-cyan-400 truncate block font-bold">{b.hash}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
