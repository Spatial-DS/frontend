import React, { useRef } from 'react';
import './UploadCard.css';
import Button from '../../Button/Button';
import Icon from '../../Icon/Icon';

/**
 * @param {object} props
 * @param {string} props.icon
 * @param {string} props.title - The title of the card.
 * @param {string} props.subtitle - The subtitle text.
 * @param {string} props.uploadText - The main text inside the dropzone.
 * @param {string} props.formatText - The text describing file formats.
 * @param {string} props.buttonText - The text for the upload button.
 * @param {function} props.onFileSelect - A function to call when files are selected.
 */

function UploadCard({ icon, title, subtitle, uploadText, formatText, buttonText = "Browse Files", onFileSelect }) {
  const fileInputRef = useRef(null);

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    if (onFileSelect) {
      onFileSelect(event.target.files);
    }
  };

  return (
    <div className="upload-card">
      <div className="card-header">
        <div className="card-icon-wrapper">
          <Icon name={icon} size={20} className="card-icon" />
        </div>
        <div className="card-title-group">
          <h5 className="card-title">{title}</h5>
          <p className="card-subtitle">{subtitle}</p>
        </div>
      </div>
      
      <div className="dropzone">
        <div className="dropzone-icon">
          <Icon name="UploadCloud" size={32} />
        </div>
        <p className="dropzone-text-primary">{uploadText}</p>
        <p className="dropzone-text-secondary">{formatText}</p>
        
        <Button 
          variant="outline" 
          size="small" 
          onClick={handleBrowseClick}
        >
          {buttonText}
        </Button>
        
        <input 
          id={`file-upload-${title}`}
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }} 
          multiple 
        />
      </div>
    </div>
  );
}

export default UploadCard;