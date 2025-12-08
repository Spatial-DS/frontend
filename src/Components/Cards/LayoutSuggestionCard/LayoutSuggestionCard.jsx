import React, { useState, useEffect } from 'react';
import './LayoutSuggestionCard.css';
import ResultVisualizer from '../../ResultVisualizer/ResultVisualizer';

// Added externalActiveFloorIndex to props
function LayoutSuggestionCard({ 
  title, 
  floorNames = [], 
  floorImages = [], 
  layouts = [], 
  dimensions, 
  isSelected, 
  onClick,
  externalActiveFloorIndex 
}) {
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);

  // Sync internal state when external prop changes
  useEffect(() => {
    if (typeof externalActiveFloorIndex === 'number') {
      setActiveFloorIndex(externalActiveFloorIndex);
    }
  }, [externalActiveFloorIndex]);

  const handleTabClick = (e, index) => {
    e.stopPropagation();
    setActiveFloorIndex(index);
  };

  const currentImage = floorImages[activeFloorIndex] || null;
  const currentZones = layouts[activeFloorIndex] ? layouts[activeFloorIndex].zones : [];

  return (
    <div className={`layout-suggestion-card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="layout-card-header">
        <h5 className="layout-card-title">{title}</h5>
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
        <ResultVisualizer 
            imageSrc={currentImage} 
            zones={currentZones} 
            dimensions={dimensions} 
        />
      </div>
    </div>
  );
}
export default LayoutSuggestionCard;