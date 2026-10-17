import { createHash } from 'crypto';

export interface AuditBlock {
  index: number;
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
  dataHash: string;
  previousHash: string;
  hash: string;
  nonce: number;
}

export interface VerificationResult {
  isValid: boolean;
  totalBlocks: number;
  verifiedAt: string;
  brokenBlockIndex: number | null;
  errorReason: string | null;
}

export class DistributedAuditLedger {
  private chain: AuditBlock[] = [];

  constructor() {
    this.createGenesisBlock();
    this.seedAuditEvents();
  }

  private calculateHash(
    index: number,
    timestamp: string,
    event: string,
    dataHash: string,
    previousHash: string,
    nonce: number
  ): string {
    return createHash('sha256')
      .update(`${index}-${timestamp}-${event}-${dataHash}-${previousHash}-${nonce}`)
      .digest('hex');
  }

  private hashData(data: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private createGenesisBlock() {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const event = 'GENESIS_DREAMCANVAS_LEDGER';
    const data = { message: 'DreamCanvas Distributed Audit Ledger Initialized' };
    const dataHash = this.hashData(data);
    const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const nonce = 0;
    const hash = this.calculateHash(0, timestamp, event, dataHash, previousHash, nonce);

    this.chain.push({
      index: 0,
      timestamp,
      event,
      data,
      dataHash,
      previousHash,
      hash,
      nonce,
    });
  }

  private seedAuditEvents() {
    this.addBlock('ROADMAP_GENERATION_AUDIT', {
      userId: 'usr-921',
      targetRole: 'AI Engineer',
      durationDays: 30,
      llmModel: 'qwen3.6-27b',
    });

    this.addBlock('JOB_FRAUD_PREDICTION_AUDIT', {
      jobId: 'job-982',
      classification: 'REAL',
      confidence: 0.94,
      model: 'BERT+SVM',
    });

    this.addBlock('ACHIEVEMENT_BADGE_AUDIT', {
      userId: 'usr-921',
      badgeId: 'streak_3',
      title: '3-Day Streak Badge',
    });
  }

  public getChain(): AuditBlock[] {
    return JSON.parse(JSON.stringify(this.chain));
  }

  public addBlock(event: string, data: Record<string, unknown>): AuditBlock {
    const latest = this.chain[this.chain.length - 1];
    const index = latest.index + 1;
    const timestamp = new Date().toISOString();
    const dataHash = this.hashData(data);
    const previousHash = latest.hash;
    const nonce = 1000 + Math.floor(Math.random() * 9000);
    const hash = this.calculateHash(index, timestamp, event, dataHash, previousHash, nonce);

    const block: AuditBlock = {
      index,
      timestamp,
      event,
      data,
      dataHash,
      previousHash,
      hash,
      nonce,
    };

    this.chain.push(block);
    return block;
  }

  public verifyLedger(): VerificationResult {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // 1. Verify previous hash pointer
      if (current.previousHash !== previous.hash) {
        return {
          isValid: false,
          totalBlocks: this.chain.length,
          verifiedAt: new Date().toISOString(),
          brokenBlockIndex: i,
          errorReason: `Broken Hash Link at Block #${i}: previousHash does not match Block #${i - 1}'s hash.`,
        };
      }

      // 2. Verify integrity of current block hash
      const recomputedDataHash = this.hashData(current.data);
      if (recomputedDataHash !== current.dataHash) {
        return {
          isValid: false,
          totalBlocks: this.chain.length,
          verifiedAt: new Date().toISOString(),
          brokenBlockIndex: i,
          errorReason: `Data Tampered at Block #${i}: payload has been altered!`,
        };
      }

      const recomputedHash = this.calculateHash(
        current.index,
        current.timestamp,
        current.event,
        current.dataHash,
        current.previousHash,
        current.nonce
      );

      if (recomputedHash !== current.hash) {
        return {
          isValid: false,
          totalBlocks: this.chain.length,
          verifiedAt: new Date().toISOString(),
          brokenBlockIndex: i,
          errorReason: `Invalid Block Hash at Block #${i}: cryptographic digest mismatch.`,
        };
      }
    }

    return {
      isValid: true,
      totalBlocks: this.chain.length,
      verifiedAt: new Date().toISOString(),
      brokenBlockIndex: null,
      errorReason: null,
    };
  }

  public simulateTampering(index = 1, maliciousPayload = { targetRole: 'Hacked Administrator Role', confidence: 0.01 }) {
    if (this.chain[index]) {
      // Modify payload without updating chained cryptographic hashes
      this.chain[index].data = { ...this.chain[index].data, ...maliciousPayload };
    }
  }

  public repairLedger() {
    this.chain = [];
    this.createGenesisBlock();
    this.seedAuditEvents();
  }
}

export const auditLedger = new DistributedAuditLedger();
