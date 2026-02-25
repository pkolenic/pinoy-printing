import { Request } from "express";

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

export const getTargetHostname = (req: Request): string => {
  // Check for the override first (useful for Dev and potentially QA/Preview environments)
  const siteOverride = req.query.SITE as string;

  if (process.env.NODE_ENV === 'development' && siteOverride) {
    return siteOverride;
  }

  // Fallback to standard hostname
  return req.hostname;
};
