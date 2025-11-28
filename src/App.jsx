// App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Layout
import Layout from './Components/Layout/Layout';

// Pages
import SignInPage from './Pages/AuthPages/SignInPage';
import ShelfCalculator from './Pages/ShelfCalculatorPage/ShelfCalculatorPage';
import LayoutGenerator from './Pages/LayoutGeneratorPage/LayoutGeneratorPage';
import Settings from './Pages/SettingsPage/SettingsPage';

function App() {
  return (
    <Routes>
      {/* PUBLIC ROUTE: No Navbar/Header */}
      <Route path="/" element={<SignInPage />} />

      {/* PROTECTED ROUTES: Wrapped in MainLayout */}
      <Route element={<Layout />}>
        <Route path="/shelf-calculator" element={<ShelfCalculator />} />
        <Route path="/layout-generator" element={<LayoutGenerator />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      
    </Routes>
  );
}

export default App;