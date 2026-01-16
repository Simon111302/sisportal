const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,     // probelenia09@gmail.com
    pass: process.env.EMAIL_PASS,     // scgwldimftejzval
  },
});

// ✅ ADDED: sendPasswordResetEmail (matches your server.js)
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  const mailOptions = {
    from: `"SIS Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔑 SIS Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Reset Your SIS Password</h2>
        <p>You requested a password reset. Click below (valid 1 hour):</p>
        <a href="${resetUrl}" 
           style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
        <br><br>
        <p><small>Or copy: <code>${resetUrl}</code></small></p>
        <p style="color: #666;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  };
  
  await transporter.sendMail(mailOptions);
  console.log(`✅ Reset email sent to ${email}`);
};

// Keep your existing functions
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"SIS Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔔 Your SIS OTP Code',
    html: `<h1 style="color:#667eea;font-size:3em;">${otp}</h1><p>Valid 10 min</p>`,
  };
  await transporter.sendMail(mailOptions);
  console.log(`✅ OTP sent to ${email}`);
};

const sendNewPasswordEmail = async (email, newPassword) => {
  const mailOptions = {
    from: `"SIS Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔑 New SIS Password',
    html: `<h2>New Password: <strong>${newPassword}</strong></h2><p>Login now!</p>`,
  };
  await transporter.sendMail(mailOptions);
  console.log(`✅ Password sent to ${email}`);
};

// ✅ Export ALL functions your server.js needs
module.exports = {
  sendPasswordResetEmail,  // ← FIXES your error
  sendOTPEmail,
  sendNewPasswordEmail,
};
