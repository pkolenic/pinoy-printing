export class AppError extends Error {
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.isOperational = true; // Useful to distinguish between expected vs. unexpected errors

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, AppError.prototype);

    // Captures the stack trace, excluding this constructor from it
    Error.captureStackTrace(this, this.constructor);
  }
}
