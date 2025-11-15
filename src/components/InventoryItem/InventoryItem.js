import React from 'react';
import Icon from '../Icon/Icon';
import './InventoryItem.css';

/**
 * A row item for the inventory list.
 * @param {object} props
 * @param {string} props.title - The name of the inventory.
 * @param {boolean} props.isEditing - If the list is in edit mode.
 * @param {boolean} props.isSelected - If this item is currently selected.
 * @param {function} props.onClick - Function to call when clicked.
 * @param {function} props.onDelete - Function to call for deletion.
 */
 
function InventoryItem({ title, isEditing, isSelected, onClick, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation(); 
    onDelete();
  };

  return (
    <div 
      className={`inventory-item ${isSelected ? 'selected' : ''}`}
      onClick={isEditing ? undefined : onClick}
    >
      {isEditing && (
        <div className="inventory-item-icon danger" onClick={handleDelete}>
          <Icon name="Trash2" size={16} />
        </div>
      )}
      
      <span className="inventory-item-title">{title}</span>
      
      <div className="inventory-item-icon-right">
        {isEditing ? (
          <Icon name="GripVertical" size={16} />
        ) : (
          <Icon name="ChevronRight" size={16} />
        )}
      </div>
    </div>
  );
}

export default InventoryItem;