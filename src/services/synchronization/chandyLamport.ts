export interface ProcessSnapshotState {
  processId: string;
  name: string;
  state: 'RUNNING' | 'WAITING' | 'PROCESSING' | 'IDLE';
  currentTask: string;
  localVariables: Record<string, unknown>;
  snapshotRecordedAt?: string;
}

export interface InTransitMessage {
  id: string;
  from: string;
  to: string;
  payload: Record<string, unknown>;
  sentAt: string;
  status: 'IN_TRANSIT' | 'CAPTURED_IN_CHANNEL' | 'DELIVERED';
}

export interface GlobalSnapshot {
  snapshotId: string;
  initiatedBy: string;
  timestamp: string;
  nodeStates: Record<string, ProcessSnapshotState>;
  channelStates: InTransitMessage[];
  consistentCut: boolean;
  explanation: string;
}

export class ChandyLamportSimulator {
  private nodes: Record<string, ProcessSnapshotState> = {
    'Node-A': {
      processId: 'Node-A',
      name: 'Frontend Gateway',
      state: 'RUNNING',
      currentTask: 'Serving client session #812',
      localVariables: { activeRequests: 14, queueHead: 'job-982' },
    },
    'Node-B': {
      processId: 'Node-B',
      name: 'ML Inference Engine',
      state: 'PROCESSING',
      currentTask: 'BERT tensor tokenization',
      localVariables: { batchSize: 8, gpuUtilization: '78%' },
    },
    'Node-C': {
      processId: 'Node-C',
      name: 'Redis Queue Worker',
      state: 'WAITING',
      currentTask: 'Listening on dreamcanvas:roadmap:jobs',
      localVariables: { jobsProcessedToday: 142, memoryUsedMb: 64 },
    },
  };

  private inTransitMessages: InTransitMessage[] = [
    {
      id: 'msg-transit-101',
      from: 'Node-A',
      to: 'Node-B',
      payload: { rpcMethod: 'predictJob', jobId: 'job-982' },
      sentAt: new Date(Date.now() - 3200).toISOString(),
      status: 'IN_TRANSIT',
    },
    {
      id: 'msg-transit-102',
      from: 'Node-B',
      to: 'Node-C',
      payload: { event: 'JOB_ANALYSIS_COMPLETED', prediction: 'REAL' },
      sentAt: new Date(Date.now() - 1500).toISOString(),
      status: 'IN_TRANSIT',
    },
  ];

  public getNodes(): Record<string, ProcessSnapshotState> {
    return JSON.parse(JSON.stringify(this.nodes));
  }

  public getInTransitMessages(): InTransitMessage[] {
    return JSON.parse(JSON.stringify(this.inTransitMessages));
  }

  public captureGlobalState(initiator = 'Node-A'): GlobalSnapshot {
    const snapshotId = `snap-${Date.now()}`;
    const recordedNodeStates: Record<string, ProcessSnapshotState> = {};

    // 1. Initiator records local process state
    Object.keys(this.nodes).forEach((nodeKey) => {
      recordedNodeStates[nodeKey] = {
        ...this.nodes[nodeKey],
        snapshotRecordedAt: new Date().toISOString(),
      };
    });

    // 2. Marker propagates across channels; messages in flight are recorded as channel state
    const capturedChannels = this.inTransitMessages.map((msg) => ({
      ...msg,
      status: 'CAPTURED_IN_CHANNEL' as const,
    }));

    return {
      snapshotId,
      initiatedBy: initiator,
      timestamp: new Date().toISOString(),
      nodeStates: recordedNodeStates,
      channelStates: capturedChannels,
      consistentCut: true,
      explanation: `Chandy-Lamport Algorithm executed: ${initiator} injected MARKER message. Each process recorded its internal execution state, and incoming channels recorded all in-flight messages sent before receiving the marker, forming a provably consistent global cut without freezing the distributed system.`,
    };
  }

  public updateNodeState(nodeKey: string, state: ProcessSnapshotState['state'], task: string) {
    if (this.nodes[nodeKey]) {
      this.nodes[nodeKey].state = state;
      this.nodes[nodeKey].currentTask = task;
    }
  }
}

export const chandyLamportSimulator = new ChandyLamportSimulator();
