import { LamportClockSimulator } from '../src/services/synchronization/lamportClock';
import { VectorClockSimulator } from '../src/services/synchronization/vectorClock';
import { BullyElectionSimulator } from '../src/services/synchronization/bullyElection';
import { DistributedLockManager } from '../src/services/synchronization/distributedLock';
import { HeartbeatBeaconMonitor } from '../src/services/synchronization/heartbeatBeacon';
import { CircuitBreaker } from '../src/services/faultTolerance/circuitBreaker';
import { DistributedAuditLedger } from '../src/services/ledger/auditLedger';
import { MapReduceEngine } from '../src/services/mapreduce/mapReduceEngine';
import { RpcClient } from '../src/services/rpc/rpcClient';

describe('DreamCanvas Distributed Systems Test Suite', () => {
  // 1. Lamport Logical Clock
  describe('Lamport Logical Clock', () => {
    it('should increment clock by 1 on local event', () => {
      const sim = new LamportClockSimulator();
      sim.reset();
      const initialClockA = sim.getClocks().A;
      const event = sim.triggerInternalEvent('A', 'User login');
      expect(event.timestamp).toBe(initialClockA + 1);
      expect(sim.getClocks().A).toBe(initialClockA + 1);
    });

    it('should enforce L = max(L_receiver, L_msg) + 1 on message reception', () => {
      const sim = new LamportClockSimulator();
      sim.reset();
      // Force Node A to clock 5
      sim.triggerInternalEvent('A');
      sim.triggerInternalEvent('A');
      sim.triggerInternalEvent('A');
      const sendEvent = sim.triggerSendEvent('A', 'B', 'Dispatch job');
      // Node B is currently at lower clock
      const receiveEvent = sim.triggerReceiveEvent('B');

      expect(receiveEvent).not.toBeNull();
      expect(receiveEvent!.timestamp).toBeGreaterThan(sendEvent.timestamp);
      expect(receiveEvent!.timestamp).toBe(Math.max(sim.getClocks().B - 1, sendEvent.timestamp) + 1);
    });
  });

  // 2. Vector Clock & Concurrency Detection
  describe('Vector Clock Engine', () => {
    it('should correctly update vector timestamps on send and receive', () => {
      const vSim = new VectorClockSimulator();
      vSim.reset();
      const ev1 = vSim.triggerLocalEvent('A', 'Local compute');
      expect(ev1.vector[0]).toBe(1);

      vSim.triggerSendEvent('A', 'B', 'Job message');
      const rec = vSim.triggerReceiveEvent('B');
      expect(rec).not.toBeNull();
      // B should reflect A's causality and increment its own index
      expect(rec!.vector[0]).toBeGreaterThanOrEqual(1);
      expect(rec!.vector[1]).toBeGreaterThanOrEqual(1);
    });

    it('should identify concurrent events when neither dominates', () => {
      const v1: [number, number, number] = [2, 0, 0];
      const v2: [number, number, number] = [0, 1, 0];
      const rel = VectorClockSimulator.compareVectors(v1, v2);
      expect(rel).toBe('CONCURRENT');
    });

    it('should identify causal precedence (A < B)', () => {
      const v1: [number, number, number] = [1, 0, 0];
      const v2: [number, number, number] = [2, 1, 0];
      const rel = VectorClockSimulator.compareVectors(v1, v2);
      expect(rel).toBe('PRECEDES');
    });
  });

  // 3. Bully Leader Election
  describe('Bully Leader Election Algorithm', () => {
    it('should fail leader and elect highest alive node as coordinator', () => {
      const bully = new BullyElectionSimulator();
      const failed = bully.failLeader();
      expect(failed.failedNodeId).toBe(5);

      const electionResult = bully.runElection(3);
      expect(electionResult.newLeaderId).toBe(4);
      expect(electionResult.messages.some((m) => m.type === 'COORDINATOR')).toBe(true);

      const leader = bully.getCurrentLeader();
      expect(leader?.id).toBe(4);
    });
  });

  // 4. Distributed Mutual Exclusion Lock
  describe('Distributed Mutual Exclusion', () => {
    it('should acquire lock for first process and reject concurrent contender', async () => {
      const lockMgr = new DistributedLockManager();
      const res1 = await lockMgr.acquireLock('test-resource', 'Worker-1', 5000);
      expect(res1.success).toBe(true);
      expect(res1.token).toBeDefined();

      // Second process attempts to acquire same resource
      const res2 = await lockMgr.acquireLock('test-resource', 'Worker-2', 5000);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('locked');

      // Release first lock
      const releaseRes = await lockMgr.releaseLock('test-resource', res1.token!);
      expect(releaseRes.success).toBe(true);

      const stateAfter = await lockMgr.getLockState('test-resource');
      // Worker-2 should now be eligible or promoted
      expect(stateAfter.lockHolder).not.toBe('Worker-1');
    });
  });

  // 5. Heartbeat & Beacon Lease Decay
  describe('Heartbeat Beacon Protocol', () => {
    it('should record heartbeats as healthy and degrade when lease expires', () => {
      const beaconMonitor = new HeartbeatBeaconMonitor();
      beaconMonitor.recordHeartbeat('ml-srv');
      const beacons = beaconMonitor.getBeacons();
      const mlBeacon = beacons.find((b) => b.serviceId === 'ml-srv');
      expect(mlBeacon?.status).toBe('HEALTHY');

      // Simulate lease drop
      beaconMonitor.simulateHeartbeatLoss('ml-srv');
      const degradedBeacons = beaconMonitor.getBeacons();
      const degradedMl = degradedBeacons.find((b) => b.serviceId === 'ml-srv');
      expect(degradedMl?.status).toBe('FAILED');
    });
  });

  // 6. Fault Tolerance & Circuit Breaker
  describe('Circuit Breaker Fault Tolerance', () => {
    it('should trip to OPEN after failure threshold is breached and return fallback', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
        serviceName: 'Test-ML-Service',
      });

      // 1st failure
      await breaker.execute(
        () => Promise.reject(new Error('Downstream connection timeout')),
        () => 'fallback-result'
      );
      expect(breaker.getStats().state).toBe('CLOSED');

      // 2nd failure -> reaches threshold
      const exec2 = await breaker.execute(
        () => Promise.reject(new Error('Downstream connection timeout')),
        () => 'fallback-result'
      );
      expect(breaker.getStats().state).toBe('OPEN');
      expect(exec2.fromFallback).toBe(true);
      expect(exec2.data).toBe('fallback-result');

      // 3rd call: Circuit is OPEN, should fast-fail without calling failing operation
      let attemptedOperation = false;
      const exec3 = await breaker.execute(
        async () => {
          attemptedOperation = true;
          return 'real-data';
        },
        () => 'cached-fallback'
      );
      expect(attemptedOperation).toBe(false); // Did not execute! Fast failed
      expect(exec3.fromFallback).toBe(true);
      expect(exec3.data).toBe('cached-fallback');
    });
  });

  // 7. Blockchain / Cryptographic Audit Ledger
  describe('Distributed Audit Ledger (Blockchain)', () => {
    it('should create chained SHA-256 blocks and pass verification', () => {
      const ledger = new DistributedAuditLedger();
      const block1 = ledger.addBlock('TEST_EVENT_1', { status: 'passed' });
      expect(block1.index).toBeGreaterThanOrEqual(1);
      expect(block1.previousHash).toBeDefined();

      const verification = ledger.verifyLedger();
      expect(verification.isValid).toBe(true);
      expect(verification.brokenBlockIndex).toBeNull();
    });

    it('should detect data tampering when an existing block payload is modified', () => {
      const ledger = new DistributedAuditLedger();
      ledger.simulateTampering(1, { tampered: true });
      const verification = ledger.verifyLedger();
      expect(verification.isValid).toBe(false);
      expect(verification.brokenBlockIndex).toBe(1);
    });
  });

  // 8. MapReduce Computation Engine
  describe('Hadoop MapReduce Engine', () => {
    it('should correctly Map tokens and Reduce word frequencies', () => {
      const engine = new MapReduceEngine();
      const testInput = ['React', 'Docker', 'React', 'TypeScript', 'Docker', 'React'];
      const trace = engine.runJob(testInput);

      expect(trace.inputSize).toBe(6);
      expect(trace.mapOutput.length).toBe(6);

      const reactRecord = trace.reduceOutput.find((r) => r.key === 'React');
      const dockerRecord = trace.reduceOutput.find((r) => r.key === 'Docker');

      expect(reactRecord?.totalCount).toBe(3);
      expect(dockerRecord?.totalCount).toBe(2);
    });
  });

  // 9. RPC Client Timeout & Structure
  describe('JSON-RPC 2.0 Client', () => {
    it('should structure JSON-RPC 2.0 requests with correlation ID', async () => {
      const client = new RpcClient({ timeoutMs: 1000, maxRetries: 0 });
      // Call non-existent port to test error handling and format
      const response = await client.call('http://127.0.0.1:59999/rpc', 'testMethod', { foo: 'bar' });
      expect(response.jsonrpc).toBe('2.0');
      expect(response.requestId).toBeDefined();
      expect(response.status).toBe('ERROR');
      expect(response.error).toBeDefined();
    });
  });
});
