const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');

// POST /api/attendance/:studentId/mark
router.post('/:studentId/mark', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.body;
    
    if (!['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const attendance = new Attendance({ studentId, status });
    await attendance.save();
    
    console.log('✅ Attendance marked:', status, 'for', studentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Attendance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
