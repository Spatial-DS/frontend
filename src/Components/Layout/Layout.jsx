// src/Components/Layout/Layout.js
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom'; // Import useLocation
import Navbar from '../NavBar/NavBar';
import Header from '../Header/Header';

const Layout = () => {
  // Use useLocation to get the current route
  const location = useLocation();
  const pathName = location.pathname.substring(1); // Remove leading '/'

  // Map the URL path slug to the key expected by Header.js
  let activePageKey = 'shelfCalculator'; // Default
  
  if (pathName === 'shelf-calculator') {
    activePageKey = 'shelfCalculator';
  } else if (pathName === 'layout-generator') {
    activePageKey = 'layoutGenerator';
  } else if (pathName === 'settings') {
    activePageKey = 'settings';
  }

  return (
    <div className="container">
      <Navbar /> 

      <div className="content-container">
        {/* Pass the determined activePage prop to the Header */}
        <Header activePage={activePageKey} /> 

        <main className="main-content">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default Layout;