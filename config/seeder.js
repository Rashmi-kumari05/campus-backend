const User = require('../models/User');

// Demo Teacher
const demoTeacher = {
  name: 'Dr. Sharma',
  email: 'teacher@test.com',
  password: '123456',
  role: 'teacher',
  department: 'Computer Science',
  phone: '9999999999'
};

// Demo Students with 11-digit Registration Numbers
const demoStudents = [
  {
    name: 'student Kumar',
    email: 'student@test.com',
    password: '123456',
    role: 'student',
    rollNumber: '32151144001',
    department: 'Computer Science',
    semester: 5,
    phone: '9876543001',
    parentPhone: '9876543101'
  },
  {
    name: 'student kumari',
    email: 'priya@test.com',
    password: '123456',
    role: 'student',
    rollNumber: '32151144002',
    department: 'Computer Science',
    semester: 5,
    phone: '9876543002',
    parentPhone: '9876543102'
  },
  
  
];

const seedDemoAccounts = async () => {
  try {
    console.log('🌱 Seeding demo accounts...');

    // Create/Check Teacher
    const existingTeacher = await User.findOne({ email: demoTeacher.email });
    if (!existingTeacher) {
      await User.create(demoTeacher);
      console.log('✅ Created demo teacher: ' + demoTeacher.email);
    } else {
      console.log('ℹ️  Demo teacher exists: ' + demoTeacher.email);
    }

    // Create or UPDATE demo students (upsert by email)
    let createdCount = 0;
    let updatedCount = 0;

    for (const student of demoStudents) {
      const existing = await User.findOne({ email: student.email });
      if (!existing) {
        await User.create(student);
        createdCount++;
      } else {
        // Update fields like rollNumber and name if they changed
        await User.findOneAndUpdate(
          { email: student.email },
          { $set: { name: student.name, rollNumber: student.rollNumber, department: student.department, semester: student.semester, phone: student.phone, parentPhone: student.parentPhone } }
        );
        updatedCount++;
      }
    }

    if (createdCount > 0) {
      console.log('✅ Created ' + createdCount + ' demo students');
    }
    if (updatedCount > 0) {
      console.log('🔄 Updated ' + updatedCount + ' demo students');
    }

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('📋 DEMO CREDENTIALS:');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('👨‍🏫 TEACHER:');
    console.log('   Email:    teacher@test.com');
    console.log('   Password: 123456');
    console.log('');
    console.log('👨‍🎓 STUDENTS:');
    console.log('   Email:    student@test.com');
    console.log('   Password: 123456');
    console.log('   Reg No:   32151144001');
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ Seeder error:', error.message);
  }
};

module.exports = seedDemoAccounts;