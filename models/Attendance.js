const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: [true, 'Status is required'],
    default: 'absent'
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required']
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    min: 1,
    max: 8
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicates
// One attendance record per student + subject + date
attendanceSchema.index(
  { student: 1, subject: 1, date: 1 },
  { unique: true }
);

// Index for faster queries
attendanceSchema.index({ department: 1, semester: 1, date: 1 });
attendanceSchema.index({ student: 1, date: -1 });

// Static method to normalize date (remove time component)
attendanceSchema.statics.normalizeDate = function(dateInput) {
  const date = new Date(dateInput);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

module.exports = mongoose.model('Attendance', attendanceSchema);