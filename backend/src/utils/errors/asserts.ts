/**
 * Helper to enforce exhaustive checks in switch statements.
 */
export function assertExhaustive(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`);
}
