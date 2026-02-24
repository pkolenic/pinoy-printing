import { useMemo } from "react"
import {
  DeepPartial,
  Paths,
  PathValue,
  ISiteConfig
} from '../types';
import { siteFeature } from '../features/';
import { isPrimaryDomain } from "../utils/domain.ts";

// Define your nested default configuration
const DEFAULT_CONFIG: ISiteConfig = {
  auth0: {
    domain: "",
    audience: "",
    clientId: "",
  },
  site: {
    name: "Pinoy Shop",
    address: "123 Gift Street, Present City",
    phone: "63917123SHOP",
    email: "hello@example.com",
    currency: "₱",
  },
  settings: {
    requireAuthentication: false,
  },
  theme: {
    primaryColor: "#332B6AFF",
    secondaryColor: "#6c757d",
    errorColor: "#f44336",
    paperColor: "#ffffff",
    selectedColor: "#0A001F",
    selectedHoverColor: "#2C2A4A",
  },
  hero: {
    title: "",
    description: "",
    image: "",
  },
};

/**
 * Utility to resolve nested values using dot notation (e.g., "theme.primaryColor")
 */
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Utility to parse environment variables into their correct types
 */
export const parseEnvValue = <T extends string | number | boolean>(
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
 * Single Path Signature
 * @return - The value at the specified path
 * @type: the exact type at that path
 */
export function useSiteConfig<P extends Paths<ISiteConfig>>(
  path: P,
  defaultValue?: DeepPartial<PathValue<ISiteConfig, P>>
): PathValue<ISiteConfig, P>;

/**
 * Array of Paths Signature
 * @param paths
 * @return - Returns a picked object of those paths
 */
export function useSiteConfig<P extends Paths<ISiteConfig>>(
  paths: P[]
): { [K in P]: PathValue<ISiteConfig, K> };

// Implementation
export function useSiteConfig<P extends Paths<ISiteConfig>>(
  path: P,
  defaultValue?: DeepPartial<PathValue<ISiteConfig, P>>
): PathValue<ISiteConfig, P> {
  const skipQuery = useMemo(() => isPrimaryDomain(), []);

  const { data } = siteFeature.siteApiSlice.useGetSiteConfigQuery(undefined, {
    skip: skipQuery,
    selectFromResult: (result) => ({ data: result.data }),
  });

  // Recursive fallback resolver
  const resolveValue = (currentPath: string, customDefault?: any): any => {
    const apiValue = getNestedValue(data, currentPath);
    if (apiValue !== undefined) {
      return apiValue;
    }

    const globalDefault = getNestedValue(DEFAULT_CONFIG, currentPath);
    const targetDefault = customDefault ?? globalDefault;

    // If it's an object (like 'site'), resolve its children
    if (typeof targetDefault === 'object' && targetDefault !== null) {
      const result: any = {};
      // Merge keys from both global and custom defaults
      const keys = new Set([...Object.keys(globalDefault || {}), ...Object.keys(customDefault || {})]);

      keys.forEach((key) => {
        result[key] = resolveValue(`${currentPath}.${key}`, customDefault?.[key]);
      });
      return result;
    }

    // It's a leaf node: check Env then Defaults
    const viteKey = `VITE_${currentPath.replace(/\./g, '_').replace(/([A-Z])/g, "_$1").toUpperCase()}`;
    const envValue = import.meta.env[viteKey];

    return parseEnvValue(envValue, targetDefault);
  };

  return resolveValue(path as string, defaultValue);
}
