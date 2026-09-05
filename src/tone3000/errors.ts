export class Tone3000Error extends Error {
  constructor(
    message: string,
    public readonly code: "missing_credentials" | "unauthorized" | "rate_limited" | "unavailable" | "invalid_response",
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "Tone3000Error";
  }
}
