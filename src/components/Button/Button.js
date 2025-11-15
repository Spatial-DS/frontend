import React from 'react';
import './Button.css';

/**
 * A universal button component with different styles.
 * @param {object} props
 * @param {function} props.onClick - The click handler.
 * @param {React.ReactNode} props.children - The content of the button.
 * @param {'default' | 'danger' | 'outline' | 'danger-outline' | 'text'} props.variant - The button style variant.
 * @param {string} props.className - Additional classes to apply.
 * @param {'default' | 'small'} props.size - The button size.
 * @param {boolean} props.disabled - Whether the button is disabled.
 */
function Button({ children, onClick, variant = 'default', size = 'default', className = '', disabled, ...rest }) {
  const classes = `btn-universal btn-${variant} btn-${size} ${className}`;

  return (
    <button className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export default Button;