import React from 'react';
import './ZoneDistribution.css';

/**
 * A card for displaying zone distribution.
 * @param {object} props
 * @param {Array<object>} props.zones - Array of { name, color, area } objects.
 */
function ZoneDistribution({ zones }) {
  return (
    <div className="zone-distribution-card">
      <h5 className="zone-title">Zone Distribution Breakdown</h5>
      <p className="zone-subtitle">Selected Layout: Efficient Flow Layout</p>
      <div className="zone-grid">
        {zones.map((zone) => (
          <div key={zone.name} className="zone-item">
            <div 
              className="zone-color-swatch" 
              style={{ backgroundColor: zone.color }}
            ></div>
            <div className="zone-details">
              <span className="zone-name">{zone.name}</span>
              <span className="zone-area">{zone.area}m²</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ZoneDistribution;