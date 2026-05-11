const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
 rollNumber: {
  type: String,
  unique: true,
  sparse: true,
  required: function () {
    return this.role === 'student';
  }
},
  department: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    min: 1,
    max: 8
  },
  phone: {
    type: String,
    required: true
  },
  parentPhone: {
    type: String // For SMS alerts
  },
  profilePicture: {
    type: String,
    default: '/assets/images/default-avatar.png'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);