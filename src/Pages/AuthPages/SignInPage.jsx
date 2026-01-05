import React, { useState } from 'react';
import { Book } from 'lucide-react';
import './AuthPages.css';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = "http://localhost:8000";

const SignInPage = () => {
  const navigate = useNavigate();
  
  // View state: 'signin' | 'signup' | 'reset'
  const [view, setView] = useState('signin');
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear error on typing
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const { username, password, confirmPassword } = formData;
    
    if (!username || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    // --- 1. SIGN IN LOGIC ---
    if (view === 'signin') {
      // const users = getUsers();
      try {
          const response = await fetch(`${API_BASE_URL}/userauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              username: formData.username,
              password: formData.password
            })
          });

          const data = await response.json();
      
        if (data.result === "1") {
              // Success: store token or username and password
              localStorage.setItem('currentUser', formData.username);
              localStorage.setItem('currentPassword', formData.password);
              // Initialize history/settings for this user if usually needed (optional)
              navigate('/shelf-calculator');
            } else {
              setError("Invalid username or password. Try again.");
            }
          } catch (err) {
            setError("Server error. Please try again later.");
          }
      
    }

    // --- 2. SIGN UP LOGIC ---
    else if (view === 'signup') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      // Add user to database
      try {
          const formData = new FormData();
          formData.append("username", username);
          formData.append("password", password);
          formData.append("confirm_password", confirmPassword);

          const response = await fetch(`${API_BASE_URL}/signup`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (data.result === "0") {
            const errorData = await response.json();
            setError(data.error || "Failed to create account");
            return;
          }
          // Auto-login or ask to sign in? Let's ask to sign in for clarity.
          setSuccessMsg("Account created! Please sign in.");
          setTimeout(() => {
            setFormData({ username: "", password: "", confirmPassword: "" });
            setView("signin");
            setSuccessMsg("");
          }, 1000);
        } catch (err) {
          console.error(err);
          setError("An error occurred during signup");
        }

    }


    // --- 3. RESET PASSWORD LOGIC ---
    else if (view === 'reset') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }


      // Overwrite password
      try {
          const formData = new FormData();
          formData.append("username", username);
          formData.append("new_password", password);
          formData.append("confirm_password", confirmPassword);

          const response = await fetch(`${API_BASE_URL}/resetpass`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (data.result === "0") {
            setError(data.error || "Failed to reset password");
            return;
          }
          setSuccessMsg("Password reset successfully");
          setTimeout(() => {
            setFormData({ username: "", password: "", confirmPassword: "" });
            setView("signin");
            setSuccessMsg("");
          }, 1000);
        } catch (err) {
          console.error(err);
          setError("An error occurred while resetting password");
        }
    }
  };

  // --- TOGGLE HANDLERS ---
  const toggleView = (newView) => {
    setView(newView);
    setError('');
    setSuccessMsg('');
    setFormData({ username: '', password: '', confirmPassword: '' });
  };

  // Helper variables for UI Text
  let title = "Welcome to LibraryPlan";
  let subtitle = "Sign in to access your library layout planning tools";
  let btnText = "Sign In";

  if (view === 'signup') {
    title = "Create an Account";
    subtitle = "Register a new username to get started";
    btnText = "Sign Up";
  } else if (view === 'reset') {
    title = "Reset Password";
    subtitle = "Enter your username and new password";
    btnText = "Update Password";
  }

  return (
    <div className="auth-container">
      <div className="auth-content">
        
        {/* Header Section */}
        <div className="auth-header">
          <div className="auth-icon">
            <Book size={24} />
          </div>
          <div className='auth-headers'>
            <h1>{title}</h1>
            <p style={{ fontSize: "1.1rem", color: "rgba(52, 58, 64, 0.6)" }}>{subtitle}</p>
          </div>
        </div>

        {/* Form Container */}
        <div className='auth-form-container'>
          <form className='auth-form' onSubmit={handleAuthAction}>
            
            {/* Error message field Field */}
            {error && <div className="error-message">{error}</div>}

            {/* Username Field */}
            <div className='auth-form-input'>
                <label>Username</label>
                <input
                    name="username"
                    type="text"
                    className={`auth-input ${error ? 'error' : ''}`}
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={handleChange}
                />
            </div>

            {/* Password Field */}
            <div className="auth-form-input">
                <label>{view === 'reset' ? "New Password" : "Password"}</label>
                <input
                    name="password"
                    type="password"
                    className={`auth-input ${error ? 'error' : ''}`}
                    placeholder={view === 'reset' ? "Enter new password" : "Enter password"}
                    value={formData.password}
                    onChange={handleChange}
                />
            </div>

            {/* Confirm Password Field (Only for SignUp and Reset) */}
            {(view === 'signup' || view === 'reset') && (
              <div className="auth-form-input">
                  <label>Confirm Password</label>
                  <input
                      name="confirmPassword"
                      type="password"
                      className="auth-input"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                  />
              </div>
            )}

            {/* Remember Me / Forgot Password (Only for SignIn) */}
            {view === 'signin' && (
              <div className="rmb-me-password">
                  <div className="rmb-me">
                    <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                    />
                    <label htmlFor="remember-me">Remember me</label>
                  </div>
                  <div>
                    <button type="button" className="link-btn" onClick={() => toggleView('reset')}>
                        Forgot password?
                    </button>
                  </div>
              </div>
            )}

            {/* Error / Success Messages */}
            {error && <div style={{color: '#9A0D1B', fontSize:'0.9rem'}}>{error}</div>}
            {successMsg && <div style={{color: '#008a63', fontSize:'0.9rem'}}>{successMsg}</div>}

            <button type="submit" className="auth-button">
                {btnText}
            </button>
          </form>
        </div>

        {/* Footer Links */}
        <div>
          {view === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button className="link-btn bold" onClick={() => toggleView('signup')}>
                Sign up for free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="link-btn bold" onClick={() => toggleView('signin')}>
                Back to Sign In
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default SignInPage;