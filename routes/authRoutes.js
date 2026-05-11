const express = require('express');
const router = express.Router();
const { signup, login, getMe, clerkExchange, clerkRegister } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protect, getMe);

// Clerk bridge routes
router.post('/clerk-exchange', clerkExchange);   // login existing user via Clerk token
router.post('/clerk-register', clerkRegister);   // register new user via Clerk token + profile

module.exports = router;