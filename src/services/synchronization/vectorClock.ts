export type ProcessId = 'A' | 'B' | 'C';
export type VectorTime = [number, number, number]; // [A, B, C]

export interface VectorEvent {
  id: string;
  process: ProcessId;
  label: string;
  vector: VectorTime;
  type: 'LOCAL' | 'SEND' | 'RECEIVE';
  target?: ProcessId;
  messageId?: string;
  timestamp: string;
}

export type CausalRelation = 'PRECEDES' | 'SUCCEEDS' | 'CONCURRENT' | 'EQUAL';

export class VectorClockSimulator {
  private vectors: Record<ProcessId, VectorTime> = {
    A: [0, 0, 0],
    B: [0, 0, 0],
    C: [0, 0, 0],
  };

  private events: VectorEvent[] = [];
  private inFlightMessages: Array<{ messageId: string; from: ProcessId; to: ProcessId; vector: VectorTime }> = [];

  constructor() {
    this.seedDefaultTimeline();
  }

  private getProcessIndex(p: ProcessId): number {
    return p === 'A' ? 0 : p === 'B' ? 1 : 2;
  }

  public getVectors(): Record<ProcessId, VectorTime> {
    return {
      A: [...this.vectors.A] as VectorTime,
      B: [...this.vectors.B] as VectorTime,
      C: [...this.vectors.C] as VectorTime,
    };
  }

  public getEvents(): VectorEvent[] {
    return [...this.events];
  }

  public getInFlightMessages() {
    return [...this.inFlightMessages];
  }

  public reset(withSeed = true) {
    this.vectors = { A: [0, 0, 0], B: [0, 0, 0], C: [0, 0, 0] };
    this.events = [];
    this.inFlightMessages = [];
    if (withSeed) {
      this.seedDefaultTimeline();
    }
  }

  public triggerLocalEvent(process: ProcessId, label: string): VectorEvent {
    const idx = this.getProcessIndex(process);
    this.vectors[process][idx] += 1;

    const event: VectorEvent = {
      id: `v-evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      process,
      label,
      vector: [...this.vectors[process]] as VectorTime,
      type: 'LOCAL',
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  public triggerSendEvent(from: ProcessId, to: ProcessId, label: string): VectorEvent {
    const idx = this.getProcessIndex(from);
    this.vectors[from][idx] += 1;

    const messageId = `msg-${Date.now()}`;
    const sentVector = [...this.vectors[from]] as VectorTime;

    const event: VectorEvent = {
      id: `v-evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      process: from,
      label: `${label} -> Node ${to}`,
      vector: sentVector,
      type: 'SEND',
      target: to,
      messageId,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);

    this.inFlightMessages.push({
      messageId,
      from,
      to,
      vector: sentVector,
    });

    return event;
  }

  public triggerReceiveEvent(to: ProcessId): VectorEvent | null {
    const msgIdx = this.inFlightMessages.findIndex((m) => m.to === to);
    if (msgIdx === -1) return null;

    const msg = this.inFlightMessages.splice(msgIdx, 1)[0];
    const recIdx = this.getProcessIndex(to);

    // Vector clock receive rule:
    // V_rec[k] = max(V_rec[k], V_msg[k]) for all k
    // V_rec[recIdx] += 1
    for (let k = 0; k < 3; k++) {
      this.vectors[to][k] = Math.max(this.vectors[to][k], msg.vector[k]);
    }
    this.vectors[to][recIdx] += 1;

    const event: VectorEvent = {
      id: `v-evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      process: to,
      label: `Receive from Node ${msg.from}`,
      vector: [...this.vectors[to]] as VectorTime,
      type: 'RECEIVE',
      messageId: msg.messageId,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);

    return event;
  }

  public static compareVectors(v1: VectorTime, v2: VectorTime): CausalRelation {
    let lessOrEqual = true;
    let strictlyLess = false;
    let greaterOrEqual = true;
    let strictlyGreater = false;

    for (let i = 0; i < 3; i++) {
      if (v1[i] > v2[i]) lessOrEqual = false;
      if (v1[i] < v2[i]) strictlyLess = true;
      if (v1[i] < v2[i]) greaterOrEqual = false;
      if (v1[i] > v2[i]) strictlyGreater = true;
    }

    if (v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2]) return 'EQUAL';
    if (lessOrEqual && strictlyLess) return 'PRECEDES'; // v1 < v2
    if (greaterOrEqual && strictlyGreater) return 'SUCCEEDS'; // v1 > v2
    return 'CONCURRENT'; // v1 || v2
  }

  private seedDefaultTimeline() {
    this.triggerLocalEvent('A', 'eA1: Auth validation');
    this.triggerSendEvent('A', 'B', 'eA2: Dispatch prediction job');
    this.triggerLocalEvent('C', 'eC1: Background cache cleanup'); // Concurrent with A2
    this.triggerReceiveEvent('B'); // eB1: Receive job at Node B
    this.triggerLocalEvent('B', 'eB2: Run BERT tokenizer');
  }
}

export const vectorClockSimulator = new VectorClockSimulator();
