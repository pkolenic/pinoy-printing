import { RequestHandler } from 'express';
import { ValidationChain } from 'express-validator';
import { checkPermissions, createAttachMiddleware } from '../middleware/index.js';

export const createRouteGuards = <P extends string>(
  defaultModel?: any,
  defaultIdParam?: string,
  defaultKey?: string
) => {
  // Basic permission + validation guard
  const guard = (perm: P, rules: (ValidationChain | RequestHandler)[] = [], isSelf = false) => [
    checkPermissions(perm, isSelf),
    ...rules
  ];

  // Guard that attaches a resource
  const guardedResource = (perm: P, rules: (ValidationChain | RequestHandler)[] = [], isSelf = false) => [
    ...guard(perm, rules, isSelf),
    createAttachMiddleware(defaultModel, defaultIdParam!, defaultKey!)
  ];

  // Extension: Attach multiple resources
  const guardedMultiResource = (
    perm: P,
    attachments: { model: any; param: string; key: string }[],
    rules: (ValidationChain | RequestHandler)[] = [],
    isSelf = false
  ) => [
    ...guard(perm, rules, isSelf),
    ...attachments.map(a => createAttachMiddleware(a.model, a.param, a.key))
  ];

  return { guard, guardedResource, guardedMultiResource };
};
