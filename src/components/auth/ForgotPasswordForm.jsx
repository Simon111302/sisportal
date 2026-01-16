import { useState } from 'react';
import axios from 'axios';



export default function ForgotPasswordForm({ onClose }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateStep2 = () => {
    setOtpError(''); setPasswordError('');
    let isValid = true;

    // ✅ OTP Validation
    if (!otp.trim()) {
      setOtpError('Please enter 6-digit OTP');
      isValid = false;
    } else if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setOtpError('OTP must be exactly 6 digits');
      isValid = false;
    }

    // ✅ Password Validation
    if (!newPassword.trim()) {
      setPasswordError('Please enter new password');
      isValid = false;
    } else if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (step === 2 && !validateStep2()) return;
    
    setLoading(true);
    setMessage('');

    try {
      if (step === 1) {
        await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
        setMessage('✅ Check your email for OTP!');
        setStep(2);
      } else {
        await axios.post(`${API_URL}/api/auth/reset-password`, {
          token: otp,
          newPassword
        });
        setMessage('✅ Password reset successfully!');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Something went wrong';
      setMessage(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setOtpError('');
    setPasswordError('');
    setMessage('');
  };

  return (
    <div className="forgot-modal" onClick={onClose}>
      <div className="forgot-overlay"></div>
      <div className="forgot-card" onClick={(e) => e.stopPropagation()}>
        <button className="forgot-close" onClick={onClose}>×</button>
        
        <div className="forgot-header">
          <h2>{step === 3 ? 'Success!' : 'Forgot Password'}</h2>
          {step === 2 && <button className="back-button" onClick={handleBack}>← Back</button>}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="input-group">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="forgot-input"
                required
              />
            </div>
          )}
          
          {step === 2 && (
            <>
              <div className="input-group">
                <input 
                  type="text" 
                  value={otp} 
                  onChange={(e) => {
                    setOtp(e.target.value);
                    if (otpError) setOtpError(''); // Clear error on type
                  }}
                  placeholder="Enter 6-digit OTP"
                  maxLength="6"
                  className={`forgot-input ${otpError ? 'error' : ''}`}
                  autoFocus
                />
                {otpError && <div className="error-message">{otpError}</div>}
              </div>
              
              <div className="input-group">
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="New Password (min 6 chars)"
                  className={`forgot-input ${passwordError ? 'error' : ''}`}
                  minLength="6"
                />
                {passwordError && <div className="error-message">{passwordError}</div>}
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            className="forgot-submit" 
            disabled={loading || (step === 2 && (!otp || otp.length !== 6 || newPassword.length < 6))}
          >
            {loading ? 'Loading...' : step === 1 ? 'Send OTP' : 'Reset Password'}
          </button>
          
          {message && (
            <div className={`forgot-message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </form>

        {step === 3 && (
          <div className="success-info">
            <p>Your password has been reset successfully!</p>
            <p>You can now log in with your new password.</p>
          </div>
        )}
      </div>
    </div>
  );
}
