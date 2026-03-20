import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/errors/index.js";
import Redis from '../services/redis.js';
import { getTenantRedis } from "../services/tenantRedis.js";
import { getEnv, getTenantId } from "../utils/system.js";
import { ISiteConfigurationDocument } from "../models/index.js";
import { getTenantDb, SiteConfiguration, } from "../services/db.js";
import { getTenantModels } from "../types/tenantContext.js";


export const getSiteConfiguration = async (tenantId: string): Promise<ISiteConfigurationDocument> => {
  const redis = await Redis.getInstance();
  let siteConfig = await redis.getJSON(`site-config:${tenantId}`) as ISiteConfigurationDocument;

  // On a cache miss, fetch from the database
  if (!siteConfig) {
    siteConfig = await SiteConfiguration.findOne({ tenantId }) as ISiteConfigurationDocument;
    if (!siteConfig) {
      // Hydrate the siteConfig using the default values
      siteConfig = {
        frontend: {
          auth0: {
            domain: getEnv(process.env.VITE_AUTH0_DOMAIN, ''),
            audience: getEnv(process.env.VITE_AUTH0_AUDIENCE, ''),
            clientId: getEnv(process.env.VITE_AUTH0_CLIENT_ID, ''),
            connection: getEnv(process.env.VITE_AUTH0_CONNECTION, ''),
          },
          hero: {
            title: getEnv(process.env.VITE_HERO_TITLE, 'A Test Site for local validation'),
            description: getEnv(process.env.VITE_HERO_DESCRIPTION, 'Test and Validate all the features locally'),
            // TODO - replace with a static hero.png image in the public folder
            image: getEnv(process.env.VITE_HERO_IMAGE, ''),
          },
          settings: {
            requireAuthentication: getEnv(process.env.REQUIRE_AUTHENTICATION, false),
          },
          site: {
            name: getEnv(process.env.VITE_SITE_NAME, 'Test E-Commerce Site'),
            address: getEnv(process.env.VITE_SITE_ADDRESS, '123 Gift Street, Present City'),
            phone: getEnv(process.env.VITE_SITE_PHONE, '+63917123SHOP'),
            email: getEnv(process.env.VITE_SITE_EMAIL, 'help@example.com'),
            currency: getEnv(process.env.VITE_SITE_CURRENCY, '₱'),
          },
          theme: {
            primaryColor: getEnv(process.env.VITE_PRIMARY_COLOR, '#825E24FF'),
            secondaryColor: getEnv(process.env.VITE_SECONDARY_COLOR, '#A66D2D'),
            errorColor: getEnv(process.env.VITE_ERROR_COLOR, '#f44336'),
            paperColor: getEnv(process.env.VITE_PAPER_COLOR, '#eceff1'),
            selectedColor: getEnv(process.env.VITE_SELECTED_COLOR, '#0A001F'),
            selectedHoverColor: getEnv(process.env.VITE_SELECTED_HOVER_COLOR, '#2C2A4A'),
          },
        },
        backend: {
          database: {
            name: getEnv(process.env.MONGO_DB, ''),
            url: getEnv(process.env.MONGO_URL, ''),
          },
          redis: {
            url: getEnv(process.env.TENANT_REDIS_URI || process.env.REDIS_URI, ''),
          },
          auth0: {
            audience: getEnv(process.env.AUTH0_AUDIENCE, ''),
            issuerDomain: getEnv(process.env.AUTH0_ISSUER_DOMAIN, ''),
            tokenSigningAlgorithm: getEnv(process.env.AUTH0_TOKEN_SIGNING_ALGORITHM, ''),
            managementClientId: getEnv(process.env.AUTH0_MANAGEMENT_CLIENT_ID, ''),
            managementClientSecret: getEnv(process.env.AUTH0_MANAGEMENT_CLIENT_SECRET, ''),
            authorizationDB: getEnv(process.env.AUTH0_AUTHORIZATION_DB, ''),
          },
          settings: {
            requireAuthentication: getEnv(process.env.REQUIRE_AUTHENTICATION, false),
          },
        },
      } as ISiteConfigurationDocument;
    }
    await redis.setJSON(`site-config:${tenantId}`, siteConfig, 60 * 10); // Cache for 10 minutes - TODO - once we can edit configurations in the dashboard remove the ttl
  }
  return siteConfig;
}

export const configurationMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);

    // Attach the tenant configuration to the request object
    let tenantConfig = await getSiteConfiguration(tenantId);
    req.tenantConfig = tenantConfig;

    // getTenantDb returns the connection (cached internally)
    const tenantDb = getTenantDb(tenantConfig?.backend?.database?.name || 'default');
    req.tenantModels = getTenantModels(tenantDb);

    // Attach the tenant redis to the request object
    req.tenantRedis = await getTenantRedis(tenantId, tenantConfig.backend.redis.url);

    next();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return next(error);
    }
    // Convert standard errors or Mongoose errors to AppError format
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    next(new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR));
  }
};
