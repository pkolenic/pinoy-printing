export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Useful to distinguish between expected vs. unexpected errors

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, AppError.prototype);

    // Captures the stack trace, excluding this constructor from it
    Error.captureStackTrace(this, this.constructor);
  }
}
