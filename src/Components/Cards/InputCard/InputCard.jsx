import React from 'react';
import './InputCard.css';
import '../Cards.css';
import Icon from '../../Icon/Icon';


/**
 * A generic wrapper card with a title and icon or number.
 * @param {object} props
 * @param {string} [props.icon] - Lucide icon name (e.g., 'ListChecks') - optional if number is used
 * @param {string} [props.number] - A number string (e.g. "1.") to show instead of an icon
 * @param {string} props.title - The title for the card
 * @param {string} [props.subtitle] - Optional subtitle text below the title
 * @param {string} [props.contentPadding] - Optional. 'none' to remove content padding.
 * @param {React.ReactNode} [props.headerActions] - Optional. JSX for buttons or controls in the header.
 * @param {React.ReactNode} props.children - The content to render inside the card
 */

function InputCard({ 
  icon, 
  number,
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
    <div className="card input-card">
      {/* Use universal header class names */}
      <div className="card-header">
        <div className="header-content-group">
          {/* Use universal header row and title classes */}
          <div className="header-row">
            {number ? (
              <span className="card-number">{number}</span>
            ) : (
              <Icon name={icon} size={24} className="card-icon" />
            )}
            <h5 className="card-title">{title}</h5>
          </div>
          {subtitle && (
            <div className="subtitle-row">
              <p className="card-subtitle">{subtitle}</p>
            </div>
          )}
        </div>
        
        {headerActions && (
          <div className="header-actions">
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