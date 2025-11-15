import React from 'react';
import './ChipProgress.css';

/**
 * A chip-style toggle component.
 * @param {object} props
 * @param {'input' | 'results'} props.activeChip - The currently active chip.
 * @param {function} props.onChipClick - Function to call when a chip is clicked.
 * @param {object} [props.chipLabels] - Optional labels for the chips.
 * @param {string} [props.chipLabels.input] - Label for the 'input' chip.
 * @param {string} [props.chipLabels.results] - Label for the 'results' chip.
 */
function ChipProgress({ 
  activeChip, 
  onChipClick, 
  chipLabels = { input: 'Input Files', results: 'Results' } 
}) {
  return (
    <div className="chip-container">
      <div
        className={`chip-option ${activeChip === 'input' ? 'active' : ''}`}
        onClick={() => onChipClick('input')}
      >
        {chipLabels.input}
      </div>
      <div
        className={`chip-option ${activeChip === 'results' ? 'active' : ''}`}
        onClick={() => onChipClick('results')}
      >
        {chipLabels.results}
      </div>
    </div>
  );
}

export default ChipProgress;