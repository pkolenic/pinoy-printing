import { ManagementClient } from 'auth0';
import { StatusCodes } from "http-status-codes";
import { AppError } from '../utils/errors/index.js';

/**
 * Defines valid User Roles
 */
export type UserRole = 'admin' | 'customer' | 'owner' | 'staff';

/**
 * Map roles to Auth0 Role IDs from environment variables
 */
export const USER_ROLE_IDS: Record<UserRole, string | undefined> = {
  admin: process.env.AUTH0_ADMIN_ROLE_ID,
  customer: process.env.AUTH0_CUSTOMER_ROLE_ID,
  owner: process.env.AUTH0_OWNER_ROLE_ID,
  staff: process.env.AUTH0_STAFF_ROLE_ID,
}

// Singleton instance of the Auth0 Management Client
let clientInstance: ManagementClient | null = null;

// Cache for tenant-specific Auth0 clients
const clientCache = new Map<string, ManagementClient>();

/**
 * Returns a cached or new Auth0 Management Client for a specific tenant.
 */
export function getManagementClient(
  tenantId: string,
  config: {
    issuerDomain: string;
    managementClientId: string;
    managementClientSecret: string;
    [key: string]: any; // Allows the other extra properties
  }
): ManagementClient {
  // Check if the client for this tenant already exists
  if (clientCache.has(tenantId)) {
    return clientCache.get(tenantId)!;
  }

  const {
    issuerDomain: domain,
    managementClientId: clientId,
    managementClientSecret: clientSecret
  } = config;

  // Validation - Ensure all required credentials are provided
  if (!domain || !clientId || !clientSecret) {
    throw new AppError(`Auth0 credentials missing for tenant: ${tenantId}`, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  try {
    // Initialize the new client
    const client = new ManagementClient({
      domain,
      clientId,
      clientSecret,
      // Ensure the audience points to the specific tenant's API
      audience: `https://${domain}/api/v2/`,
    });

    // 4. Cache and return
    clientCache.set(tenantId, client);
    return client;
  } catch (error) {
    throw new AppError(`Failed to initialize Auth0 client for tenant ${tenantId}`, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Utility to clear the cache (useful for testing or credential rotation)
 */
export async function clearAuth0Cache(): Promise<void> {
  clientCache.clear();
}

/**
 * Retrieves the Auth0 Role ID for a given friendly role name
 */
export function getRoleId(role: UserRole): string {
  const roleId = USER_ROLE_IDS[role];
  if (!roleId) {
    throw new AppError(`Auth0 Role ID not found for role: ${role}`, 500);
  }
  return roleId;
}

/**
 * Validates a raw input string and returns a valid UserRole
 */
export function getValidatedRole(rawRole: string | undefined): UserRole {
  // Safe normalization: Handles undefined/null gracefully
  const normalizedRole = (rawRole ?? '').toLowerCase();

  // Type guard: 'in' operator ensures the string exists as a key in USER_ROLE_IDS
  if (normalizedRole in USER_ROLE_IDS) {
    return normalizedRole as UserRole;
  }

  return 'customer';
}
