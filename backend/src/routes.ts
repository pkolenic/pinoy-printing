import express, { Router } from 'express';
import { PUBLIC_DIR } from './config/paths.js';
import apiRoutes from './routes/api.js';
import siteRoutes from './routes/site.js';
import {
  getIndex,
  getFavicon,
} from "./controllers/static.js";

const router: Router = Router();

// Mount sub-routers
router.use('/api', apiRoutes);
router.use('/site', siteRoutes);

/**
 * Static Folder Middleware
 * Serves files like images, CSS, or JS from the public directory.
 */
router.use(express.static(PUBLIC_DIR, { index: false }));

// Silently 404 well-known files without triggering the fallback or error logger
router.get('/.well-known/*path', (_req, res) => res.status(404).end());

// GET favicon.ico and other static thumbnail images
router.get(['/favicon.ico', '/apple-touch-icon.png', 'apple-touch-icon-precomposed.png'], getFavicon);

// And a fallback for React Router:
router.get('*path', getIndex);
export default router;
