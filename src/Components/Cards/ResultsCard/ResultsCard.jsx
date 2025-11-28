import React from 'react';
import Button from '../../Button/Button';
import './ResultsCard.css';

function ResultsCard({ onDownload }) {
  return (
    <div className="results-card-container">
      <div className="results-card">
        <div className="results-icon-wrapper">
          <div className="results-icon-check"></div>
        </div>
        
        <h2 className="results-title">Calculations completed!</h2>
        <p className="results-subtitle">
          Click the button below to download the Word document containing the shelf run calculations.
        </p>
        
        <Button variant="outline" size="default" onClick={onDownload}>
          Download Report
        </Button>
      </div>
    </div>
  );
}

export default ResultsCard;