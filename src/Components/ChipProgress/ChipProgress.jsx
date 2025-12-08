import React from 'react';
import './ChipProgress.css';

/**
 * A chip-style toggle component.
 * @param {object} props
 * @param {string} props.activeChip - The currently active chip key.
 * @param {function} props.onChipClick - Function to call when a chip is clicked.
 * @param {object} props.chipLabels - Object mapping keys to display labels. E.g., { labels: 'Set Up', input: 'Input', results: 'Results' }
 */
function ChipProgress({ 
  activeChip, 
  onChipClick, 
  chipLabels = { input: 'Input Files', results: 'Results' } 
}) {
  return (
    <div className="chip-container">
      {Object.entries(chipLabels).map(([key, label]) => (
        <div
          key={key}
          className={`chip-option ${activeChip === key ? 'active' : ''}`}
          onClick={() => onChipClick(key)}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

export default ChipProgress;