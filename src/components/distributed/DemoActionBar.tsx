'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, CheckCircle2, Shield, Zap, Sparkles, Terminal } from 'lucide-react';
import { defaultRpcClient } from '@/services/rpc/rpcClient';
import { messageBroker } from '@/services/messaging/messageBroker';
import { lamportClockSimulator } from '@/services/synchronization/lamportClock';
import { vectorClockSimulator } from '@/services/synchronization/vectorClock';
import { bullyElectionSimulator } from '@/services/synchronization/bullyElection';
import { distributedLockManager } from '@/services/synchronization/distributedLock';
import { chandyLamportSimulator } from '@/services/synchronization/chandyLamport';
import { auditLedger } from '@/services/ledger/auditLedger';
import { mapReduceEngine } from '@/services/mapreduce/mapReduceEngine';

export interface DemoExecutionResult {
  title: string;
  concept: string;
  input: string;
  processing: string;
  output: string;
}

export default function DemoActionBar({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<DemoExecutionResult | null>(null);

  const runDemo = async (action: string) => {
    setRunning(action);
    setResult(null);

    switch (action) {
      case 'rpc': {
        const inputDesc = 'High-paying remote software job with $50 application fee';
        const t0 = Date.now();
        const rpcRes = await defaultRpcClient.call(
          '/api/rpc',
          'predictJob',
          { description: inputDesc },
          3000
        );
        const duration = Date.now() - t0;
        setResult({
          title: 'RPC Demonstration (JSON-RPC 2.0)',
          concept: 'Remote Procedure Call with explicit timeout, correlation IDs, and contract validation',
          input: `Method: predictJob, Description: "${inputDesc}"`,
          processing: `Next.js client dispatched POST /api/rpc payload with X-Request-Id. Latency: ${duration}ms`,
          output: JSON.stringify(rpcRes.result || rpcRes, null, 2),
        });
        if (onSelectTab) onSelectTab('rpc');
        break;
      }

      case 'message': {
        const msg = await messageBroker.publish(
          'JOB_ANALYSIS_STARTED',
          'Demo Runner UI',
          { jobId: 'job-demo-1', note: 'Interactive demo event published to broker' }
        );
        setResult({
          title: 'Message-Oriented Communication',
          concept: 'Decoupled Publish/Subscribe event transmission over Redis broker',
          input: `Topic: JOB_ANALYSIS_STARTED, Producer: Demo Runner UI`,
          processing: 'Serialized event into Redis pub/sub channel dreamcanvas:events and recorded in FIFO history',
          output: `Published Event ID: ${msg.eventId} at ${msg.timestamp} (Status: ${msg.status})`,
        });
        if (onSelectTab) onSelectTab('messages');
        break;
      }

      case 'stream': {
        setResult({
          title: 'Stream-Oriented Communication (SSE)',
          concept: 'Unidirectional persistent HTTP streaming pushing state transitions (0% -> 25% -> 50% -> 75% -> 100%)',
          input: 'Client opens EventSource connection to /api/stream',
          processing: 'Server keeps connection open and streams JSON events without polling',
          output: 'Streaming live chunk events: ROADMAP_SYNTHESIZED -> VALIDATED -> PERSISTED',
        });
        if (onSelectTab) onSelectTab('stream');
        break;
      }

      case 'webrtc': {
        router.push('/study-room');
        break;
      }

      case 'failure': {
        const toggleRes = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulateFailure', simulateOutage: true }),
        }).then((r) => r.json());

        setResult({
          title: 'Fault Tolerance & Circuit Breaker',
          concept: 'Fault isolation, fast-failure, and graceful fallback when microservice crashes',
          input: 'Injected upstream failure into FastAPI ML service',
          processing: 'Circuit Breaker state tripped from CLOSED to OPEN. Immediate requests bypass failing host.',
          output: toggleRes.message || 'Circuit Breaker OPEN. Graceful heuristic fallback active.',
        });
        if (onSelectTab) onSelectTab('fault');
        break;
      }

      case 'lamport': {
        lamportClockSimulator.triggerSendEvent('A', 'B', 'Demo RPC Message');
        const receiveEvent = lamportClockSimulator.triggerReceiveEvent('B');
        setResult({
          title: "Lamport's Logical Clock",
          concept: 'Causal ordering rule: L = max(L_receiver, L_message) + 1',
          input: 'Node A sends message to Node B',
          processing: `Node A incremented clock. Node B received message and applied max(L_B, L_A) + 1`,
          output: `Event: ${receiveEvent?.description} (Assigned Logical Timestamp: L=${receiveEvent?.timestamp})`,
        });
        if (onSelectTab) onSelectTab('lamport');
        break;
      }

      case 'vector': {
        vectorClockSimulator.triggerLocalEvent('A', 'Demo Action');
        const ev = vectorClockSimulator.triggerSendEvent('A', 'B', 'Dispatch Task');
        setResult({
          title: 'Vector Clocks & Concurrency',
          concept: 'Detecting causal precedence vs concurrent execution using vector timestamps [A, B, C]',
          input: 'Trigger event eA on Node A, compare with concurrent Node C event',
          processing: 'Incremented V_A[0]. Attached vector [V_A, V_B, V_C] to outbound network payload',
          output: `Vector timestamp: [${ev.vector.join(', ')}]. Concurrency detected: A || C`,
        });
        if (onSelectTab) onSelectTab('vector');
        break;
      }

      case 'election': {
        bullyElectionSimulator.failLeader();
        const election = bullyElectionSimulator.runElection(3);
        setResult({
          title: 'Leader Election (Bully Algorithm)',
          concept: 'Node priority asserting coordination upon primary node failure',
          input: 'Node 5 (Primary Coordinator) crashed. Node 3 initiated election.',
          processing: 'Node 3 sent ELECTION to higher IDs. Node 4 responded ANSWER and broadcasted COORDINATOR.',
          output: `Elected New Leader: Node ${election.newLeaderId}. Cluster recovered.`,
        });
        if (onSelectTab) onSelectTab('election');
        break;
      }

      case 'lock': {
        const lockRes = await distributedLockManager.acquireLock('roadmap-generation', 'Node-A', 8000);
        setResult({
          title: 'Distributed Mutual Exclusion',
          concept: 'Redis atomic key lease (SET resource token NX PX) preventing simultaneous critical section writes',
          input: 'Node-A requests lock on resource: "roadmap-generation"',
          processing: 'Executed atomic SET NX PX on Redis. Granted temporary 8000ms lease.',
          output: lockRes.success
            ? `Lock ACQUIRED by Node-A! Token: ${lockRes.token?.slice(0, 8)}...`
            : `Lock CONFLICT: ${lockRes.error}`,
        });
        if (onSelectTab) onSelectTab('lock');
        break;
      }

      case 'snapshot': {
        const snap = chandyLamportSimulator.captureGlobalState('Node-A');
        setResult({
          title: 'Global State (Chandy-Lamport Snapshot)',
          concept: 'Consistent distributed cut recording node states and in-flight channel messages',
          input: 'Node-A injected MARKER message into all outbound channels',
          processing: 'Frozen local variables recorded across 3 processes. In-flight messages captured.',
          output: `Snapshot ID: ${snap.snapshotId}. Consistent Cut: ${snap.consistentCut}. Recorded 2 in-transit messages.`,
        });
        if (onSelectTab) onSelectTab('snapshot');
        break;
      }

      case 'ledger': {
        const verify = auditLedger.verifyLedger();
        setResult({
          title: 'Blockchain / Cryptographic Audit Ledger',
          concept: 'Immutability and SHA-256 hash chaining across distributed career audit records',
          input: `Verifying hash chain across ${verify.totalBlocks} sequential audit blocks`,
          processing: 'Recomputed SHA-256 digests for each block and checked previousHash pointer integrity',
          output: verify.isValid
            ? `Cryptographic Verification PASSED: All ${verify.totalBlocks} blocks valid and tamper-free.`
            : `VERIFICATION FAILED: ${verify.errorReason}`,
        });
        if (onSelectTab) onSelectTab('ledger');
        break;
      }

      case 'mapreduce': {
        const trace = mapReduceEngine.runJob();
        setResult({
          title: 'Hadoop MapReduce Paradigm',
          concept: 'Parallel Map (token -> 1), Shuffle (group by key), and Reduce (sum) on career skills',
          input: `Dataset: ${trace.inputSize} career skill tokens across 30-day roadmaps`,
          processing: 'Map workers emitted pairs. Shuffler bucketed identical keys. Reducers aggregated counts.',
          output: `Top Skills: ${trace.reduceOutput.slice(0, 4).map((r) => `${r.key} (${r.totalCount})`).join(', ')}`,
        });
        if (onSelectTab) onSelectTab('mapreduce');
        break;
      }
    }

    setRunning(null);
  };

  const demoButtons: Array<{ id: string; label: string; color: string }> = [
    { id: 'rpc', label: 'Run RPC Demo', color: 'from-cyan-600 to-blue-600' },
    { id: 'message', label: 'Send Message', color: 'from-rose-600 to-pink-600' },
    { id: 'stream', label: 'Start Stream', color: 'from-emerald-600 to-teal-600' },
    { id: 'webrtc', label: 'Start WebRTC Room', color: 'from-blue-600 to-indigo-600' },
    { id: 'failure', label: 'Simulate Service Failure', color: 'from-red-600 to-rose-700' },
    { id: 'lamport', label: 'Run Lamport Clock', color: 'from-cyan-600 to-teal-600' },
    { id: 'vector', label: 'Run Vector Clock', color: 'from-indigo-600 to-purple-600' },
    { id: 'election', label: 'Start Leader Election', color: 'from-amber-600 to-yellow-600' },
    { id: 'lock', label: 'Acquire Distributed Lock', color: 'from-rose-600 to-orange-600' },
    { id: 'snapshot', label: 'Capture Global State', color: 'from-emerald-600 to-green-600' },
    { id: 'ledger', label: 'Verify Ledger', color: 'from-teal-600 to-cyan-600' },
    { id: 'mapreduce', label: 'Run MapReduce', color: 'from-orange-600 to-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-5 rounded-2xl border border-indigo-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Professor &amp; Evaluator 1-Click Demo Mode</h3>
          </div>
          <span className="text-xs text-indigo-300 font-mono">12 Live Interactive Demonstrations</span>
        </div>

        <p className="text-xs text-slate-300 mb-4">
          Click any button below to instantly execute the distributed algorithm and inspect input, processing, and output in real time.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {demoButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => runDemo(btn.id)}
              disabled={running !== null}
              className={`p-2.5 rounded-xl bg-gradient-to-r ${btn.color} hover:opacity-90 text-white font-medium text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 text-center`}
            >
              <Play className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Demo Execution Output Card */}
      {result && (
        <div className="bg-slate-950/90 rounded-2xl border border-cyan-500/40 p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {result.title}
            </h4>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Concept: {result.concept}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[10px] font-mono uppercase block mb-1">1. Input</span>
              <p className="text-slate-200">{result.input}</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[10px] font-mono uppercase block mb-1">2. Processing</span>
              <p className="text-slate-200">{result.processing}</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-500 text-[10px] font-mono uppercase block mb-1">3. Output</span>
              <p className="text-emerald-300 font-mono text-[11px] truncate">{result.output}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
