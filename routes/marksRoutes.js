const express = require('express');
const router = express.Router();
const {
  getStudentsForMarks,
  uploadMarks,
  getMyMarks,
  getStudentMarks,
  getClassMarks,
  updateMarks,
  deleteMarks,
  getSubjects,
  getAllMarksRecords
} = require('../controllers/marksController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Common routes
router.get('/subjects', protect, getSubjects);

// Teacher routes
router.get('/students', protect, authorize('teacher', 'admin'), getStudentsForMarks);
router.get('/class', protect, authorize('teacher', 'admin'), getClassMarks);
router.get('/all', protect, authorize('teacher', 'admin'), getAllMarksRecords);
router.get('/student/:id', protect, authorize('teacher', 'admin'), getStudentMarks);
router.post('/', protect, authorize('teacher', 'admin'), uploadMarks);
router.put('/:id', protect, authorize('teacher', 'admin'), updateMarks);
router.delete('/:id', protect, authorize('teacher', 'admin'), deleteMarks);

// Student route
router.get('/my-marks', protect, getMyMarks);

module.exports = router;