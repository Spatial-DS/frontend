import React, { useState } from 'react';
import { Book } from 'lucide-react';
import './AuthPages.css';
import { useNavigate } from 'react-router-dom';

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

  // --- HELPER: USER MANAGEMENT ---
  const getUsers = () => {
    const stored = localStorage.getItem('app_users');
    return stored ? JSON.parse(stored) : {};
  };

  const saveUser = (username, password) => {
    const users = getUsers();
    users[username] = password;
    localStorage.setItem('app_users', JSON.stringify(users));
  };

  const handleAuthAction = (e) => {
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
      const users = getUsers();
      
      // Check hardcoded dummy or stored user
      const isValidDummy = username === 'tampines' && password === 'tampineslibrary';
      const storedPassword = users[username];

      if (isValidDummy || (storedPassword && storedPassword === password)) {
        // Set active session
        localStorage.setItem('currentUser', username);
        // Initialize history/settings for this user if usually needed (optional)
        navigate('/shelf-calculator'); 
      } else {
        setError("Invalid username or password.");
      }
    }

    // --- 2. SIGN UP LOGIC ---
    else if (view === 'signup') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const users = getUsers();
      if (users[username] || username === 'tampines') {
        setError("Username already exists.");
        return;
      }

      saveUser(username, password);
      // Auto-login or ask to sign in? Let's ask to sign in for clarity.
      setSuccessMsg("Account created! Please sign in.");
      setTimeout(() => {
        setFormData({ username: '', password: '', confirmPassword: '' });
        setView('signin');
        setSuccessMsg('');
      }, 1500);
    }

    // --- 3. RESET PASSWORD LOGIC ---
    else if (view === 'reset') {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const users = getUsers();
      // Can't reset the dummy account this way in this simple demo logic, only stored ones
      if (username === 'tampines') {
         setError("Cannot reset administrative account.");
         return;
      }

      if (!users[username]) {
        setError("Username not found.");
        return;
      }

      saveUser(username, password); // Overwrite password
      setSuccessMsg("Password reset successful. Please sign in.");
      setTimeout(() => {
        setFormData({ username: '', password: '', confirmPassword: '' });
        setView('signin');
        setSuccessMsg('');
      }, 1500);
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
            
            {/* Username Field */}
            <div className='auth-form-input'>
                <label>Username</label>
                <input
                    name="username"
                    type="text"
                    className="auth-input"
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
                    className="auth-input"
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
            {error && <div style={{color: 'var(--red)', fontSize:'0.9rem'}}>{error}</div>}
            {successMsg && <div style={{color: '#28A745', fontSize:'0.9rem'}}>{successMsg}</div>}

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