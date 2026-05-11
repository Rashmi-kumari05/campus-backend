const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const Material = require('../models/Material');

// @desc    Handle chatbot queries
// @route   POST /api/chatbot
// @access  Private
exports.handleQuery = async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user._id;

    // Simple keyword-based responses
    const lowerQuery = query.toLowerCase();

    let response = '';

    // Attendance queries
    if (lowerQuery.includes('attendance')) {
      response = await getAttendanceResponse(userId);
    }
    // Marks queries
    else if (lowerQuery.includes('marks') || lowerQuery.includes('score') || lowerQuery.includes('result')) {
      response = await getMarksResponse(userId);
    }
    // Materials queries
    else if (lowerQuery.includes('material') || lowerQuery.includes('notes') || lowerQuery.includes('pdf')) {
      response = await getMaterialsResponse(userId);
    }
    // General queries
    else if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      response = `Hello ${req.user.name}! How can I help you today? You can ask about:\n- Your attendance\n- Your marks\n- Study materials\n- Assignments`;
    }
    else if (lowerQuery.includes('help')) {
      response = `I can help you with:\n\n📊 Attendance - "What's my attendance?"\n📝 Marks - "Show my marks"\n📚 Materials - "Show study materials"\n📋 Assignments - "Any pending assignments?"`;
    }
    else {
      response = "I'm sorry, I didn't understand that. Try asking about attendance, marks, or study materials.";
    }

    res.json({
      query,
      response,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function for attendance responses
async function getAttendanceResponse(userId) {
  const total = await Attendance.countDocuments({ student: userId });
  const present = await Attendance.countDocuments({ 
    student: userId, 
    status: 'present' 
  });

  if (total === 0) {
    return "No attendance records found yet.";
  }

  const percentage = ((present / total) * 100).toFixed(2);
  
  let response = `📊 Your Attendance Summary:\n\n`;
  response += `Total Classes: ${total}\n`;
  response += `Present: ${present}\n`;
  response += `Absent: ${total - present}\n`;
  response += `Percentage: ${percentage}%\n\n`;

  if (percentage < 75) {
    response += `⚠️ Warning: Your attendance is below 75%. Please improve!`;
  } else {
    response += `✅ Great! Your attendance is above the minimum requirement.`;
  }

  return response;
}

// Helper function for marks responses
async function getMarksResponse(userId) {
  const marks = await Marks.find({ student: userId }).sort('-createdAt').limit(5);

  if (marks.length === 0) {
    return "No marks records found yet.";
  }

  let response = `📝 Your Recent Marks:\n\n`;

  marks.forEach((mark, index) => {
    const percentage = ((mark.marksObtained / mark.totalMarks) * 100).toFixed(2);
    response += `${index + 1}. ${mark.subject} (${mark.examType})\n`;
    response += `   Score: ${mark.marksObtained}/${mark.totalMarks} (${percentage}%)\n\n`;
  });

  // Calculate overall average
  const totalObtained = marks.reduce((sum, m) => sum + m.marksObtained, 0);
  const totalPossible = marks.reduce((sum, m) => sum + m.totalMarks, 0);
  const overall = ((totalObtained / totalPossible) * 100).toFixed(2);

  response += `Overall Average: ${overall}%`;

  return response;
}

// Helper function for materials responses
async function getMaterialsResponse(userId) {
  const user = await User.findById(userId);
  
  const materials = await Material.find({
    department: user.department,
    semester: user.semester
  }).sort('-createdAt').limit(5);

  if (materials.length === 0) {
    return "No study materials available yet.";
  }

  let response = `📚 Recent Study Materials:\n\n`;

  materials.forEach((material, index) => {
    response += `${index + 1}. ${material.title}\n`;
    response += `   Subject: ${material.subject}\n`;
    response += `   Type: ${material.type}\n`;
    response += `   Downloads: ${material.downloads}\n\n`;
  });

  response += `Visit the Materials section to download these files.`;

  return response;
}

module.exports = exports;