const User = require('../models/User');

// @desc    Get all students
// @route   GET /api/users/students
// @access  Private (Teacher only)
const getStudents = async (req, res) => {
  try {
    const { department, semester, search } = req.query;

    // Build query
    const query = { role: 'student' };

    if (department) {
      query.department = department;
    }

    if (semester) {
      query.semester = parseInt(semester);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(query)
      .select('-password')
      .sort({ rollNumber: 1, name: 1 });

    res.json({
      success: true,
      count: students.length,
      data: students
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single student
// @route   GET /api/users/students/:id
// @access  Private (Teacher only)
const getStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add new student
// @route   POST /api/users/students
// @access  Private (Teacher only)
const addStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, department, semester, phone, parentPhone } = req.body;

    // Validation
    if (!name || !email || !password || !rollNumber || !department || !semester || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, rollNumber, department, semester, phone'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if roll number already exists
    const existingRoll = await User.findOne({ rollNumber: rollNumber.toUpperCase() });
    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: 'Roll number already exists'
      });
    }

    // Create student
    const student = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      rollNumber: rollNumber.toUpperCase(),
      department,
      semester: parseInt(semester),
      phone,
      parentPhone,
      role: 'student'
    });

    // Remove password from response
    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: studentResponse
    });

  } catch (error) {
    console.error('Add student error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add multiple students (bulk)
// @route   POST /api/users/students/bulk
// @access  Private (Teacher only)
const addStudentsBulk = async (req, res) => {
  try {
    const { students } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of students'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const studentData of students) {
      try {
        const { name, email, password, rollNumber, department, semester, phone, parentPhone } = studentData;

        // Basic validation
        if (!name || !email || !password || !rollNumber || !department || !semester || !phone) {
          results.failed.push({
            data: studentData,
            error: 'Missing required fields'
          });
          continue;
        }

        // Check existing
        const existing = await User.findOne({
          $or: [
            { email: email.toLowerCase() },
            { rollNumber: rollNumber.toUpperCase() }
          ]
        });

        if (existing) {
          results.failed.push({
            data: studentData,
            error: 'Email or Roll Number already exists'
          });
          continue;
        }

        // Create student
        const student = await User.create({
          name,
          email: email.toLowerCase(),
          password,
          rollNumber: rollNumber.toUpperCase(),
          department,
          semester: parseInt(semester),
          phone,
          parentPhone,
          role: 'student'
        });

        results.success.push({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber
        });

      } catch (err) {
        results.failed.push({
          data: studentData,
          error: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Added ${results.success.length} students, ${results.failed.length} failed`,
      data: results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/users/students/:id
// @access  Private (Teacher only)
const updateStudent = async (req, res) => {
  try {
    const { name, email, rollNumber, department, semester, phone, parentPhone, isActive } = req.body;

    const student = await User.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== student.email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Check roll number uniqueness if changed
    if (rollNumber && rollNumber.toUpperCase() !== student.rollNumber) {
      const existingRoll = await User.findOne({ rollNumber: rollNumber.toUpperCase() });
      if (existingRoll) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists'
        });
      }
    }

    // Update fields
    if (name) student.name = name;
    if (email) student.email = email.toLowerCase();
    if (rollNumber) student.rollNumber = rollNumber.toUpperCase();
    if (department) student.department = department;
    if (semester) student.semester = parseInt(semester);
    if (phone) student.phone = phone;
    if (parentPhone !== undefined) student.parentPhone = parentPhone;
    if (isActive !== undefined) student.isActive = isActive;

    await student.save();

    const studentResponse = student.toObject();
    delete studentResponse.password;

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: studentResponse
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/users/students/:id
// @access  Private (Teacher only)
const deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (student.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete student accounts'
      });
    }

    await student.deleteOne();

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reset student password
// @route   PUT /api/users/students/:id/reset-password
// @access  Private (Teacher only)
const resetStudentPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const student = await User.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    student.password = newPassword;
    await student.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get departments list
// @route   GET /api/users/departments
// @access  Private
const getDepartments = async (req, res) => {
  try {
    const departments = [
      'Computer Science',
      'Electronics',
      'Mechanical',
      'Civil',
      'Electrical'
    ];

    res.json({
      success: true,
      data: departments
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Export all functions
module.exports = {
  getStudents,
  getStudent,
  addStudent,
  addStudentsBulk,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  getDepartments
};