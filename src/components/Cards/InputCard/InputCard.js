import React from 'react';
import './InputCard.css';
import Icon from '../../Icon/Icon';

/**
 * A generic wrapper card with a title and icon.
 * @param {object} props
 * @param {string} props.icon - Lucide icon name (e.g., 'ListChecks')
 * @param {string} props.title - The title for the card
 * @param {string} [props.subtitle] - Optional subtitle text below the title
 * @param {string} [props.contentPadding] - Optional. 'none' to remove content padding.
 * @param {React.ReactNode} [props.headerActions] - Optional. JSX for buttons or controls in the header.
 * @param {React.ReactNode} props.children - The content to render inside the card
 */

function InputCard({ 
  icon, 
  title, 
  subtitle,
  contentPadding, 
  children, 
  headerActions 
}) {
  
  const contentClasses = [
    'input-card-content',
    contentPadding === 'none' ? 'input-card-content--no-padding' : ''
  ].join(' ');

  return (
    <div className="input-card">
      <div className="input-card-header">
        <div className="input-card-title-group">
          <div className="input-card-header-main">
            <Icon name={icon} size={24} className="card-icon" />
            <h3 className="input-card-title">{title}</h3>
          </div>
          {subtitle && (
            <p className="input-card-subtitle">{subtitle}</p>
          )}
        </div>
        
        {headerActions && (
          <div className="input-card-header-actions">
            {headerActions}
          </div>
        )}
      </div>
      
      <div className={contentClasses}>
        {children}
      </div>
    </div>
  );
}

export default InputCard;