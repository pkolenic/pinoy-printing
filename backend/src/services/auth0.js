import { ManagementClient } from 'auth0';

const USER_ROLE_IDS = {
  'admin': process.env.AUTH0_ADMIN_ROLE_ID,
  'customer': process.env.AUTH0_CUSTOMER_ROLE_ID,
  'owner': process.env.AUTH0_OWNER_ROLE_ID,
  'staff': process.env.AUTH0_STAFF_ROLE_ID,
}

function getManagementClient() {
  return new ManagementClient({
    domain: process.env.AUTH0_ISSUER_DOMAIN,
    clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
    clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
  })
}

function getRoleId(role) {
  return USER_ROLE_IDS[role];
}

function getValidatedRole(rawRole) {
  const normalizedRole = (rawRole || '').toLowerCase();

  // Use the 'in' operator to check if the normalized string is a key in the object
  return normalizedRole in USER_ROLE_IDS ? normalizedRole : 'customer';
}

export {
  getManagementClient,
  getRoleId,
  getValidatedRole,
}
