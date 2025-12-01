import React from 'react';
import './SelectionCard.css';
import Icon from '../../Icon/Icon';

function SelectionCard({ 
  icon, 
  title, 
  isSelected, 
  onToggle, 
  areaValue, 
  onAreaChange, 
  children,
  isDisabled // New Prop
}) {

  const handleInputClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`selection-card ${isSelected ? 'selected' : ''}`}
      onClick={onToggle}
    >
      <div className="selection-content-top">
        <div className="selection-icon">
          <Icon name={icon} size={24} />
        </div>
        <p className="selection-title">{title}</p>
      </div>

      {isSelected && (
        <div className="selection-input-wrapper" onClick={handleInputClick}>
          <label className="selection-input-label">Individual Zone Floor Area:</label>
          <div className="selection-input-group">
            <input
              type="text"
              className="selection-area-input"
              value={areaValue}
              onChange={(e) => onAreaChange(e.target.value)}
              placeholder={isDisabled ? "Calculated" : "0"} 
              disabled={isDisabled} // Apply disabled state
            />
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectionCard;
