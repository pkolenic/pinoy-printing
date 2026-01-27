import {
  Router,
  Request,
  Response,
} from 'express';
import { jwtCheck } from "../middleware/index.js";
import orderRoutes from "./orders.js";
import productRoutes from "./products.js";
import userRoutes from "./users.js";

// Define a Router instance
const router: Router = Router();

/**
 * Global API Middleware
 * Protects all routes mounted below this line with JWT verification.
 */
router.use(jwtCheck);

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
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);
router.use('/users', userRoutes);

// Export the router
export default router;
