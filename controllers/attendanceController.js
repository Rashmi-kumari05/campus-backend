const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { sendSMS } = require('../services/smsService');

// @desc    Mark attendance (Teacher only)
// @route   POST /api/attendance
const markAttendance = async (req, res) => {
  try {
    const { date, subject, department, semester, students } = req.body;

    if (!date || !subject || !department || !semester || !students) {
      return res.status(400).json({
        success: false,
        message: 'Please provide date, subject, department, semester, and students'
      });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Students array cannot be empty'
      });
    }

    const normalizedDate = Attendance.normalizeDate(date);

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const studentData of students) {
      try {
        const { studentId, status } = studentData;

        if (!studentId || !status) {
          results.errors.push('Invalid data for student: ' + studentId);
          continue;
        }

        await Attendance.findOneAndUpdate(
          {
            student: studentId,
            subject: subject,
            date: normalizedDate
          },
          {
            student: studentId,
            subject: subject,
            date: normalizedDate,
            status: status,
            markedBy: req.user._id,
            department: department,
            semester: semester
          },
          {
            upsert: true,
            new: true,
            runValidators: true
          }
        );

        results.created++;

        if (status === 'absent') {
          await checkAndNotifyLowAttendance(studentId, subject);
        }

      } catch (err) {
        results.errors.push('Error for student ' + studentData.studentId + ': ' + err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Attendance saved successfully. Processed: ' + results.created,
      data: results
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark attendance'
    });
  }
};

// @desc    Get students for attendance marking
// @route   GET /api/attendance/students
const getStudentsForAttendance = async (req, res) => {
  try {
    const { department, semester, date, subject } = req.query;

    if (!department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Please provide department and semester'
      });
    }

    const students = await User.find({
      role: 'student',
      department: department,
      semester: parseInt(semester),
      isActive: { $ne: false }
    })
    .select('name email rollNumber phone')
    .sort('rollNumber');

    let attendanceMap = {};
    
    if (date && subject) {
      const normalizedDate = Attendance.normalizeDate(date);
      
      const existingAttendance = await Attendance.find({
        department: department,
        semester: parseInt(semester),
        subject: subject,
        date: normalizedDate
      });

      existingAttendance.forEach(function(record) {
        attendanceMap[record.student.toString()] = record.status;
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const studentsWithAttendance = [];
    
    for (const student of students) {
      const recentAttendance = await Attendance.find({
        student: student._id,
        date: { $gte: sevenDaysAgo }
      })
      .select('date status subject')
      .sort('-date')
      .limit(7);

      studentsWithAttendance.push({
        _id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        phone: student.phone,
        currentStatus: attendanceMap[student._id.toString()] || null,
        recentAttendance: recentAttendance
      });
    }

    res.json({
      success: true,
      count: studentsWithAttendance.length,
      data: studentsWithAttendance
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get attendance for current student
// @route   GET /api/attendance/student
const getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subject, month, year } = req.query;

    const query = { student: studentId };

    if (subject) {
      query.subject = subject;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('markedBy', 'name')
      .sort('-date');

    const stats = await calculateStudentStats(studentId, subject);
    const subjectWise = await getSubjectWiseBreakdown(studentId);
    const monthlyBreakdown = await getMonthlyBreakdown(studentId);

    res.json({
      success: true,
      data: {
        attendance,
        stats,
        subjectWise,
        monthlyBreakdown
      }
    });

  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get attendance for specific student (Teacher view)
// @route   GET /api/attendance/student/:id
const getStudentAttendance = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { subject } = req.query;

    const student = await User.findById(studentId).select('-password');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const query = { student: studentId };
    if (subject) {
      query.subject = subject;
    }

    const attendance = await Attendance.find(query)
      .populate('markedBy', 'name')
      .sort('-date');

    const stats = await calculateStudentStats(studentId, subject);
    const subjectWise = await getSubjectWiseBreakdown(studentId);

    res.json({
      success: true,
      data: {
        student,
        attendance,
        stats,
        subjectWise
      }
    });

  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get attendance summary for a class (Teacher view)
// @route   GET /api/attendance/summary
const getAttendanceSummary = async (req, res) => {
  try {
    const { department, semester, subject, date } = req.query;

    if (!department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Department and semester are required'
      });
    }

    const query = {
      department,
      semester: parseInt(semester)
    };

    if (subject) query.subject = subject;
    
    if (date) {
      const normalizedDate = Attendance.normalizeDate(date);
      query.date = normalizedDate;
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('student', 'name rollNumber');

    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(function(r) { return r.status === 'present'; }).length;
    const absentCount = totalRecords - presentCount;

    res.json({
      success: true,
      data: {
        total: totalRecords,
        present: presentCount,
        absent: absentCount,
        percentage: totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : 0,
        records: attendanceRecords
      }
    });

  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get unique subjects for filters
// @route   GET /api/attendance/subjects
const getSubjects = async (req, res) => {
  try {
    const { department, semester } = req.query;

    const query = {};
    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);

    const subjects = await Attendance.distinct('subject', query);

    res.json({
      success: true,
      data: subjects.sort()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all attendance records (Teacher - View All)
// @route   GET /api/attendance/all
const getAllAttendanceRecords = async (req, res) => {
  try {
    const { department, semester, subject, startDate, endDate, page, limit } = req.query;

    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);
    if (subject) query.subject = subject;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const totalRecords = await Attendance.countDocuments(query);

    const records = await Attendance.find(query)
      .populate('student', 'name rollNumber department semester')
      .populate('markedBy', 'name')
      .sort('-date -createdAt')
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total: totalRecords,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalRecords / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

async function calculateStudentStats(studentId, subject) {
  const query = { student: studentId };
  if (subject) query.subject = subject;

  const total = await Attendance.countDocuments(query);
  const present = await Attendance.countDocuments({ ...query, status: 'present' });
  const absent = total - present;
  const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

  return {
    totalClasses: total,
    present,
    absent,
    percentage: parseFloat(percentage)
  };
}

async function getSubjectWiseBreakdown(studentId) {
  const subjects = await Attendance.distinct('subject', { student: studentId });

  const breakdown = [];
  for (const subject of subjects) {
    const stats = await calculateStudentStats(studentId, subject);
    breakdown.push({
      subject,
      ...stats
    });
  }

  return breakdown;
}

async function getMonthlyBreakdown(studentId) {
  const result = await Attendance.aggregate([
    { $match: { student: studentId } },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        total: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  ]);

  return result.map(function(item) {
    return {
      year: item._id.year,
      month: item._id.month,
      total: item.total,
      present: item.present,
      absent: item.total - item.present,
      percentage: ((item.present / item.total) * 100).toFixed(2)
    };
  });
}

async function checkAndNotifyLowAttendance(studentId, subject) {
  try {
    const stats = await calculateStudentStats(studentId, subject);

    if (stats.percentage < 75 && stats.totalClasses >= 5) {
      const student = await User.findById(studentId);

      if (student) {
        const message = '⚠️ Attendance Alert: ' + student.name + "'s attendance in " + subject + ' is ' + stats.percentage + '%. Minimum required is 75%.';

        if (student.phone) {
          await sendSMS(student.phone, message);
        }

        if (student.parentPhone) {
          await sendSMS(student.parentPhone, message);
        }

        console.log('📱 Low attendance alert sent for ' + student.name);
      }
    }
  } catch (error) {
    console.error('Notification error:', error.message);
  }
}

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = {
  markAttendance,
  getStudentsForAttendance,
  getMyAttendance,
  getStudentAttendance,
  getAttendanceSummary,
  getSubjects,
  getAllAttendanceRecords
};