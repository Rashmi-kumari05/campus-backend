const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  uploadMaterial,
  getMaterials,
  getMaterial,
  downloadMaterial,
  viewMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialStats
} = require('../controllers/materialController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

var fileFilter = function(req, file, cb) {
  var allowedTypes = /pdf|doc|docx|ppt|pptx|txt|jpg|jpeg|png|xls|xlsx/;
  var extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, PPT, TXT, Excel, and images are allowed.'));
  }
};

var upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// Public routes (after auth)
router.get('/', protect, getMaterials);
router.get('/stats', protect, authorize('teacher', 'admin'), getMaterialStats);
router.get('/:id', protect, getMaterial);
router.get('/:id/download', protect, downloadMaterial);
router.get('/:id/view', protect, viewMaterial);

// Teacher only routes
router.post('/', protect, authorize('teacher', 'admin'), upload.single('file'), uploadMaterial);
router.put('/:id', protect, authorize('teacher', 'admin'), updateMaterial);
router.delete('/:id', protect, authorize('teacher', 'admin'), deleteMaterial);

module.exports = router;