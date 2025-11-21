import express from 'express';
import jwtCheck from "../middleware/auth.js";

const router = express.Router();
router.use(jwtCheck);

// Dummy Route for testing
router.get('/', (req, res) => {
    res.send('API is working!');
});

// Export the router
export default router;
