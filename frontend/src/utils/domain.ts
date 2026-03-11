export const isPrimaryDomain = () => {
  const isDev = import.meta.env.DEV;
  const rawDomains = import.meta.env.VITE_PRIMARY_DOMAINS;

  // Establish the domain list or fail early
  const primaryDomains = rawDomains ? rawDomains.split(",") : (isDev ? ['localhost', '192.168.0.1'] : null);

  if (!primaryDomains) {
    throw new Error("Application configuration error. Please contact support.");
  }

  // Run domain checks
  if (isDev && new URLSearchParams(window.location.search).has('SITE')) {
    return false;
  }

  return primaryDomains.includes(window.location.hostname);
};

export const getTenantId = () => {
  const hostname = window.location.hostname;
  return hostname.toLowerCase() // Standardize the case for case-sensitive DBs/Redis
    .trim() // Remove accidental padding
    .replace(/^www\./, '') // Normalize (treat www.site.com as site.com)
    .replace(/[^a-z0-9.-]/g, '') // Keep alphanumeric, dots, and hyphens (standard DNS chars)
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots for safety
    .replace(/\./g, '_'); // Replace dots with underscores for DB compatibility
}
