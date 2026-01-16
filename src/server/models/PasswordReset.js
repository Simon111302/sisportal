const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    ref: 'User' 
  },
  token: { type: String, required: true },  // OTP or reset token
  expiresAt: { type: Date, required: true }
}, { collection: 'password_resets', timestamps: true });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
