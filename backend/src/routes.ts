import express, {Router} from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const router:Router = Router();

// Mount sub-routers
router.use('/api', apiRoutes);

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

export default router;
