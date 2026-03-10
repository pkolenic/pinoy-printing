import { RequestHandler } from 'express';
import { ValidationChain } from 'express-validator';
import {
  checkPermissions,
  createAttachMiddleware,
  jwtCheck,
} from '../middleware/index.js';
import { TenantModels } from "../types/tenantContext.js";

export const createRouteGuards = <P extends string,  K extends keyof TenantModels>(
  modelName: K,
  defaultIdParam?: string,
  defaultKey?: string
) => {
  // Basic permission + validation guard
  const guard = (perm: P, rules: (ValidationChain | RequestHandler)[] = [], isSelf = false) => [
    jwtCheck, // Protects all routes with JWT verification when required.
    checkPermissions(perm, isSelf),
    ...rules
  ];

  // Guard that attaches a resource
  const guardedResource = (perm: P, rules: (ValidationChain | RequestHandler)[] = [], isSelf = false) => [
    ...guard(perm, rules, isSelf),
    createAttachMiddleware(modelName, defaultIdParam!, defaultKey!)
  ];

  // Extension: Attach multiple resources
  const guardedMultiResource = (
    perm: P,
    attachments: {
      modelName: keyof TenantModels;
      param: string;
      key: string;
    }[],
    rules: (ValidationChain | RequestHandler)[] = [],
    isSelf = false
  ) => [
    ...guard(perm, rules, isSelf),
    ...attachments.map(a => createAttachMiddleware(a.modelName, a.param, a.key))
  ];

  return { guard, guardedResource, guardedMultiResource };
};
