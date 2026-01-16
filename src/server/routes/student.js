const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

router.get('/', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const exists = await Student.findOne({ $or: [{ username: cleanUsername }, { email: cleanEmail }] });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Username or email exists' });
    }
    const student = new Student({ username: cleanUsername, email: cleanEmail, password });
    const saved = await student.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Student.findByIdAndDelete(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.patch('/:id/attendance', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { attendance: status, attendanceUpdatedAt: new Date() },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
