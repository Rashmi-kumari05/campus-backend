const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const Material = require('../models/Material');

// @desc    Get teacher dashboard data
// @route   GET /api/dashboard/teacher
// @access  Private (Teacher)
const getTeacherDashboard = async (req, res) => {
  try {
    // Get total counts
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalMaterials = await Material.countDocuments();

    // Get today's date (start and end)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's attendance stats
    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    });

    const todayPresent = todayAttendance.filter(a => a.status === 'present').length;
    const todayAbsent = todayAttendance.filter(a => a.status === 'absent').length;

    // Get recent attendance records (last 10)
    const recentAttendance = await Attendance.find()
      .populate('student', 'name rollNumber')
      .populate('markedBy', 'name')
      .sort('-createdAt')
      .limit(10);

    // Get recent marks (last 10)
    const recentMarks = await Marks.find()
      .populate('student', 'name rollNumber')
      .populate('uploadedBy', 'name')
      .sort('-createdAt')
      .limit(10);

    // Get department-wise student count
    const departmentStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get low attendance students (below 75%)
    const studentsWithLowAttendance = await getLowAttendanceStudents();

    res.json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalTeachers,
          totalMaterials,
          todayPresent,
          todayAbsent,
          todayTotal: todayAttendance.length
        },
        recentAttendance,
        recentMarks,
        departmentStats,
        lowAttendanceStudents: studentsWithLowAttendance
      }
    });

  } catch (error) {
    console.error('Teacher dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student dashboard data
// @route   GET /api/dashboard/student
// @access  Private (Student)
const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get attendance stats
    const totalAttendance = await Attendance.countDocuments({ student: studentId });
    const presentCount = await Attendance.countDocuments({ student: studentId, status: 'present' });
    const absentCount = totalAttendance - presentCount;
    const attendancePercentage = totalAttendance > 0 
      ? ((presentCount / totalAttendance) * 100).toFixed(2) 
      : 0;

    // Get marks stats
    const allMarks = await Marks.find({ student: studentId });
    const totalMarksObtained = allMarks.reduce((sum, m) => sum + m.marksObtained, 0);
    const totalMarksPossible = allMarks.reduce((sum, m) => sum + m.totalMarks, 0);
    const marksPercentage = totalMarksPossible > 0 
      ? ((totalMarksObtained / totalMarksPossible) * 100).toFixed(2) 
      : 0;

    // Get recent attendance (last 7)
    const recentAttendance = await Attendance.find({ student: studentId })
      .populate('markedBy', 'name')
      .sort('-date')
      .limit(7);

    // Get recent marks (last 5)
    const recentMarks = await Marks.find({ student: studentId })
      .populate('uploadedBy', 'name')
      .sort('-createdAt')
      .limit(5);

    // Get subject-wise attendance
    const subjectAttendance = await Attendance.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: '$subject',
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }
        }
      }
    ]);

    const subjectWiseAttendance = subjectAttendance.map(s => ({
      subject: s._id,
      total: s.total,
      present: s.present,
      percentage: ((s.present / s.total) * 100).toFixed(2)
    }));

    // Get available materials count
    const materialsCount = await Material.countDocuments({
      department: req.user.department,
      semester: req.user.semester
    });

    res.json({
      success: true,
      data: {
        stats: {
          attendancePercentage: parseFloat(attendancePercentage),
          totalClasses: totalAttendance,
          presentCount,
          absentCount,
          marksPercentage: parseFloat(marksPercentage),
          totalExams: allMarks.length,
          materialsCount
        },
        recentAttendance,
        recentMarks,
        subjectWiseAttendance
      }
    });

  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to get students with low attendance
async function getLowAttendanceStudents() {
  try {
    const students = await User.find({ role: 'student' }).select('name rollNumber department semester');
    const lowAttendance = [];

    for (const student of students) {
      const total = await Attendance.countDocuments({ student: student._id });
      if (total >= 5) { // Only check if they have at least 5 classes
        const present = await Attendance.countDocuments({ student: student._id, status: 'present' });
        const percentage = ((present / total) * 100).toFixed(2);
        
        if (percentage < 75) {
          lowAttendance.push({
            student: {
              _id: student._id,
              name: student.name,
              rollNumber: student.rollNumber,
              department: student.department,
              semester: student.semester
            },
            percentage: parseFloat(percentage),
            total,
            present
          });
        }
      }
    }

    return lowAttendance.sort((a, b) => a.percentage - b.percentage).slice(0, 5);
  } catch (error) {
    console.error('Low attendance error:', error);
    return [];
  }
}

module.exports = {
  getTeacherDashboard,
  getStudentDashboard
};