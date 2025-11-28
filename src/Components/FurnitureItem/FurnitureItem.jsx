import React from 'react';
import Icon from '../Icon/Icon';
import './FurnitureItem.css';

/**
 * A grid item for a piece of furniture.
 * @param {object} props
 * @param {string} props.title - The name of the furniture.
 * @param {string} props.subtitle - The description (e.g., "Height: ...").
 * @param {boolean} props.isEditing - If the list is in edit mode.
 * @param {function} props.onDelete - Function to call for deletion.
 */
function FurnitureItem({ title, subtitle, isEditing, onDelete }) {
  return (
    <div className="furniture-item">
      <div className="furniture-details">
        <span className="furniture-title">{title}</span>
        <span className="furniture-subtitle">{subtitle}</span>
      </div>
      {isEditing && (
        <div className="furniture-delete-icon" onClick={onDelete}>
          <Icon name="Trash2" size={16} />
        </div>
      )}
    </div>
  );
}

export default FurnitureItem;