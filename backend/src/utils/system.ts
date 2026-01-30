/**
 * Gets a process.env value and casts it to the desired type.
 * Supports: 'string' | 'number' | 'boolean'
 */
export const getEnv = <T extends string | number | boolean>(
  value: string | undefined,
  defaultValue: T
): T => {
  if (value === undefined || value === "") return defaultValue;

  // Infer boolean
  if (typeof defaultValue === 'boolean') {
    return /^true$/i.test(value) as unknown as T;
  }

  // Infer number
  if (typeof defaultValue === 'number') {
    const parsed = Number(value);
    return (isNaN(parsed) ? defaultValue : parsed) as unknown as T;
  }

  // Fallback to string
  return value as unknown as T;
};
