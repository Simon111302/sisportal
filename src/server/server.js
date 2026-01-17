const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

require('dotenv').config();

const Student = require('./models/Student');
const sendPasswordResetEmail = require('./services/emailService').sendPasswordResetEmail;
const sendOTPEmail = require('./services/emailService').sendOTPEmail;

const app = express();

// MOVE RATE LIMIT TO TOP (before routes)
const rateLimit = require('express-rate-limit');
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many OTP requests. Try again in 15min.' },
  keyGenerator: (req) => req.body.email
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/SIS')
  .then(async () => {
    console.log('✅ MongoDB Connected');
    try {
      await Student.collection.dropIndex('studentId_1');
      console.log('Deleted studentId_1 index');
    } catch (error) {
      console.log('Index already gone or never existed');
    }
  })
  .catch(err => console.error('MongoDB Error:', err));

// ==================== USER MODEL ====================
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'Admin' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ==================== PASSWORD RESET MODEL ====================
const PasswordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  token: { type: String, required: true }, // OTP stored as plain string
  expiresAt: { type: Date, required: true }
}, { collection: 'passwordresets' });

const PasswordReset = mongoose.models.PasswordReset || mongoose.model('PasswordReset', PasswordResetSchema);

// ==================== ATTENDANCE MODEL ====================
const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  date: { type: Date, default: Date.now }
}, { collection: 'attendances', timestamps: true });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

// ==================== AUTH MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yoursupersecretjwtkeychangethisinproduction2026');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// ==================== AUTH ROUTES ====================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('SIGNUP REQUEST:', req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword
    });

    const savedUser = await newUser.save();
    console.log('USER REGISTERED:', savedUser.email);

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now log in.',
      data: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email
      }
    });
  } catch (error) {
    console.error('SIGNUP ERROR:', error);
    res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('LOGIN REQUEST:', req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'yoursupersecretjwtkeychangethisinproduction2026',
      { expiresIn: '7d' }
    );

    console.log('LOGIN SUCCESS:', user.email);
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        token
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// FORGOT PASSWORD - OTP
app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    console.log('Forgot password:', req.body.email);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ success: true, message: 'If email exists, OTP sent.' });
    }

    // 6-DIGIT OTP (stored as plain string)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await PasswordReset.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        token: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      },
      { upsert: true }
    );

    await sendOTPEmail(user.email, otp);
    console.log(`OTP ${otp} sent to ${user.email}`);

    res.json({ success: true, message: '6-digit OTP sent to your email!' });
  } catch (error) {
    console.error('Forgot error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// RESET PASSWORD - OTP (NO HASHING!)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    console.log('Reset password:', req.body);
    const { token: otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'OTP and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // FIND OTP (plain string comparison)
    const resetRecord = await PasswordReset.findOne({
      token: otp, // Compare plain OTP
      expiresAt: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(resetRecord.userId, { password: hashedPassword });
    await PasswordReset.deleteOne({ _id: resetRecord._id });

    console.log('Password reset successful');
    res.json({ success: true, message: 'Password reset! You can now login.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// ==================== STUDENT ROUTES ====================

// ✅ GET students with LATEST attendance (not just today)
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const students = await Student.find({ ownerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    // Get the MOST RECENT attendance for each student
    const studentsWithAttendance = await Promise.all(
      students.map(async (student) => {
        const latestAttendance = await Attendance.findOne({
          studentId: student._id
        })
        .sort({ date: -1 }) // Most recent first
        .lean();

        return {
          ...student,
          attendance: latestAttendance?.status || null,
          attendanceUpdatedAt: latestAttendance?.date || null
        };
      })
    );

    res.json({ success: true, data: studentsWithAttendance });
  } catch (error) {
    console.error('GET students error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// POST - Add new student
app.post('/api/students', authenticateToken, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'All fields required (password >= 6 chars)' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const student = new Student({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      ownerId: req.userId
    });

    const saved = await student.save();
    console.log('NEW STUDENT:', saved.username);

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('POST student:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create student' });
  }
});

// POST - Mark attendance (ONE RECORD PER DAY - UPDATE IF EXISTS)
app.post('/api/students/:id/attendance', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const student = await Student.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // ✅ Get today's start and end (12:00 AM to 11:59 PM)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // ✅ Check if attendance already exists for today
    const existingAttendance = await Attendance.findOne({
      studentId: req.params.id,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    if (existingAttendance) {
      // ✅ UPDATE existing record
      existingAttendance.status = status;
      existingAttendance.date = new Date(); // Update timestamp
      await existingAttendance.save();
      
      console.log('✅ Updated attendance:', status, 'for', student.username);
      
      res.json({ 
        success: true, 
        message: `Updated to ${status.toUpperCase()}`,
        data: existingAttendance 
      });
    } else {
      // ✅ CREATE new record (first time today)
      const attendance = new Attendance({
        studentId: req.params.id,
        status,
        date: new Date()
      });
      await attendance.save();
      
      console.log('✅ Created attendance:', status, 'for', student.username);
      
      res.json({ 
        success: true, 
        message: `Marked as ${status.toUpperCase()}`,
        data: attendance 
      });
    }
  } catch (error) {
    console.error('Attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to save attendance' });
  }
});



// GET attendance history for a student
app.get('/api/students/:id/attendance/history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const student = await Student.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const records = await Attendance.find({ studentId: req.params.id })
      .sort({ date: -1 })
      .limit(parseInt(days))
      .lean();

    res.json({ 
      success: true, 
      data: {
        student: { username: student.username, email: student.email },
        records
      }
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

// DELETE student
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);
    // Also delete all attendance records
    await Attendance.deleteMany({ studentId: req.params.id });
    
    console.log('DELETED:', student.username);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err.message);
  res.status(500).json({ success: false, message: 'Server error' });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
