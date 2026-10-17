'use client';

import React, { useState } from 'react';
import { Database, ShieldCheck, Scale, Check } from 'lucide-react';

interface DbProfile {
  name: string;
  category: 'CA' | 'CP' | 'AP' | 'PACELC';
  consistency: string;
  availability: string;
  partitionTolerance: string;
  latency: string;
  transactions: string;
  dreamCanvasUsage: string;
}

export default function CapTheoremVisualizer() {
  const [selectedDb, setSelectedDb] = useState<'postgres' | 'mongodb' | 'redis' | 'dsql'>('postgres');

  const databases: Record<string, DbProfile> = {
    postgres: {
      name: 'PostgreSQL / Supabase',
      category: 'CA',
      consistency: 'Strong (ACID guarantees, serializable isolation)',
      availability: 'High (Single primary with standby read-replicas)',
      partitionTolerance: 'Sacrifices P across WAN splits in favor of strict correctness',
      latency: 'Low-to-Moderate (Disk write + WAL journaling ~10-40ms)',
      transactions: 'Full Multi-Table ACID Transactions',
      dreamCanvasUsage: 'Primary persistence for user auth, 30-day roadmaps, streaks, badges, and audit tables.',
    },
    mongodb: {
      name: 'MongoDB (Document Store)',
      category: 'CP',
      consistency: 'Configurable (Strong when readConcern="majority", writeConcern="majority")',
      availability: 'Temporarily blocked during primary replica set elections (~5-12s)',
      partitionTolerance: 'High (Automatic sharding and replica set failover)',
      latency: 'Low (In-memory document cache ~5-15ms)',
      transactions: 'Multi-document transactions supported since v4.0',
      dreamCanvasUsage: 'Ideal for unstructured career profiles and variable resume schema storage.',
    },
    redis: {
      name: 'Redis In-Memory Key-Value',
      category: 'AP',
      consistency: 'Eventual (Asynchronous master-replica replication)',
      availability: 'Ultra High (In-memory operations proceed during partitions)',
      partitionTolerance: 'High (Redis Sentinel & Cluster gossip protocol)',
      latency: 'Sub-millisecond (RAM-based ~0.5-3ms)',
      transactions: 'MULTI / EXEC optimistic locking with WATCH',
      dreamCanvasUsage: 'Message broker, job queue, pub/sub event broadcasting, and distributed mutual exclusion locks.',
    },
    dsql: {
      name: 'Distributed SQL (CockroachDB / Spanner)',
      category: 'PACELC',
      consistency: 'Strict Serializability via Multi-Raft Consensus',
      availability: '99.999% High Availability with multi-region failover',
      partitionTolerance: 'Resilient to zone and region partition losses',
      latency: 'Consensus Roundtrip Latency (~30-80ms for cross-region Raft)',
      transactions: 'Globally Distributed ACID Transactions',
      dreamCanvasUsage: 'Enterprise scale multi-region DreamCanvas deployments requiring zero-downtime geo-replication.',
    },
  };

  const active = databases[selectedDb];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            Distributed Database Trade-offs &amp; CAP Theorem
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Eric Brewer&apos;s CAP Theorem: In a distributed data store, you can only guarantee two out of Consistency, Availability, and Partition Tolerance
          </p>
        </div>
      </div>

      {/* CAP Triangle Visual Diagram */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30">
            <h3 className="font-bold text-blue-400 text-sm">Consistency (C)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Every read receives the most recent write or an error. All nodes see identical data simultaneously.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <h3 className="font-bold text-emerald-400 text-sm">Availability (A)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Every non-failing node returns a response for every request without guarantee of containing the latest write.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30">
            <h3 className="font-bold text-purple-400 text-sm">Partition Tolerance (P)</h3>
            <p className="text-xs text-slate-400 mt-1">
              The system continues to operate despite arbitrary network dropped or delayed messages between nodes.
            </p>
          </div>
        </div>
      </div>

      {/* Database Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { id: 'postgres', label: 'PostgreSQL (CA)' },
            { id: 'mongodb', label: 'MongoDB (CP)' },
            { id: 'redis', label: 'Redis (AP)' },
            { id: 'dsql', label: 'Distributed SQL' },
          ] as const
        ).map((db) => (
          <button
            key={db.id}
            onClick={() => setSelectedDb(db.id)}
            className={`p-3 rounded-xl border text-xs font-semibold transition text-left ${
              selectedDb === db.id
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {db.label}
          </button>
        ))}
      </div>

      {/* Database Profile Card */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" /> {active.name}
          </h3>
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            CAP Category: {active.category}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Consistency Model:</span>
            <p className="text-slate-200">{active.consistency}</p>
          </div>

          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Availability Guarantee:</span>
            <p className="text-slate-200">{active.availability}</p>
          </div>

          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Partition Tolerance Behavior:</span>
            <p className="text-slate-200">{active.partitionTolerance}</p>
          </div>

          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Transactions & Isolation:</span>
            <p className="text-slate-200">{active.transactions}</p>
          </div>
        </div>

        <div className="p-4 bg-indigo-950/20 rounded-xl border border-indigo-500/20 text-xs text-indigo-200">
          <span className="font-semibold block mb-1">DreamCanvas Architecture Context:</span>
          {active.dreamCanvasUsage}
        </div>
      </div>
    </div>
  );
}
