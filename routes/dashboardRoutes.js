const express = require('express');
const router = express.Router();
const {
  getTeacherDashboard,
  getStudentDashboard
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Teacher dashboard
router.get('/teacher', protect, authorize('teacher', 'admin'), getTeacherDashboard);

// Student dashboard
router.get('/student', protect, getStudentDashboard);

module.exports = router;