import { useMemo } from "react"
import { siteFeature } from '../features/';
import type { SiteConfig } from '../features/models.ts';
import { isPrimaryDomain } from "../utils/domain.ts";

// Mapping of all environment variables to their default values
const DEFAULT_CONFIG: SiteConfig = {
  auth0Domain: "",
  auth0Audience: "",
  auth0ClientId: "",
  siteName: "My Site",
  siteAddress: "",
  sitePhone: "",
  siteEmail: "",
  siteCurrency: "₱",
  requireAuthentication: false,
  primaryColor: "#332B6AFF",
  secondaryColor: "#6c757d",
  errorColor: "#f44336",
  paperColor: "#ffffff",
  selectedColor: "#e0e0e0",
  selectedHoverColor: "#bdbdbd",
  heroTitle: "",
  heroDescription: "",
  heroImage: "",
};

/**
 * Converts camelCase to VITE_CONSTANT_CASE
 * e.g. auth0Domain -> VITE_AUTH0_DOMAIN
 */
const getViteVarName = (key: string) =>
  `VITE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;

export const useEnv = <T extends string | number | boolean>(
  value: string | undefined,
  defaultValue: T
): T => {
  if (value === undefined || value === "") {
    return defaultValue;
  }

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

/**
 * Retrieves a specific value from the SiteConfig with a default fallback.
 * Subscribes ONLY to the selected key for optimal performance.
 */
// Single Key
export function useSiteConfig<K extends keyof SiteConfig>(
  key: K,
  defaultValue: SiteConfig[K]
): SiteConfig[K];

// Array of Keys
export function useSiteConfig<K extends keyof SiteConfig>(
  keys: K[]
): Pick<SiteConfig, K>;

// Implementation
export function useSiteConfig<K extends keyof SiteConfig>(
  keyOrKeys: K | K[],
  defaultValue?: SiteConfig[K]
) {
  // Determine if we should skip based on the domain
  const skipQuery = useMemo(() => isPrimaryDomain(), []);

  const { data } = siteFeature.siteApiSlice.useGetSiteConfigQuery(undefined, {
    skip: skipQuery,
    selectFromResult: (result) => ({ data: result.data }),
  });

  const getFallback = (key: K): SiteConfig[K] => {
    const viteKey = getViteVarName(key as string);
    const envValue = import.meta.env[viteKey];

    // It uses DEFAULT_CONFIG[key] to know if it should be a bool, string, or number.
    return useEnv(envValue, defaultValue ?? DEFAULT_CONFIG[key]);
  };

  // Handle Array of Keys
  if (Array.isArray(keyOrKeys)) {
    return keyOrKeys.reduce((acc, key) => {
      acc[key] = data?.[key] ??getFallback(key);
      return acc;
    }, {} as Pick<SiteConfig, K>);
  }

  // Handle Single Key
  return data?.[keyOrKeys] ?? getFallback(keyOrKeys);
}
