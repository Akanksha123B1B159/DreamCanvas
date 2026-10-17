export interface ClockNode {
  id: string;
  name: string;
  offsetSeconds: number; // Skew from reference in seconds
  driftRatePpm: number;  // Drift in parts per million
  isMaster?: boolean;
}

export interface SyncResult {
  algorithm: 'Berkeley' | 'Cristian';
  roundTripTimeMs?: number;
  timeBeforeSync: Record<string, string>;
  timeAfterSync: Record<string, string>;
  adjustmentsSeconds: Record<string, number>;
  synchronizedTime: string;
  explanation: string;
}

export class ClockSyncEngine {
  private nodes: ClockNode[] = [
    { id: 'node-a', name: 'Node A (Frontend)', offsetSeconds: 3, driftRatePpm: 12, isMaster: true },
    { id: 'node-b', name: 'Node B (ML Worker)', offsetSeconds: 8, driftRatePpm: -8 },
    { id: 'node-c', name: 'Node C (Redis Node)', offsetSeconds: -2, driftRatePpm: 25 },
    { id: 'node-d', name: 'Node D (Database)', offsetSeconds: 5, driftRatePpm: -15 },
  ];

  public getNodes(): ClockNode[] {
    return this.nodes.map((n) => ({ ...n }));
  }

  public updateNodeOffset(id: string, offset: number) {
    const node = this.nodes.find((n) => n.id === id);
    if (node) node.offsetSeconds = offset;
  }

  public runBerkeleySync(baseEpochMs = Date.now()): SyncResult {
    const timeBeforeSync: Record<string, string> = {};
    const adjustmentsSeconds: Record<string, number> = {};
    const timeAfterSync: Record<string, string> = {};

    // Calculate simulated local time for each node
    this.nodes.forEach((node) => {
      const localTime = new Date(baseEpochMs + node.offsetSeconds * 1000);
      timeBeforeSync[node.id] = localTime.toTimeString().split(' ')[0];
    });

    // In Berkeley algorithm: Master polls all slave nodes for their offsets
    const master = this.nodes.find((n) => n.isMaster) || this.nodes[0];
    const totalOffset = this.nodes.reduce((acc, n) => acc + n.offsetSeconds, 0);
    const averageOffset = Math.round(totalOffset / this.nodes.length);

    // Compute adjustment for each node: adjustment = average - current
    this.nodes.forEach((node) => {
      const adjustment = averageOffset - node.offsetSeconds;
      adjustmentsSeconds[node.id] = adjustment;
      // New offset after adjustment equals averageOffset
      node.offsetSeconds = averageOffset;
      const syncedTime = new Date(baseEpochMs + averageOffset * 1000);
      timeAfterSync[node.id] = syncedTime.toTimeString().split(' ')[0];
    });

    const synchronizedTime = new Date(baseEpochMs + averageOffset * 1000).toTimeString().split(' ')[0];

    return {
      algorithm: 'Berkeley',
      timeBeforeSync,
      timeAfterSync,
      adjustmentsSeconds,
      synchronizedTime,
      explanation: `Berkeley Algorithm: Master (${master.name}) polled all nodes, calculated average offset (${averageOffset}s), and distributed delta adjustments to eliminate drift across the distributed cluster.`,
    };
  }

  public runCristianSync(roundTripMs = 40, baseEpochMs = Date.now()): SyncResult {
    const timeServerTime = new Date(baseEpochMs);
    const client = this.nodes.find((n) => !n.isMaster) || this.nodes[1];
    const timeBefore = new Date(baseEpochMs + client.offsetSeconds * 1000);

    // Cristian's formula: T_client = T_server + (RTT / 2)
    const correctedEpoch = baseEpochMs + Math.floor(roundTripMs / 2);
    const timeAfter = new Date(correctedEpoch);

    client.offsetSeconds = 0;

    return {
      algorithm: 'Cristian',
      roundTripTimeMs: roundTripMs,
      timeBeforeSync: {
        [client.id]: timeBefore.toTimeString().split(' ')[0],
        server: timeServerTime.toTimeString().split(' ')[0],
      },
      timeAfterSync: {
        [client.id]: timeAfter.toTimeString().split(' ')[0],
        server: timeServerTime.toTimeString().split(' ')[0],
      },
      adjustmentsSeconds: {
        [client.id]: -client.offsetSeconds,
      },
      synchronizedTime: timeAfter.toTimeString().split(' ')[0],
      explanation: `Cristian's Algorithm: Client polled time server with RTT = ${roundTripMs}ms. Estimated one-way network latency = ${roundTripMs / 2}ms. Clock adjusted to ServerTime + RTT/2.`,
    };
  }
}

export const clockSyncEngine = new ClockSyncEngine();
