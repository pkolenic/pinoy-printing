import express, { Router } from 'express';
import { PUBLIC_DIR } from './config/paths.js';
import apiRoutes from './routes/api.js';
import siteRoutes from './routes/site.js';
import { configurationMiddleware } from './middleware/index.js';
import {
  getIndex,
  getFavicon,
  getWellKnownNotFound,
} from "./controllers/static.js";
import { mountRoute } from './utils/routes.js';

const router: Router = Router();

// Site Configuration Middleware
router.use(configurationMiddleware);

// Mount sub-routers
mountRoute(router, '/api', apiRoutes);
mountRoute(router, '/site', siteRoutes);

/**
 * Static Folder Middleware
 * Serves files like images, CSS, or JS from the public directory.
 */
router.use(express.static(PUBLIC_DIR, { index: false }));

// Silently 404 well-known files
router.get('/.well-known/*path', getWellKnownNotFound);

// GET favicon and icons
router.get(['/favicon.ico', '/apple-touch-icon.png', 'apple-touch-icon-precomposed.png'], getFavicon);

// And a fallback for React Router:
router.get('*path', getIndex);

export default router;
