import React, { useState } from 'react';
import './App.css';

import Navbar from './components/NavBar/NavBar';
import Header from './components/Header/Header';
import ShelfCalculatorPage from './Pages/ShelfCalculator/ShelfCalculatorPage';
import LayoutGeneratorPage from './Pages/LayoutGenerator/LayoutGeneratorPage';
import SettingsPage from './Pages/Settings/SettingsPage'

function App() {
  const [activePage, setActivePage] = useState('shelfCalculator');

  return (
    <div className="container">
      <Navbar 
        activePage={activePage} 
        onNavClick={setActivePage} 
      />
      <div className="content-container">
        <Header activePage={activePage} />
        <main className="main-content">
          {activePage === 'shelfCalculator' && <ShelfCalculatorPage />}
          {activePage === 'layoutGenerator' && <LayoutGeneratorPage />}
          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;