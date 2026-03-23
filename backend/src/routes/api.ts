import {
  Router,
  Request,
  Response,
} from 'express';
import categoryRoutes from "./categories.js";
import orderRoutes from "./orders.js";
import productRoutes from "./products.js";
import userRoutes from "./users.js";
import { mountRoute } from '../utils/routes.js';

// Define a Router instance
const router: Router = Router();

/**
 * Root API Route (for Testing)
 * TypeScript now recognizes 'req.auth' thanks to our global augmentation.
 */
router.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    message: 'API is working!',
    authStatus: !!req.auth,
  });
});

// Mount user routes
/**
 * Sub-Route Mounting
 * Ensure these modules export an express.Router Instance
 */
mountRoute(router, '/categories', categoryRoutes);
mountRoute(router, '/orders', orderRoutes);
mountRoute(router, '/products', productRoutes);
mountRoute(router, '/users', userRoutes);

// Export the router
export default router;
