import React from 'react';
import './LayoutSuggestionCard.css';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {number} props.efficiency
 * @param {number} props.flow
 * @param {string} props.imageSrc
 * @param {string} props.description
 * @param {boolean} props.isSelected
 * @param {function} props.onClick
 */
function LayoutSuggestionCard({ title, efficiency, flow, imageSrc, description, isSelected, onClick }) {
  return (
    <div 
      className={`layout-suggestion-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <h5 className="layout-card-title">{title}</h5>
      <div className="layout-card-stats">
        <span className="stat-chip">Efficiency: {efficiency}%</span>
        <span className="stat-chip">Flow: {flow}%</span>
      </div>
      <img 
        src={imageSrc} 
        alt={`${title} layout`} 
        className="layout-card-image" 
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
      <div className="layout-card-image-placeholder">
        <span>Layout Image</span>
      </div>
      <p className="layout-card-description">{description}</p>
    </div>
  );
}

export default LayoutSuggestionCard;