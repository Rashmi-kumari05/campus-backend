const Marks = require('../models/Marks');
const User = require('../models/User');

// @desc    Get students for marks entry
// @route   GET /api/marks/students
// @access  Private (Teacher)
const getStudentsForMarks = async (req, res) => {
  try {
    const { department, semester, subject, examType } = req.query;

    if (!department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Please provide department and semester'
      });
    }

    // Fetch students
    const students = await User.find({
      role: 'student',
      department: department,
      semester: parseInt(semester),
      isActive: { $ne: false }
    })
    .select('name email rollNumber')
    .sort('rollNumber');

    // If subject and examType provided, fetch existing marks
    let marksMap = {};
    
    if (subject && examType) {
      const existingMarks = await Marks.find({
        department: department,
        semester: parseInt(semester),
        subject: subject,
        examType: examType
      });

      existingMarks.forEach(mark => {
        marksMap[mark.student.toString()] = {
          marksId: mark._id,
          marksObtained: mark.marksObtained,
          totalMarks: mark.totalMarks
        };
      });
    }

    // Combine students with existing marks
    const studentsWithMarks = students.map(student => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      existingMarks: marksMap[student._id.toString()] || null
    }));

    res.json({
      success: true,
      count: studentsWithMarks.length,
      data: studentsWithMarks
    });

  } catch (error) {
    console.error('Get students for marks error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload/Update marks (bulk)
// @route   POST /api/marks
// @access  Private (Teacher)
const uploadMarks = async (req, res) => {
  try {
    const { subject, examType, totalMarks, department, semester, academicYear, students } = req.body;

    // Validation
    if (!subject || !examType || !totalMarks || !department || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Please provide subject, examType, totalMarks, department, semester, and academicYear'
      });
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide students array with marks'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    // Process each student
    for (const studentData of students) {
      try {
        const { studentId, marksObtained } = studentData;

        if (!studentId || marksObtained === undefined || marksObtained === null || marksObtained === '') {
          results.errors.push(`Invalid data for student: ${studentId}`);
          continue;
        }

        // Validate marks
        const marks = parseFloat(marksObtained);
        if (isNaN(marks) || marks < 0 || marks > totalMarks) {
          results.errors.push(`Invalid marks for student ${studentId}: ${marksObtained}`);
          continue;
        }

        // Check if marks already exist for this student/subject/examType
        const existingMarks = await Marks.findOne({
          student: studentId,
          subject: subject,
          examType: examType
        });

        if (existingMarks) {
          // Update existing
          existingMarks.marksObtained = marks;
          existingMarks.totalMarks = totalMarks;
          existingMarks.academicYear = academicYear;
          existingMarks.uploadedBy = req.user._id;
          await existingMarks.save();
          results.updated++;
        } else {
          // Create new
          await Marks.create({
            student: studentId,
            subject: subject,
            examType: examType,
            marksObtained: marks,
            totalMarks: totalMarks,
            semester: parseInt(semester),
            department: department,
            academicYear: academicYear,
            uploadedBy: req.user._id
          });
          results.created++;
        }

      } catch (err) {
        results.errors.push(`Error for student ${studentData.studentId}: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `Marks saved. Created: ${results.created}, Updated: ${results.updated}`,
      data: results
    });

  } catch (error) {
    console.error('Upload marks error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my marks (Student)
// @route   GET /api/marks/student
// @access  Private (Student)
const getMyMarks = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subject, examType } = req.query;

    // Build query
    const query = { student: studentId };
    if (subject) query.subject = subject;
    if (examType) query.examType = examType;

    // Fetch marks
    const marks = await Marks.find(query)
      .populate('uploadedBy', 'name')
      .sort('-createdAt');

    // Calculate statistics
    const stats = calculateMarksStats(marks);

    // Get subject-wise breakdown
    const subjectWise = getSubjectWiseBreakdown(marks);

    // Get exam-type wise breakdown
    const examTypeWise = getExamTypeWiseBreakdown(marks);

    res.json({
      success: true,
      data: {
        marks,
        stats,
        subjectWise,
        examTypeWise
      }
    });

  } catch (error) {
    console.error('Get my marks error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student marks (Teacher view)
// @route   GET /api/marks/student/:id
// @access  Private (Teacher)
const getStudentMarks = async (req, res) => {
  try {
    const studentId = req.params.id;

    // Verify student exists
    const student = await User.findById(studentId).select('-password');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const marks = await Marks.find({ student: studentId })
      .populate('uploadedBy', 'name')
      .sort('-createdAt');

    const stats = calculateMarksStats(marks);
    const subjectWise = getSubjectWiseBreakdown(marks);

    res.json({
      success: true,
      data: {
        student,
        marks,
        stats,
        subjectWise
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get marks by class (Teacher view)
// @route   GET /api/marks/class
// @access  Private (Teacher)
const getClassMarks = async (req, res) => {
  try {
    const { department, semester, subject, examType } = req.query;

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
    if (examType) query.examType = examType;

    const marks = await Marks.find(query)
      .populate('student', 'name rollNumber email')
      .populate('uploadedBy', 'name')
      .sort('student.rollNumber');

    // Calculate class statistics
    const classStats = calculateClassStats(marks);

    res.json({
      success: true,
      data: {
        marks,
        stats: classStats
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update single marks entry
// @route   PUT /api/marks/:id
// @access  Private (Teacher)
const updateMarks = async (req, res) => {
  try {
    const { marksObtained } = req.body;

    const marks = await Marks.findById(req.params.id);

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: 'Marks record not found'
      });
    }

    // Validate
    const newMarks = parseFloat(marksObtained);
    if (isNaN(newMarks) || newMarks < 0 || newMarks > marks.totalMarks) {
      return res.status(400).json({
        success: false,
        message: `Marks must be between 0 and ${marks.totalMarks}`
      });
    }

    marks.marksObtained = newMarks;
    marks.uploadedBy = req.user._id;
    await marks.save();

    res.json({
      success: true,
      message: 'Marks updated successfully',
      data: marks
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete marks entry
// @route   DELETE /api/marks/:id
// @access  Private (Teacher)
const deleteMarks = async (req, res) => {
  try {
    const marks = await Marks.findById(req.params.id);

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: 'Marks record not found'
      });
    }

    await marks.deleteOne();

    res.json({
      success: true,
      message: 'Marks deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get unique subjects (for filters)
// @route   GET /api/marks/subjects
// @access  Private
const getSubjects = async (req, res) => {
  try {
    const { department, semester } = req.query;

    const query = {};
    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);

    const subjects = await Marks.distinct('subject', query);

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

// ==================== HELPER FUNCTIONS ====================

function calculateMarksStats(marks) {
  if (!marks || marks.length === 0) {
    return {
      totalExams: 0,
      totalMarksObtained: 0,
      totalMarksPossible: 0,
      percentage: 0
    };
  }

  const totalMarksObtained = marks.reduce((sum, m) => sum + m.marksObtained, 0);
  const totalMarksPossible = marks.reduce((sum, m) => sum + m.totalMarks, 0);
  const percentage = totalMarksPossible > 0 
    ? ((totalMarksObtained / totalMarksPossible) * 100).toFixed(2) 
    : 0;

  return {
    totalExams: marks.length,
    totalMarksObtained,
    totalMarksPossible,
    percentage: parseFloat(percentage)
  };
}

function getSubjectWiseBreakdown(marks) {
  const subjectMap = {};

  marks.forEach(mark => {
    if (!subjectMap[mark.subject]) {
      subjectMap[mark.subject] = {
        subject: mark.subject,
        exams: [],
        totalObtained: 0,
        totalPossible: 0
      };
    }

    subjectMap[mark.subject].exams.push({
      examType: mark.examType,
      marksObtained: mark.marksObtained,
      totalMarks: mark.totalMarks,
      percentage: ((mark.marksObtained / mark.totalMarks) * 100).toFixed(2)
    });

    subjectMap[mark.subject].totalObtained += mark.marksObtained;
    subjectMap[mark.subject].totalPossible += mark.totalMarks;
  });

  // Calculate percentage for each subject
  return Object.values(subjectMap).map(subject => ({
    ...subject,
    percentage: subject.totalPossible > 0 
      ? ((subject.totalObtained / subject.totalPossible) * 100).toFixed(2)
      : 0,
    grade: getGrade((subject.totalObtained / subject.totalPossible) * 100)
  }));
}

function getExamTypeWiseBreakdown(marks) {
  const examTypeMap = {};

  marks.forEach(mark => {
    if (!examTypeMap[mark.examType]) {
      examTypeMap[mark.examType] = {
        examType: mark.examType,
        count: 0,
        totalObtained: 0,
        totalPossible: 0
      };
    }

    examTypeMap[mark.examType].count++;
    examTypeMap[mark.examType].totalObtained += mark.marksObtained;
    examTypeMap[mark.examType].totalPossible += mark.totalMarks;
  });

  return Object.values(examTypeMap).map(item => ({
    ...item,
    percentage: item.totalPossible > 0 
      ? ((item.totalObtained / item.totalPossible) * 100).toFixed(2)
      : 0
  }));
}

function calculateClassStats(marks) {
  if (!marks || marks.length === 0) {
    return {
      totalStudents: 0,
      classAverage: 0,
      highest: 0,
      lowest: 0,
      passCount: 0,
      failCount: 0
    };
  }

  const marksValues = marks.map(m => (m.marksObtained / m.totalMarks) * 100);
  const passPercentage = 40; // Minimum passing percentage

  return {
    totalStudents: marks.length,
    classAverage: (marksValues.reduce((a, b) => a + b, 0) / marksValues.length).toFixed(2),
    highest: Math.max(...marksValues).toFixed(2),
    lowest: Math.min(...marksValues).toFixed(2),
    passCount: marksValues.filter(m => m >= passPercentage).length,
    failCount: marksValues.filter(m => m < passPercentage).length
  };
}

function getGrade(percentage) {
  const p = parseFloat(percentage);
  if (isNaN(p)) return 'F';
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  if (p >= 40) return 'E';
  return 'F';
}
// @desc    Get all marks records (Teacher - View All)
// @route   GET /api/marks/all
const getAllMarksRecords = async (req, res) => {
  try {
    const { department, semester, subject, examType, page, limit } = req.query;

    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);
    if (subject) query.subject = subject;
    if (examType) query.examType = examType;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const totalRecords = await Marks.countDocuments(query);

    const records = await Marks.find(query)
      .populate('student', 'name rollNumber department semester')
      .populate('uploadedBy', 'name')
      .sort('-createdAt')
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
    console.error('Get all marks error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = {
  getStudentsForMarks,
  uploadMarks,
  getMyMarks,
  getStudentMarks,
  getClassMarks,
  updateMarks,
  deleteMarks,
  getSubjects,
  getAllMarksRecords    // <-- ADD THIS
};