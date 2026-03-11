import {
  IAddress,
  ICategoryDocument,
  IOrderDocument,
  IProductDocument,
  ISiteConfigurationDocument,
  IUserDocument,
} from '../models/index.js';
import { TenantModels } from './tenantContext.js';


// Augment the library's internal JWTPayload interface to include custom properties
declare module 'express-oauth2-jwt-bearer' {
  // noinspection JSUnusedGlobalSymbols
  interface JWTPayload {
    permissions?: string[];
    sub?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      // Custom properties attached by createAttachMiddleware
      tenantModels: TenantModels;
      address?: IAddress;
      category?: ICategoryDocument;
      order?: IOrderDocument;
      product?: IProductDocument;
      user?: IUserDocument;
      tenantConfig: ISiteConfigurationDocument;
      tenantRedis: import('../services/tenantRedis.js').TenantRedisWrapper;
    }
  }
}

export {};
