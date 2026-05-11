const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createClerkClient, verifyToken } = require('@clerk/backend');

// Initialize Clerk client
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department, semester, phone, parentPhone } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      rollNumber,
      department,
      semester,
      phone,
      parentPhone
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        semester: user.semester,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  res.json(req.user);
};

// @desc    Exchange Clerk session token for custom JWT (Login via Clerk)
// @route   POST /api/auth/clerk-exchange
// @access  Public
exports.clerkExchange = async (req, res) => {
  try {
    // Get Clerk token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No Clerk token provided' });
    }
    const clerkToken = authHeader.split(' ')[1];

    // Verify the Clerk token and get claims
    let payload;
    try {
      // In @clerk/backend v3+, verifyToken is a standalone function
      payload = await verifyToken(clerkToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 5000 
      });
    } catch (err) {
      console.error('Clerk verification error:', err);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired Clerk token',
        error: err.message
      });
    }

    // Get full Clerk user info using the subject (user ID)
    const clerkUser = await clerkClient.users.getUser(payload.sub);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      return res.status(400).json({ success: false, message: 'No email found in Clerk account' });
    }

    // Find the user in our MongoDB database
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // User not in our DB yet — they need to complete profile
      return res.status(404).json({
        success: false,
        message: 'USER_NOT_FOUND',
        clerkEmail: email,
        clerkName: clerkUser.firstName + ' ' + (clerkUser.lastName || '')
      });
    }

    // Issue our custom JWT
    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      semester: user.semester,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error('Clerk exchange error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register new user via Clerk + campus profile data
// @route   POST /api/auth/clerk-register
// @access  Public
exports.clerkRegister = async (req, res) => {
  try {
    // Get Clerk token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No Clerk token provided' });
    }
    const clerkToken = authHeader.split(' ')[1];

    // Verify Clerk token
    let payload;
    try {
      // In @clerk/backend v3+, verifyToken is a standalone function
      payload = await verifyToken(clerkToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
        clockSkewInMs: 5000
      });
    } catch (err) {
      console.error('Clerk registration verification error:', err);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired Clerk token',
        error: err.message 
      });
    }

    // Get Clerk user info
    const clerkUser = await clerkClient.users.getUser(payload.sub);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const clerkName = clerkUser.firstName + ' ' + (clerkUser.lastName || '');

    if (!email) {
      return res.status(400).json({ success: false, message: 'No email found in Clerk account' });
    }

    // Check if user already exists in MongoDB
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Already registered — just return a token
      return res.json({
        success: true,
        _id: existing._id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        department: existing.department,
        semester: existing.semester,
        token: generateToken(existing._id)
      });
    }

    // Get campus profile fields from request body
    const { role, department, phone, rollNumber, semester, parentPhone } = req.body;
    const name = req.body.name || clerkName.trim() || 'User';

    if (!role || !department || !phone) {
      return res.status(400).json({ success: false, message: 'Please provide role, department and phone' });
    }

    if (role === 'student' && (!rollNumber || !semester)) {
      return res.status(400).json({ success: false, message: 'Students must provide roll number and semester' });
    }

    // Create user in MongoDB (with a random password since auth is via Clerk)
    const randomPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: randomPassword,
      role,
      department,
      phone,
      ...(role === 'student' && { rollNumber, semester: parseInt(semester), parentPhone })
    });

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      semester: user.semester,
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error('Clerk register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};