import React from 'react';
import Icon from '../../Icon/Icon'; 
import './GuideCard.css'; 

/**
 * @param {object} props
 * @param {string[]} props.steps - Array of instruction strings.
 * @param {string} [props.title] - Card title.
 * @param {string} [props.subtitle] - Card subtitle/highlight text.
 */
function GuideCard({ 
  steps = [], 
  title = "How to Use Guide", 
  subtitle 
}) {
  return (
    <div className="card guide-card"> 
      <div className="card-header">
        <div className="header-content-group">
          <div className="header-row">
            <Icon name="Info" size={24} className="card-icon" /> 
            <h5 className="card-title">{title}</h5>
          </div>
        </div>
      </div>

      <div className="form-content">
        <div className="input-card-content">
            {subtitle && (
              <p className="form-subtitle guide-item--highlight">
                {subtitle}
              </p>
            )}
            <ol className="form-group guide-list">
              {steps.map((step, index) => (
                <li key={index} className="guide-item">
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
        </div>
    </div>
  </div>
  );
}

export default GuideCard;