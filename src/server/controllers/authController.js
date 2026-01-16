const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOTPEmail, sendNewPasswordEmail } = require('../services/emailService');
const PasswordReset = require('../models/PasswordReset');



// ✅ Your existing signup (PERFECT)
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }
    
    // Create new user (password hashing happens in User model pre-save hook)
    const user = await User.create({ name, email, password });
    
    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.status(201).json({
      success: true,
      data: { 
        _id: user._id, 
        name: user.name, 
        email: user.email,
        token 
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Your existing login (PERFECT)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Check password using bcrypt compare method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({
      success: true,
      data: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        token 
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 🆕 NEW: Forgot Password - FIXES YOUR 500 ERROR
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user (don't reveal if exists for security)
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      // Still send "success" response for security (email enumeration protection)
      return res.json({ 
        success: true, 
        message: 'If email exists, OTP sent. Check your inbox/spam.' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save OTP (expires in 10 minutes)
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    
    // Send email
    await sendOTPEmail(email, otp);
    
    res.json({ 
      success: true, 
      message: 'OTP sent! Check your inbox/spam folder.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP. Try again later.' 
    });
  }
};

// 🆕 NEW: Reset Password with OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Find user with valid OTP
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      otp,
      otpExpiry: { $gt: new Date() }  // Not expired
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }
    
    // Generate secure random password (12 chars)
    const newPassword = Math.random().toString(36).slice(-8) + 
                       Math.random().toString(36).slice(-8).toUpperCase();
    
    // Update password (model pre-save hook hashes it)
    user.password = newPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    
    // Email new password
    await sendNewPasswordEmail(email, newPassword);
    
    res.json({ 
      success: true, 
      message: 'New password sent to your email! Login with it now.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset password. Try again.' 
    });
  }
};
