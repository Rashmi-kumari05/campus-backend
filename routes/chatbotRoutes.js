const express = require('express');
const router = express.Router();
const { handleQuery } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, handleQuery);

module.exports = router;