import express, { RequestHandler, Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import siteRoutes from './routes/site.js';
import net from "net";
import { SiteConfiguration } from "./models/index.js";
import { AppError } from "./utils/errors/index.js";
import { StatusCodes } from "http-status-codes";

const router: Router = Router();

// Mount sub-routers
router.use('/api', apiRoutes);
router.use('/site', siteRoutes);

// GET current path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an absolute path: <project-root>/public
const publicDirectory = path.join(__dirname, '../public');

/**
 * Static Folder Middleware
 * Serves files like images, CSS, or JS from the public directory.
 */
router.use(express.static(publicDirectory));

// And a fallback for React Router:
router.get(/^[^.]*$/, (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});
export default router;
