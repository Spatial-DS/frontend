import React from 'react';
import Icon from '../Icon/Icon';
import './FormField.css';

/**
 * A styled form field with a label and an optional icon.
 * @param {object} props
 * @param {string} props.label - The label for the input.
 * @param {string} props.icon - The name of the Lucide icon.
 * @param {string} props.type - The input type (e.g., "text", "password").
 * @param {string} props.value - The current value.
 * @param {function} props.onChange - The onChange handler.
 * @param {string} [props.helpIcon] - Optional help icon name.
 * @param {string} [props.placeholder] - The input placeholder.
 */
function FormField({ label, icon, type, value, onChange, helpIcon, placeholder }) {
  return (
    <div className="form-field">
      <div className="form-field-header">
        <label className="form-field-label">{label}</label>
        {helpIcon && <Icon name={helpIcon} size={16} className="form-field-help" />}
      </div>
      <div className="form-field-input-wrapper">
        <Icon name={icon} size={20} className="form-field-icon" />
        <input 
          type={type} 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder}
          className="form-field-input"
        />
      </div>
    </div>
  );
}

export default FormField;