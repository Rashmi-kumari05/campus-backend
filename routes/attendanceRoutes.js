const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getStudentsForAttendance,
  getMyAttendance,
  getStudentAttendance,
  getAttendanceSummary,
  getSubjects,
  getAllAttendanceRecords
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Common routes
router.get('/subjects', protect, getSubjects);

// Teacher routes
router.post('/', protect, authorize('teacher', 'admin'), markAttendance);
router.get('/students', protect, authorize('teacher', 'admin'), getStudentsForAttendance);
router.get('/summary', protect, authorize('teacher', 'admin'), getAttendanceSummary);
router.get('/all', protect, authorize('teacher', 'admin'), getAllAttendanceRecords);
router.get('/student/:id', protect, authorize('teacher', 'admin'), getStudentAttendance);

// Student routes
router.get('/student', protect, getMyAttendance);

module.exports = router;