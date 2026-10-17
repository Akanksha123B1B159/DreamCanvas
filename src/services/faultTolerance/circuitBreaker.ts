export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
  serviceName: string;
}

export interface CircuitBreakerStats {
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime: string | null;
  lastStateChange: string;
  nextAttemptAllowedInMs: number;
  isSimulationActive: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  private simulationActive = false;

  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      resetTimeoutMs: config.resetTimeoutMs ?? 8000,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold ?? 2,
      serviceName: config.serviceName ?? 'ML-Detection-Service',
    };
  }

  public setSimulation(active: boolean) {
    this.simulationActive = active;
    if (active) {
      this.tripToOpen('Simulated failure triggered by user demo');
    } else if (this.state === 'OPEN') {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
    }
  }

  public isSimulating(): boolean {
    return this.simulationActive;
  }

  public async execute<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<{ data: T; fromFallback: boolean; state: CircuitState; message?: string }> {
    this.totalCalls++;
    const now = Date.now();

    // Check if OPEN state has expired and should transition to HALF_OPEN
    if (this.state === 'OPEN') {
      if (!this.simulationActive && this.lastFailureTime && now - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN', 'Reset timeout elapsed, attempting probe request');
      } else {
        const remaining = Math.max(0, this.config.resetTimeoutMs - (now - (this.lastFailureTime || now)));
        const fallbackData = await fallback();
        return {
          data: fallbackData,
          fromFallback: true,
          state: this.state,
          message: `Circuit OPEN: fast-failing call. Retry allowed in ${(remaining / 1000).toFixed(1)}s`,
        };
      }
    }

    // If simulation active, fail immediately
    if (this.simulationActive) {
      this.recordFailure(new Error('Simulated upstream outage'));
      const fallbackData = await fallback();
      return {
        data: fallbackData,
        fromFallback: true,
        state: this.state,
        message: 'Simulated ML Service outage active: returned cached graceful fallback',
      };
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return {
        data: result,
        fromFallback: false,
        state: this.state,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.recordFailure(error);
      const fallbackData = await fallback();
      return {
        data: fallbackData,
        fromFallback: true,
        state: this.state,
        message: `Execution failed (${error.message}). Graceful fallback returned.`,
      };
    }
  }

  private recordSuccess() {
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED', 'Service recovered successfully, probe requests succeeded');
        this.failureCount = 0;
        this.consecutiveSuccesses = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private recordFailure(error: Error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.tripToOpen(`Probe request failed in HALF_OPEN state: ${error.message}`);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.tripToOpen(`Failure threshold (${this.config.failureThreshold}) reached`);
    }
  }

  private tripToOpen(reason: string) {
    this.transitionTo('OPEN', reason);
  }

  private transitionTo(newState: CircuitState, reason: string) {
    this.state = newState;
    this.lastStateChange = Date.now();
    console.warn(`[CircuitBreaker:${this.config.serviceName}] State changed to ${newState} -> ${reason}`);
  }

  public getStats(): CircuitBreakerStats {
    const now = Date.now();
    let nextAttemptAllowedInMs = 0;
    if (this.state === 'OPEN' && this.lastFailureTime) {
      nextAttemptAllowedInMs = Math.max(0, this.config.resetTimeoutMs - (now - this.lastFailureTime));
    }

    return {
      serviceName: this.config.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
      nextAttemptAllowedInMs,
      isSimulationActive: this.simulationActive,
    };
  }

  public reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCalls = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.simulationActive = false;
  }
}

export const mlCircuitBreaker = new CircuitBreaker({
  serviceName: 'FastAPI-ML-Job-Detection',
  failureThreshold: 3,
  resetTimeoutMs: 8000,
  halfOpenSuccessThreshold: 2,
});
