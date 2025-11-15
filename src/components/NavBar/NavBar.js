import './NavBar.css';
import Icon from '../Icon/Icon';

function Navbar({ activePage, onNavClick }) {
  return (
    <nav className="navbar-section">
      <div className="navbar-item">
        <div className="navbar-icon">
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

      <div 
        className={`navbar-item ${activePage === 'shelfCalculator' ? 'active' : ''}`}
        onClick={() => onNavClick('shelfCalculator')}
      >
        <div className="icon">
          <Icon name="Calculator" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Shelf Calculator</div>
          <div className="navbar-subtitle">Calculate meter run & shelf requirements</div>
        </div>
      </div>

      <div 
        className={`navbar-item ${activePage === 'layoutGenerator' ? 'active' : ''}`}
        onClick={() => onNavClick('layoutGenerator')}
      >
        <div className="icon">
          <Icon name="LayoutGrid" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Layout Generator</div>
          <div className="navbar-subtitle">Generate optimal library layout</div>
        </div>
      </div>

      <div 
        className={`navbar-item ${activePage === 'settings' ? 'active' : ''}`}
        onClick={() => onNavClick('settings')}
      >
        <div className="icon">
          <Icon name="Settings" size={24} />
        </div>
        <div className='navbar-titles'>
          <div className="navbar-title">Settings</div>
          <div className="navbar-subtitle">Configure preferences and defaults</div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;