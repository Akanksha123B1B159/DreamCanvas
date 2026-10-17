export interface ElectionNode {
  id: number;
  name: string;
  isAlive: boolean;
  isLeader: boolean;
}

export interface ElectionMessage {
  id: string;
  fromId: number;
  toId: number;
  type: 'ELECTION' | 'ANSWER' | 'COORDINATOR';
  timestamp: string;
}

export interface ElectionRoundResult {
  initiatorId: number;
  newLeaderId: number;
  messages: ElectionMessage[];
  summary: string;
}

export class BullyElectionSimulator {
  private nodes: ElectionNode[] = [
    { id: 1, name: 'Node 1 (Worker Replica 1)', isAlive: true, isLeader: false },
    { id: 2, name: 'Node 2 (Worker Replica 2)', isAlive: true, isLeader: false },
    { id: 3, name: 'Node 3 (Job Scheduler)', isAlive: true, isLeader: false },
    { id: 4, name: 'Node 4 (Secondary Gateway)', isAlive: true, isLeader: false },
    { id: 5, name: 'Node 5 (Primary Coordinator)', isAlive: true, isLeader: true },
  ];

  public getNodes(): ElectionNode[] {
    return this.nodes.map((n) => ({ ...n }));
  }

  public getCurrentLeader(): ElectionNode | undefined {
    return this.nodes.find((n) => n.isLeader && n.isAlive);
  }

  public failLeader(): { failedNodeId: number; previousLeader: string } {
    const leader = this.nodes.find((n) => n.isLeader);
    if (!leader) throw new Error('No active leader found');

    leader.isAlive = false;
    leader.isLeader = false;
    return { failedNodeId: leader.id, previousLeader: leader.name };
  }

  public reviveNode(id: number) {
    const node = this.nodes.find((n) => n.id === id);
    if (node) {
      node.isAlive = true;
      // If highest node is revived, it bullies and becomes leader immediately
      const highestAlive = Math.max(...this.nodes.filter((n) => n.isAlive).map((n) => n.id));
      if (node.id === highestAlive) {
        this.nodes.forEach((n) => (n.isLeader = n.id === node.id));
      }
    }
  }

  public runElection(initiatorId = 3): ElectionRoundResult {
    const messages: ElectionMessage[] = [];
    const initiator = this.nodes.find((n) => n.id === initiatorId && n.isAlive) || this.nodes.find((n) => n.isAlive);
    if (!initiator) {
      throw new Error('No alive nodes available to run election');
    }

    const currentInitiatorId = initiator.id;

    // 1. Initiator sends ELECTION to all higher priority nodes
    const higherNodes = this.nodes.filter((n) => n.id > currentInitiatorId);
    let highestRespondingNode: ElectionNode | null = null;

    higherNodes.forEach((target) => {
      messages.push({
        id: `msg-${Date.now()}-${Math.random()}`,
        fromId: currentInitiatorId,
        toId: target.id,
        type: 'ELECTION',
        timestamp: new Date().toISOString(),
      });

      if (target.isAlive) {
        // Target answers OK
        messages.push({
          id: `msg-${Date.now()}-${Math.random()}`,
          fromId: target.id,
          toId: currentInitiatorId,
          type: 'ANSWER',
          timestamp: new Date().toISOString(),
        });
        if (!highestRespondingNode || target.id > highestRespondingNode.id) {
          highestRespondingNode = target;
        }
      }
    });

    // 2. If higher nodes responded, the highest alive one runs election and wins
    let winnerId = currentInitiatorId;
    if (highestRespondingNode) {
      winnerId = (highestRespondingNode as ElectionNode).id;
    }

    // 3. Winner broadcasts COORDINATOR to all other alive nodes
    this.nodes.forEach((node) => {
      node.isLeader = node.id === winnerId;
      if (node.id !== winnerId && node.isAlive) {
        messages.push({
          id: `msg-${Date.now()}-${Math.random()}`,
          fromId: winnerId,
          toId: node.id,
          type: 'COORDINATOR',
          timestamp: new Date().toISOString(),
        });
      }
    });

    const winnerNode = this.nodes.find((n) => n.id === winnerId)!;

    return {
      initiatorId: currentInitiatorId,
      newLeaderId: winnerId,
      messages,
      summary: `Bully Algorithm: Node ${currentInitiatorId} detected coordinator timeout. Broadcasted ELECTION to higher IDs. Node ${winnerId} asserted priority and broadcasted COORDINATOR to all active cluster nodes.`,
    };
  }
}

export const bullyElectionSimulator = new BullyElectionSimulator();
