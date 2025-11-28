import React from 'react';
import './SelectionCard.css';
import Icon from '../../Icon/Icon';

/**
 * @param {object} props
 * @param {string} props.icon - The Lucide icon name.
 * @param {string} props.title - The title of the card.
 * @param {boolean} props.isSelected - Whether the card is active.
 * @param {function} props.onToggle - Callback when card is clicked (to toggle selection).
 * @param {string} props.areaValue - The current input value for area.
 * @param {function} props.onAreaChange - Callback when input changes.
 */
function SelectionCard({ icon, title, isSelected, onToggle, areaValue, onAreaChange }) {

  const handleInputClick = (e) => {
    // Prevent the card from toggling off when clicking the input
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

      {/* Conditional Input Field */}
      {isSelected && (
        <div className="selection-input-wrapper" onClick={handleInputClick}>
            <label className="selection-input-label">Individual Zone Floor Area:</label>
            <div className="selection-input-group">
                <input
                    type="text"
                    className="selection-area-input"
                    value={areaValue}
                    onChange={(e) => onAreaChange(e.target.value)}
                    placeholder="0"
                />
                <span className="selection-unit">m²</span>
            </div>
        </div>
      )}
    </div>
  );
}

export default SelectionCard;