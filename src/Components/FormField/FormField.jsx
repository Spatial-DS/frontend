import React, { useState } from 'react';
import Icon from '../Icon/Icon';
import './FormField.css';

/**
 * A styled form field with a label, an optional icon, and password toggle.
 * @param {object} props
 * @param {string} props.label - The label for the input.
 * @param {string} props.icon - The name of the Lucide icon.
 * @param {string} props.type - The input type (e.g., "text", "password").
 * @param {string} props.value - The current value.
 * @param {function} props.onChange - The onChange handler.
 * @param {string} [props.helpIcon] - Optional help icon name.
 * @param {string} [props.placeholder] - The input placeholder.
 * @param {boolean} [props.disabled] - Whether the input is disabled.
 */
function FormField({ label, icon, type, value, onChange, helpIcon, placeholder, disabled }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';

  // Determine the actual input type to render
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`form-field ${disabled ? 'disabled' : ''}`}>
      <div className="form-field-header">
        <label className="form-field-label">{label}</label>
        {helpIcon && <Icon name={helpIcon} size={16} className="form-field-help" />}
      </div>
      <div className="form-field-input-wrapper">
        {/* Left Icon */}
        <Icon name={icon} size={20} className="form-field-icon" />
        
        <input 
          type={inputType} 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder}
          className="form-field-input"
          disabled={disabled}
        />

        {/* Right Toggle Icon (Only for passwords) */}
        {isPasswordType && !disabled && (
          <button 
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex="-1" // Prevent tab focus stopping here
          >
            {/* Use "EyeClosed" when showing password (to indicate clicking will close/hide it), or vice versa depending on preference. 
                Standard UX: 
                - Show Password (Dots visible) -> Icon is "Eye"
                - Hide Password (Text visible) -> Icon is "EyeClosed" 
            */}
            <Icon name={showPassword ? "EyeClosed" : "Eye"} size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default FormField;