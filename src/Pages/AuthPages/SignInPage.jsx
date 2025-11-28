import React from 'react';
import { Book, Mail, Lock } from 'lucide-react';
import './AuthPages.css'
import { useNavigate } from 'react-router-dom';

const SignInPage = () => {
  const navigate = useNavigate();

  const handleSignIn = (e) => {
    e.preventDefault();
    // Add your authentication logic here (e.g., check password)
    
    navigate('/shelf-calculator'); 
  };

  return (
    <div className="auth-container">
      <div className="auth-content">
        {/* Header Section */}
        <div className="auth-header">
          <div className="auth-icon">
            <Book size = {24} />
          </div>
          <div className = 'auth-headers'>
            <h1>Welcome to LibraryPlan</h1>
            <p style= {{fontSize: "1.25rem"}}>Sign in to access your library layout planning tools</p>
          </div>
        </div>

        <div className = 'auth-form-container'>
            <form className = 'auth-form' onSubmit={handleSignIn}>
            <div className = 'auth-form-input'>
                <label>Email</label>
                <input
                    type="email"
                    className="auth-input"
                    placeholder="you@example.com"
                />
            </div>

            <div className="auth-form-input">
                <label>Password</label>
                <input
                    type="password"
                    className="auth-input"
                    placeholder="Password"
                />
            </div>

            <div className="rmb-me-password">
                <div className="rmb-me">
                <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className=""
                />
                <label htmlFor="remember-me">Remember me</label>
                </div>
                <div>
                <a href="#" className="link">
                    Forgot password?
                </a>
                </div>
            </div>

            <button type="submit" className="auth-button">
                Sign In
            </button>
            </form>
        </div>

        <div>
          Don't have an account?{' '}
          <a href="#" className="link" style= {{fontWeight: "bold"}}>
            Sign up for free
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;