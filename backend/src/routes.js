import express from 'express';
import path from 'path';
import apiRoutes from './routes/api.js';

const router = express.Router();

// Mount sub-routers
router.use('/api', apiRoutes);

// GET current path
const __serverDirectory = process.cwd();
// Create an absolute path: <project-root>/public
const publicDirectory = path.join(__serverDirectory, 'public');

// PUBLIC FOLDER (to get any static files not handled by the static routes)
router.use(express.static(publicDirectory));

export default router;
