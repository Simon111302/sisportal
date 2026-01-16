import { useState, useEffect } from 'react'
import AuthForm from './components/auth/AuthForm'
import Dashboard from './components/DashBoard/Dashboard'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    if (token) {
      setIsLoggedIn(true)
    }
  }, [])

  const handleLoginSuccess = () => {
    setIsLoggedIn(true)
  }

  return (
    <>
      {isLoggedIn ? (
        <Dashboard />
      ) : (
        <AuthForm onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  )
}

export default App
