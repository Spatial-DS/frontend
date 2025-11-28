import React from 'react';
import './PasswordStrength.css';

/**
 * A password strength meter.
 * @param {object} props
 * @param {number} props.strength - A number from 0 (none) to 4 (strong).
 */
function PasswordStrength({ strength = 0 }) {
  const clampedStrength = Math.max(0, Math.min(strength, 4));
  
  const getBarColor = (level) => {
    if (clampedStrength === 0) return '#E9ECEF'; // Grey
    if (clampedStrength === 1) return '#E74C3C'; // Red
    if (clampedStrength === 2) return '#F39C12'; // Orange
    if (clampedStrength === 3) return '#2ECC71'; // Light Green
    if (clampedStrength === 4) return '#28A745'; // Dark Green
    return '#E9ECEF';
  };

  const validationText = [
    'This is a validation text.', // Default
    'Very Weak',
    'Weak',
    'Good',
    'Strong'
  ][clampedStrength];

  return (
    <div className="password-strength-container">
      <div className="strength-bar-track">
        {/* Create 4 segments, color them based on strength */}
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="strength-bar-segment"
            style={{ 
              backgroundColor: level <= clampedStrength ? getBarColor(clampedStrength) : '#E9ECEF'
            }}
          ></div>
        ))}
      </div>
      <p 
        className="validation-text"
        style={{ color: clampedStrength <= 2 ? 'rgba(var(--red), 1)' : '#28A745' }}
      >
        {validationText}
      </p>
    </div>
  );
}

export default PasswordStrength;