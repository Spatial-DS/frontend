import React from 'react';
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
  const { title, subtitle } = pageDetails[activePage] || pageDetails.shelfCalculator;

  return (
    <div className="header">
        <div className='header-titles'>
          <h2 className="header-title">{title}</h2>
          <div>{subtitle}</div>
        </div>
    </div>
  );
}

export default Header;