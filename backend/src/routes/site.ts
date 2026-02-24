import { Router } from 'express';
import { getSiteConfiguration } from "../controllers/site.js";

const router = Router();

router.get('/config', getSiteConfiguration);

export default router;
