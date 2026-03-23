import { Request } from "express";
import slugify from '@sindresorhus/slugify';

/**
 * Gets a process.env value and casts it to the desired type.
 * Supports: 'string' | 'number' | 'boolean'
 * @param value - The name of the environment value.
 * @param fallbackValue - The default value to return if the value is not set, also sets the return type.
 */
export const getEnv = <T extends string | number | boolean>(
  value: string | undefined,
  fallbackValue: T
): T => {
  if (value === undefined || value === "") {
    return fallbackValue;
  }

  // Infer boolean
  if (typeof fallbackValue === 'boolean') {
    return /^true$/i.test(value) as unknown as T;
  }

  // Infer number
  if (typeof fallbackValue === 'number') {
    const parsed = Number(value);
    return (isNaN(parsed) ? fallbackValue : parsed) as unknown as T;
  }

  // Fallback to string
  return value as unknown as T;
};

export const getTargetHostname = (req: Request): string => {
  // Check for the override first (useful for Dev and potentially QA/Preview environments)
  const siteOverride = req.query?.SITE as string;

  if (process.env.NODE_ENV === 'development' && siteOverride) {
    return siteOverride.toLowerCase();
  }

  // Fallback to standard hostname
  return req.hostname.toLowerCase();
};

export const getTenantId = (req: Request): string => {
  const hostname = getTargetHostname(req);
  return slugify(hostname, {separator: '_'});
}
