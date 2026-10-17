'use client';

import React, { useState } from 'react';
import { Crown, ZapOff, CheckCircle2 } from 'lucide-react';
import { bullyElectionSimulator, ElectionNode, ElectionRoundResult } from '@/services/synchronization/bullyElection';

export default function LeaderElectionVisualizer() {
  const [nodes, setNodes] = useState<ElectionNode[]>(bullyElectionSimulator.getNodes());
  const [lastRound, setLastRound] = useState<ElectionRoundResult | null>(null);
  const [logMessage, setLogMessage] = useState<string | null>(null);

  const refresh = () => {
    setNodes(bullyElectionSimulator.getNodes());
  };

  const handleFailLeader = () => {
    try {
      const res = bullyElectionSimulator.failLeader();
      setLogMessage(`Leader Node ${res.failedNodeId} has crashed and is offline.`);
      refresh();
    } catch (err: unknown) {
      setLogMessage(err instanceof Error ? err.message : 'Error failing leader');
    }
  };

  const handleTriggerElection = () => {
    try {
      const result = bullyElectionSimulator.runElection(3);
      setLastRound(result);
      setLogMessage(`Election concluded. Node ${result.newLeaderId} is the new coordinator.`);
      refresh();
    } catch (err: unknown) {
      setLogMessage(err instanceof Error ? err.message : 'Error running election');
    }
  };

  const handleReviveNode = (id: number) => {
    bullyElectionSimulator.reviveNode(id);
    setLogMessage(`Node ${id} revived.`);
    refresh();
  };

  const currentLeader = nodes.find((n) => n.isLeader && n.isAlive);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Distributed Leader Election (Bully Algorithm)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate consensus and coordinator failover in high-concurrency clusters
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleFailLeader}
            disabled={!currentLeader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 text-xs font-semibold border border-rose-500/40 transition disabled:opacity-40"
          >
            <ZapOff className="w-3.5 h-3.5" /> Fail Current Leader
          </button>

          <button
            onClick={handleTriggerElection}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-lg shadow-amber-500/20"
          >
            <Crown className="w-3.5 h-3.5" /> Run Bully Election
          </button>
        </div>
      </div>

      {/* Cluster Nodes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`p-4 rounded-xl border transition ${
              node.isLeader
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
                : node.isAlive
                ? 'bg-slate-950/80 border-slate-800'
                : 'bg-rose-950/20 border-rose-900/60 opacity-60'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="font-mono text-xs text-slate-400">Node ID: {node.id}</span>
              {node.isLeader && <Crown className="w-4 h-4 text-amber-400" />}
            </div>

            <h4 className="font-bold text-white text-sm mt-1">{node.name}</h4>

            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className={`font-semibold ${node.isAlive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {node.isAlive ? 'ALIVE' : 'CRASHED'}
              </span>

              {!node.isAlive && (
                <button
                  onClick={() => handleReviveNode(node.id)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
                >
                  Revive
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {logMessage && (
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300">
          Status: {logMessage}
        </div>
      )}

      {/* Election Message Flow */}
      {lastRound && (
        <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Election Message Transmission Trace
            </h3>
            <span className="text-xs text-amber-400 font-bold font-mono">
              Elected Coordinator: Node {lastRound.newLeaderId}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            {lastRound.summary}
          </p>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {lastRound.messages.map((msg, i) => (
              <div
                key={i}
                className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 flex justify-between text-xs font-mono"
              >
                <span className="text-slate-300">
                  Node {msg.fromId} → Node {msg.toId}
                </span>
                <span
                  className={`font-bold ${
                    msg.type === 'COORDINATOR'
                      ? 'text-amber-400'
                      : msg.type === 'ANSWER'
                      ? 'text-emerald-400'
                      : 'text-cyan-400'
                  }`}
                >
                  [{msg.type}]
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
