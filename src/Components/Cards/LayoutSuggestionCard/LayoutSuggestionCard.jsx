import React, { useState } from 'react';
import './LayoutSuggestionCard.css';
import ResultVisualizer from '../../ResultVisualizer/ResultVisualizer';

// Add layouts and dimensions to props
function LayoutSuggestionCard({ title, floorNames = [], floorImages = [], layouts = [], dimensions, isSelected, onClick }) {
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);

  const handleTabClick = (e, index) => {
    e.stopPropagation();
    setActiveFloorIndex(index);
  };

  const currentImage = floorImages[activeFloorIndex] || null;
  // Get the zones for the active floor from the passed layouts array
  const currentZones = layouts[activeFloorIndex] ? layouts[activeFloorIndex].zones : [];

  return (
    <div className={`layout-suggestion-card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="layout-card-header">
        <h5 className="layout-card-title">{title}</h5>
        {floorNames.length > 0 && (
          <div className="layout-card-tabs">
            {floorNames.map((name, index) => (
              <span key={index} className={`card-floor-tab ${index === activeFloorIndex ? 'active' : ''}`} onClick={(e) => handleTabClick(e, index)}>{name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="layout-card-image-container">
        {/* Replace <img> with ResultVisualizer */}
        <ResultVisualizer 
            imageSrc={currentImage} 
            zones={currentZones} 
            dimensions={dimensions} // Assuming dimensions are same for all floors or passed correctly
        />
      </div>
    </div>
  );
}
export default LayoutSuggestionCard;
