import React from 'react';
import './Loader.css';

/**
 * A loading bar and text component.
 * @param {object} props
 * @param {string} props.text - The text to display above the loader.
 */
function Loader({ text }) {
  return (
    <div className="loader-container">
      <p className="loader-text">{text}</p>
      <div className="loader-bar">
        <div className="loader-progress"></div>
      </div>
    </div>
  );
}

export default Loader;