import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import './Header.css';

const pageDetails = {
  shelfCalculator: {
    title: 'Shelf Calculator',
    subtitle: 'Calculate meter run & shelf requirements'
  },
  layoutGenerator: {
    title: 'Layout Generator',
    subtitle: 'Generate optimal library layout'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Configure preferences and defaults'
  }
};

function Header({ activePage }) {
  const navigate = useNavigate();
  const { title, subtitle } = pageDetails[activePage] || pageDetails.shelfCalculator;

  const handleLogout = () => {
    // Redirect to the Sign In page (root path)
    navigate('/');
  };

  return (
    <div className="header">
        <div className='header-titles'>
          <h2 className="header-title">{title}</h2>
          <div className="header-subtitle">{subtitle}</div>
        </div>
        
        <div className="header-actions">
          <Button variant="outline" size="small" onClick={handleLogout}>
            Logout
          </Button>
        </div>
    </div>
  );
}

export default Header;