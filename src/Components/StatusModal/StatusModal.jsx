import React from 'react';
import './StatusModal.css';
import Button from '../Button/Button'; // Assuming you have this shared component
import Icon from '../Icon/Icon';       // Assuming you have this shared component

const StatusModal = ({ isOpen, type = 'success', message, onClose }) => {
  if (!isOpen) return null;

  const isSuccess = type === 'success';

  return (
    <div className="status-modal-overlay" onClick={onClose}>
      {/* Stop propagation so clicking inside the card doesn't close it */}
      <div className="status-modal-card" onClick={(e) => e.stopPropagation()}>
        <Icon 
          name={isSuccess ? 'CheckCircle' : 'AlertCircle'} 
          size={48} 
          color={isSuccess ? '#4caf50' : '#f44336'} 
        />
        
        <h3 className="status-modal-title">
          {isSuccess ? 'Success' : 'Error'}
        </h3>
        
        <p className="status-modal-message">
          {message}
        </p>

        <div style={{ marginTop: '0.5rem' }}>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
