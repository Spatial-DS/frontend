import React, { useState } from 'react';
import './LayoutSuggestionCard.css';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string[]} props.floorNames - Array of floor names (e.g. ["Floor 1", "Floor 2"])
 * @param {boolean} props.isSelected
 * @param {function} props.onClick
 */
function LayoutSuggestionCard({ title, floorNames = [], isSelected, onClick }) {
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);

  // Generate a stable random-looking placeholder based on title + floor
  // In a real app, you would pass specific image URLs for each floor
  const currentImageSrc = `https://placehold.co/400x220/525864/FFF?text=${encodeURIComponent(title)}+-+${encodeURIComponent(floorNames[activeFloorIndex] || 'Floor')}`;

  const handleTabClick = (e, index) => {
    e.stopPropagation(); // Prevent selecting the card when just switching tabs
    setActiveFloorIndex(index);
  };

  return (
    <div 
      className={`layout-suggestion-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="layout-card-header">
        <h5 className="layout-card-title">{title}</h5>
        
        {/* Floor Tabs inside the card */}
        {floorNames.length > 0 && (
          <div className="layout-card-tabs">
            {floorNames.map((name, index) => (
              <span 
                key={index}
                className={`card-floor-tab ${index === activeFloorIndex ? 'active' : ''}`}
                onClick={(e) => handleTabClick(e, index)}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="layout-card-image-container">
        <img 
          src={currentImageSrc} 
          alt={`${title} - ${floorNames[activeFloorIndex]}`} 
          className="layout-card-image" 
        />
      </div>
    </div>
  );
}

export default LayoutSuggestionCard;