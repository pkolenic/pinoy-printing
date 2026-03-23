import express, { Router } from 'express';
import { PUBLIC_DIR } from './constants/paths.js';
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

// Silently 404 well-known files
router.get('/.well-known/*path', getWellKnownNotFound);

// GET favicons
const faviconFiles = [
  'favicon\\.ico',
  'favicon-16x16\\.png',
  'favicon-32x32\\.png',
  'apple-touch-icon\\.png',
  'android-chrome-192x192\\.png',
  'android-chrome-512x512\\.png',
  'apple-touch-icon-precomposed\\.png'
].join('|');
router.get(new RegExp(`.*(${faviconFiles})$`), getFavicon);

/**
 * Static Folder Middleware
 * Serves files like images, CSS, or JS from the public directory.
 */
router.use(express.static(PUBLIC_DIR, { index: false }));

// And a fallback for React Router:
router.get('*path', getIndex);

export default router;
