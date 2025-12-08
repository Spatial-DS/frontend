import React, { useRef } from 'react';
import './UploadCard.css';
import Button from '../../Button/Button';
import Icon from '../../Icon/Icon';
import '../Cards.css';


function UploadCard({ 
  icon, 
  number,
  title, 
  subtitle, 
  uploadText, 
  formatText, 
  buttonText = "Browse Files", 
  onFileSelect,
  headerActions 
}) {
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
    <div className="card upload-card">
      <div className="card-header">
        
        {/* --- NEW WRAPPER: Grouping Icon/Title and Subtitle --- */}
        <div className="header-content-group">
          {/* --- DIV 1: Icon and Header (Row) --- */}
          <div className="header-row">
            {number ? (
              <span className="card-number">{number}</span>
            ) : (
              <Icon name={icon} size={24} className="card-icon" />
            )}
            <h5 className="card-title">{title}</h5>
          </div>

          {/* --- DIV 2: Subtitle (Column Stacked) --- */}
          {subtitle && (
            <div className="subtitle-row">
              <p className="card-subtitle">{subtitle}</p>
            </div>
          )}
        </div>
        
        {/* --- DIV 3: Header Actions (Pushed Right) --- */}
        {headerActions && (
          <div className="header-actions">
            {headerActions}
          </div>
        )}
        
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