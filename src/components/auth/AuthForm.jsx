import { useState } from 'react'
import axios from 'axios'
import LoginForm from './LoginForm'
import SignUpForm from './SignUpForm'
import '../../design/AuthForm.css'
import API_URL from '../../server/config/api'
import ForgotPasswordForm from './ForgotPasswordForm' 

function AuthForm({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleLogin = async (formData) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password
      })
      
      console.log('Login successful:', response.data)
      
      localStorage.setItem('token', response.data.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.data))
      
      onLoginSuccess()
      
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed'
      alert(errorMessage)
      console.error('Login error:', error)
    }
  }

  const handleSignUp = async (formData) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        name: formData.name,
        email: formData.email,
        password: formData.password
      })
      
      console.log('Signup successful:', response.data)
      
      setShowSuccessMessage(true)
      setCountdown(3)
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            setShowSuccessMessage(false)
            setIsSignUp(false)
            setCountdown(0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Signup failed'
      alert(errorMessage)
      console.error('Signup error:', error)
    }
  }

  const toggleForm = () => {
    setIsSignUp(!isSignUp)
    setShowSuccessMessage(false)
    setCountdown(0)
    setShowForgotPassword(false) // Close forgot modal when switching
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {showSuccessMessage ? (
          <div className="success-message">
            <div className="success-header">
              <h1>✓ Registration Successful!</h1>
            </div>
            <p className="subtitle">
              You can now log in with your credentials. 
              Redirecting in <span id="countdown">{countdown || 0}</span>s
            </p>
          </div>
        ) : (
          <>
            <h1>{isSignUp ? 'Create Account' : 'Sams Portal'}</h1>
            <p className="subtitle">
              {isSignUp 
                ? 'Sign up to get started with your account' 
                : 'Please enter your credentials to continue'}
            </p>
            
            {isSignUp ? (
              <SignUpForm onSubmit={handleSignUp} />
            ) : (
              <LoginForm 
                onSubmit={handleLogin}
                onForgotPassword={() => setShowForgotPassword(true)}
              />
            )}

            <div className="signup-prompt">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); toggleForm(); }}>
                {isSignUp ? 'Log in' : 'Sign up'}
              </a>
            </div>
          </>
        )}
      </div>

      {showForgotPassword && (
        <ForgotPasswordForm 
          onClose={() => setShowForgotPassword(false)} 
        />
      )}
    </div>
  )
}

export default AuthForm
