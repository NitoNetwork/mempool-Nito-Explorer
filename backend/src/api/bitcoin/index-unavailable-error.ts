/** A consistent index snapshot is temporarily unavailable, never a partial sum. */
export class IndexUnavailableError extends Error {
  constructor(message: string, public retryable = true, public forwardLagEligible = false) { super(message); }
}
