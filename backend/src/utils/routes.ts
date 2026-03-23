import { Router } from 'express';

/**
 * Mounts a child router under a parent path.
 * Attaches the path to the child router for stack crawling. (Useful for route debugging and testing)
 * @param parent
 * @param path
 * @param child
 */
export const mountRoute = (parent: Router, path: string, child: Router): void => {
  (child as any).mountPath = path; // Store for your stack crawler
  parent.use(path, child);
};
