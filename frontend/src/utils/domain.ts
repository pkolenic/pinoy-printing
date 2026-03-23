import slugify from '@sindresorhus/slugify';

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
  /**
   * Currently, it doesn't make sense to use this the SITE override as Auth0 can only call the backend method from a production site
   */
  // const params = new URLSearchParams(window.location.search);
  // const siteOverride = params.get('SITE');
  //
  // // Use override if it exists, otherwise fallback to hostname
  // const hostname = siteOverride || window.location.hostname;

  const hostname = window.location.hostname;
  return slugify(hostname.toLowerCase(), { separator: '_' });
}
