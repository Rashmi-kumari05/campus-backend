const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudent,
  addStudent,
  addStudentsBulk,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  getDepartments
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// Departments
router.get('/departments', getDepartments);

// Students CRUD
router.get('/students', getStudents);
router.get('/students/:id', getStudent);
router.post('/students', addStudent);
router.post('/students/bulk', addStudentsBulk);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.put('/students/:id/reset-password', resetStudentPassword);

module.exports = router;