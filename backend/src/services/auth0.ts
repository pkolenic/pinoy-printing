import { ManagementClient } from 'auth0';
import { AppError } from '../utils/errors/index.js';

/**
 * Defines valid User Roles
 */
export type UserRole = 'admin' | 'customer' | 'owner' | 'staff';

/**
 * Map roles to Auth0 Role IDs from environment variables
 */
const USER_ROLE_IDS: Record<UserRole, string | undefined> = {
  admin: process.env.AUTH0_ADMIN_ROLE_ID,
  customer: process.env.AUTH0_CUSTOMER_ROLE_ID,
  owner: process.env.AUTH0_OWNER_ROLE_ID,
  staff: process.env.AUTH0_STAFF_ROLE_ID,
}

// Singleton instance of the Auth0 Management Client
let clientInstance: ManagementClient | null = null;

/**
 * Factory for Auth0 Management Client (v5+ standard)
 */
export function getManagementClient(): ManagementClient {
  if (!clientInstance) {
    const domain = process.env.AUTH0_ISSUER_DOMAIN;
    const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
    const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;

    if (!domain || !clientId || !clientSecret) {
      throw new AppError('Auth0 Management API configuration is missing in environment variables', 500);
    }

    clientInstance = new ManagementClient({
      domain,
      clientId,
      clientSecret,
      // In v5, the SDK internally manages the Machine-to-Machine (M2M) token
      // ensuring the audience matches the Auth0 tenant's Management API identifier
      audience: `https://${domain}/api/v2/`,
    })
  }
  return clientInstance;
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
