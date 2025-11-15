import React, { useState } from 'react';
import './SelectionCard.css';
import Icon from '../../Icon/Icon';

/**
 * @param {object} props
 * @param {string} props.icon - The Lucide icon name (e.g., "Users").
 * @param {string} props.title - The title of the card.
 * @param {function} props.onSelect - Callback when card is clicked.
 */
function SelectionCard({ icon, title, onSelect }) {
  const [isSelected, setIsSelected] = useState(false);

  const handleClick = () => {
    const newSelectedState = !isSelected;
    setIsSelected(newSelectedState);
    if (onSelect) {
      onSelect(title, newSelectedState);
    }
  };

  return (
    <div 
      className={`selection-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <div className="selection-icon">
        <Icon name={icon} size={24} />
      </div>
      <p className="selection-title">{title}</p>
    </div>
  );
}

export default SelectionCard;