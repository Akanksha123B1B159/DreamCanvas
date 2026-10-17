export type LamportEventType = 'INTERNAL' | 'SEND' | 'RECEIVE';

export interface LamportEvent {
  id: string;
  nodeId: 'A' | 'B' | 'C';
  type: LamportEventType;
  description: string;
  timestamp: number; // Lamport logical timestamp L
  targetNodeId?: 'A' | 'B' | 'C';
  messageId?: string;
  createdAt: string;
}

export class LamportClockSimulator {
  private clocks: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };
  private events: LamportEvent[] = [];
  private inFlightMessages: Array<{ messageId: string; from: 'A' | 'B' | 'C'; to: 'A' | 'B' | 'C'; sendClock: number }> = [];

  constructor() {
    this.seedDefaultTimeline();
  }

  public getClocks(): Record<'A' | 'B' | 'C', number> {
    return { ...this.clocks };
  }

  public getEvents(): LamportEvent[] {
    return [...this.events];
  }

  public getInFlightMessages() {
    return [...this.inFlightMessages];
  }

  public reset() {
    this.clocks = { A: 0, B: 0, C: 0 };
    this.events = [];
    this.inFlightMessages = [];
    this.seedDefaultTimeline();
  }

  public triggerInternalEvent(nodeId: 'A' | 'B' | 'C', label = 'Compute roadmap step'): LamportEvent {
    this.clocks[nodeId] += 1;
    const event: LamportEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nodeId,
      type: 'INTERNAL',
      description: label,
      timestamp: this.clocks[nodeId],
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  public triggerSendEvent(fromNode: 'A' | 'B' | 'C', toNode: 'A' | 'B' | 'C', description = 'Send RPC message'): LamportEvent {
    this.clocks[fromNode] += 1;
    const messageId = `msg-${Date.now()}`;
    const event: LamportEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nodeId: fromNode,
      type: 'SEND',
      description: `${description} to Node ${toNode}`,
      timestamp: this.clocks[fromNode],
      targetNodeId: toNode,
      messageId,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    this.inFlightMessages.push({
      messageId,
      from: fromNode,
      to: toNode,
      sendClock: this.clocks[fromNode],
    });
    return event;
  }

  public triggerReceiveEvent(toNode: 'A' | 'B' | 'C'): LamportEvent | null {
    const msgIndex = this.inFlightMessages.findIndex((m) => m.to === toNode);
    if (msgIndex === -1) {
      return null;
    }
    const msg = this.inFlightMessages.splice(msgIndex, 1)[0];
    // Lamport rule: L = max(L_receiver, L_message) + 1
    const newClock = Math.max(this.clocks[toNode], msg.sendClock) + 1;
    this.clocks[toNode] = newClock;

    const event: LamportEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nodeId: toNode,
      type: 'RECEIVE',
      description: `Receive message from Node ${msg.from} (sent at L=${msg.sendClock})`,
      timestamp: newClock,
      messageId: msg.messageId,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  private seedDefaultTimeline() {
    // Seed initial pedagogical example: A1, A2, SEND A->B, RECEIVE B, B1, etc.
    this.triggerInternalEvent('A', 'A1: User inputs career target');
    this.triggerInternalEvent('A', 'A2: Form validation');
    this.triggerSendEvent('A', 'B', 'SEND: Dispatch roadmap job');
    this.triggerReceiveEvent('B');
    this.triggerInternalEvent('B', 'B1: LLM synthesizes modules');
    this.triggerSendEvent('B', 'C', 'SEND: Persist modules');
    this.triggerReceiveEvent('C');
    this.triggerInternalEvent('C', 'C1: Supabase writes batch');
  }
}

export const lamportClockSimulator = new LamportClockSimulator();
