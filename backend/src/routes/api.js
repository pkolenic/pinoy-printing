import express from 'express';
import jwtCheck from "../middleware/auth.js";
import orderRoutes from "./orders.js";
import userRoutes from "./users.js";

const router = express.Router();
router.use(jwtCheck);

// Dummy Route for testing
router.get('/', (req, res) => {
    res.send('API is working!');
});

// Mount user routes
router.use('/orders', orderRoutes);
router.use('/users', userRoutes);

// Export the router
export default router;
