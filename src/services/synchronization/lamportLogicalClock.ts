export class LamportLogicalClock {
  private value = 0;

  constructor(initialValue = 0) {
    if (!Number.isSafeInteger(initialValue) || initialValue < 0) {
      throw new RangeError('Lamport clock must start at a non-negative safe integer.');
    }
    this.value = initialValue;
  }

  current(): number {
    return this.value;
  }

  localEvent(): number {
    if (this.value >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Lamport clock exceeded the maximum safe integer.');
    }
    this.value += 1;
    return this.value;
  }

  sendMessage(): number {
    return this.localEvent();
  }

  receiveMessage(receivedTimestamp: number): number {
    if (!Number.isSafeInteger(receivedTimestamp) || receivedTimestamp < 0) {
      throw new RangeError('Received Lamport timestamp must be a non-negative safe integer.');
    }
    const nextValue = Math.max(this.value, receivedTimestamp) + 1;
    if (!Number.isSafeInteger(nextValue)) {
      throw new RangeError('Lamport clock exceeded the maximum safe integer.');
    }
    this.value = nextValue;
    return this.value;
  }
}

export const browserLamportClock = new LamportLogicalClock();
