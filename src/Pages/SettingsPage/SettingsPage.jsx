import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import ChipProgress from '../../Components/ChipProgress/ChipProgress';
import Button from '../../Components/Button/Button';
import Icon from '../../Components/Icon/Icon';
import FormField from '../../Components/FormField/FormField';
import PasswordStrength from '../../Components/PasswordStrength/PasswordStrength';

// Helper for password strength
const calculatePasswordStrength = (pass) => {
  if (!pass || pass.length === 0) return 0;
  if (pass === '************') return 3;
  let score = 0;
  if (pass.length > 8) score++;
  if (pass.match(/[a-z]/)) score++;
  if (pass.match(/[A-Z]/)) score++;
  if (pass.match(/[0-9]/)) score++;
  if (pass.match(/[^a-zA-Z0-9]/)) score++;
  return Math.max(1, Math.min(score, 4));
};

function SettingsPage() {
  const [activeChip, setActiveChip] = useState('input');
  const [username, setUsername] = useState('library@nlb.com');
  const [password, setPassword] = useState('************');
  const [passwordStrength, setPasswordStrength] = useState(3);
  const [historyFilter, setHistoryFilter] = useState('All');

  // --- HISTORY STATE ---
  const [historyData, setHistoryData] = useState(() => {
      try {
          return JSON.parse(localStorage.getItem('library_app_history') || '[]');
      } catch (e) { return []; }
  });

  // Refresh history when tab becomes active
  useEffect(() => {
      if (activeChip === 'results') {
          const stored = localStorage.getItem('library_app_history');
          if (stored) setHistoryData(JSON.parse(stored));
      }
  }, [activeChip]);

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setPasswordStrength(calculatePasswordStrength(e.target.value));
  };

  const handleSave = () => {
      console.log("Settings saved");
  };

  // --- HISTORY DOWNLOAD HANDLER (Calls Backend) ---
  const handleHistoryDownload = async (fileName) => {
      try {
          const response = await fetch(`http://localhost:5000/download-report/${fileName}`);
          if (!response.ok) throw new Error("File not found on server.");

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
      } catch (error) {
          console.error("Download failed:", error);
          alert(`Could not download ${fileName}. It may have been deleted from the server.`);
      }
  };

  const filteredHistory = historyFilter === 'All' 
    ? historyData 
    : historyData.filter(item => item.type === historyFilter);

  return (
    <div className="settings-page">
      <ChipProgress
        activeChip={activeChip}
        onChipClick={setActiveChip}
        chipLabels={{ input: 'Account', results: 'History' }} 
      />

      {activeChip === 'results' ? (
        <div className="history-content">
            <div className="history-card">
                <h4 className="history-title">History of Calculations and Generations</h4>
                
                <div className="history-filters">
                    <button 
                        className={`history-filter-chip ${historyFilter === 'Shelf Run Calculations' ? 'active' : ''}`}
                        onClick={() => setHistoryFilter(historyFilter === 'Shelf Run Calculations' ? 'All' : 'Shelf Run Calculations')}
                    >
                        Shelf Run Calculations
                    </button>
                    <button 
                        className={`history-filter-chip ${historyFilter === 'Layout Generations' ? 'active' : ''}`}
                        onClick={() => setHistoryFilter(historyFilter === 'Layout Generations' ? 'All' : 'Layout Generations')}
                    >
                        Layout Generations
                    </button>
                </div>

                <div className="history-list">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((item) => (
                            <div key={item.id} className="history-item">
                                <span className="history-item-name">{item.name}</span>
                                <span className="history-item-badge">{item.type}</span>
                                <div className="history-actions">
                                    <button className="icon-btn" onClick={() => handleHistoryDownload(item.name)}><Icon name="ArrowDownToDot" size={20} /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p style={{textAlign: 'center', color: '#666', padding: '2rem'}}>No history found.</p>
                    )}
                </div>
            </div>
        </div>
      ) : (
        <div className="account-content">
          <div className="settings-section-card">
            <h4 className="settings-section-title">Account</h4>
            <div className="form-row-2-col">
                <FormField label="Email" icon="User" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="library@nlb.com" />
                <div className="password-wrapper">
                    <FormField label="Password" icon="Lock" type="password" value={password} onChange={handlePasswordChange} />
                    <PasswordStrength strength={passwordStrength} />
                </div>
            </div>
          </div>
          
          <div className="page-actions">
            <Button variant="default" size="default" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;