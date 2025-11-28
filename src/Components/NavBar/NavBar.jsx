import './NavBar.css';
import { NavLink } from 'react-router-dom'; 
import Icon from '../Icon/Icon';

// This component is now self-sufficient and does not need props.
function Navbar() { 
  
  // NavLink provides the isActive boolean to set the 'active' class
  const getItemClass = ({ isActive }) => {
    // Note: The outer .navbar-section handles the main flex direction (column)
    // The individual items use the 'active' class for highlighting
    return `navbar-item ${isActive ? 'active' : ''}`;
  };

  return (
    <nav className="navbar-section">
      {/* 1. Static Header Section */}
      <div className="navbar-item">
        <div className="navbar-icon">
          {/* Assuming --white is defined in your color variables */}
          <Icon name="BookOpen" size={24} style={{ color: 'rgba(var(--white), 1)' }} /> 
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">LibraryPlan</div>
          <div className="navbar-subtitle">Layout Planning Tool</div>
        </div>
      </div>
      <div className="core-features">
        <p className="descriptor">Core Features</p>
      </div>

      {/* 2. Navigation Item 1: Shelf Calculator */}
      <NavLink 
        to="/shelf-calculator" 
        className={getItemClass}
      >
        <div className="icon">
          <Icon name="Calculator" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Shelf Calculator</div>
          <div className="navbar-subtitle">Calculate meter run & shelf requirements</div>
        </div>
      </NavLink>

      {/* 3. Navigation Item 2: Layout Generator */}
      <NavLink 
        to="/layout-generator" 
        className={getItemClass}
      >
        <div className="icon">
          <Icon name="LayoutGrid" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Layout Generator</div>
          <div className="navbar-subtitle">Generate optimal library layout</div>
        </div>
      </NavLink>

      {/* 4. Navigation Item 3: Settings */}
      <NavLink 
        to="/settings" 
        className={getItemClass}
      >
        <div className="icon">
          <Icon name="Settings" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Settings</div>
          <div className="navbar-subtitle">Configure preferences and defaults</div>
        </div>
      </NavLink>
      
    </nav>
  );
}

export default Navbar;