const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  subject: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['notes', 'syllabus', 'question-paper', 'assignment', 'other'],
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number // in bytes
  },
  semester: {
    type: Number,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

materialSchema.index({ department: 1, semester: 1, subject: 1 });

module.exports = mongoose.model('Material', materialSchema);