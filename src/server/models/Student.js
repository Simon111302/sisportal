const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  grade: {
    type: String,
    enum: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
    default: 'Grade 10'
  },
  attendance: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: null
  },
  attendanceUpdatedAt: {
    type: Date,
    default: null
  },
  // ✅ NEW FIELD - Link student to their teacher
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  collection: 'Student', 
  timestamps: true 
});

module.exports = mongoose.model('Student', studentSchema);
