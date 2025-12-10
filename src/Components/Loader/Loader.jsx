import React from 'react';
import './Loader.css';

/**
 * A loading bar and text component.
 * @param {object} props
 * @param {string} props.text - The text to display above the loader.
 * @param {number} [props.progress] - Optional 0-100 value. If provided, shows a determinate progress bar.
 */
function Loader({ text, progress }) {
  // Check if progress is provided and is a number (determinate mode)
  const isDeterminate = typeof progress === 'number';
  
  // Clamp value between 0 and 100
  const safeProgress = isDeterminate ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className="loader-container">
      <div className="loader-header">
        <p className="loader-text">{text}</p>
        {isDeterminate && (
          <span className="loader-percentage">{safeProgress}%</span>
        )}
      </div>
      
      <div className="loader-bar">
        <div 
          className={`loader-progress ${isDeterminate ? 'determinate' : 'indeterminate'}`}
          style={isDeterminate ? { width: `${safeProgress}%` } : {}}
        ></div>
      </div>
    </div>
  );
}

export default Loader;
