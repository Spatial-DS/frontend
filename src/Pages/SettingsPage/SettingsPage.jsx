import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import ChipProgress from '../../Components/ChipProgress/ChipProgress';
import Button from '../../Components/Button/Button';
import Icon from '../../Components/Icon/Icon';
import FormField from '../../Components/FormField/FormField';
import PasswordStrength from '../../Components/PasswordStrength/PasswordStrength';

const API_BASE_URL = "http://localhost:8000";

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
  const [historyFilter, setHistoryFilter] = useState('All');

  // --- ACCOUNT STATE ---
  const [currentPassword, setCurrentPassword] = useState(() => {
    return localStorage.getItem('currentPassword');
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Feedback Message State
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');

  // --- HISTORY STATE ---
  const [historyData, setHistoryData] = useState([]);

  
  useEffect(() => {
    if (activeChip === 'results') {
      const currentUser = localStorage.getItem('currentUser');
   
        const formData = new FormData();
        formData.append("username", currentUser);
        Promise.all([
        fetch(`${API_BASE_URL}/shelf-run-history`, {
            method: "POST",
            body: formData
        }).then(res => res.json()),
        fetch(`${API_BASE_URL}/generated-layout-history`, {
            method: "POST",
            body: formData
        }).then(res => res.json())
        ])
        .then(([shelfHistory, layoutHistory]) => {
        // Merge both arrays
        const combined = [...shelfHistory, ...layoutHistory];
        // Sort by created_at descending
        combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setHistoryData(combined);
        })
        .catch(err => console.error("Failed to load history:", err));
  }}, [activeChip]);


  const handleNewPasswordChange = (e) => {
    const val = e.target.value;
    setNewPassword(val);
    setPasswordStrength(calculatePasswordStrength(val));
  };

  const handleSave = async () => {
      if (isChangingPassword) {
          if (!newPassword || !confirmPassword) {
              alert("Please fill in both password fields.");
              return;
          }
          if (newPassword !== confirmPassword) {
              alert("New passwords do not match.");
              return;
          }

          // Update password
          const username = localStorage.getItem('currentUser');
          try {
              const formData = new FormData();
              formData.append("username", username);
              formData.append("old_password", currentPassword);
              formData.append("new_password", newPassword);
              formData.append("confirm_password", confirmPassword);

              const response = await fetch(`${API_BASE_URL}/updatepass`, {
              method: "POST",
              body: formData,
              });

              const data = await response.json();
              if (data.result === "1") {
                setSaveMessage("Password updated successfully");
                setError("");
              } else {
              setError(data.error || "Failed to update password");
              }
          } catch (err) {
              console.error(err);
              setError("An error occurred while updating password");
          }

          
        // Reset UI state
            setCurrentPassword(newPassword);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordStrength(0);
            setIsChangingPassword(false);
            setSaveMessage("Password updated successfully.");
            setTimeout(() => setSaveMessage(''), 3000);
        } else {
            setSaveMessage("Settings saved.");
            setTimeout(() => setSaveMessage(''), 3000);
        }
  };

  const handleHistoryDownload = async (fileName) => {
      try {
          const response = await fetch(`${API_BASE_URL}/download-report/${fileName}`);
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
          alert(`Could not download ${fileName}.`);
      }
  };

  const filteredHistory = historyFilter === 'All'
    ? historyData
    : historyData.filter(item => {
        const name = item.filename.toLowerCase();
        if (historyFilter === 'Shelf Run Calculations') {
          return name.includes('shelf_run');
        } else if (historyFilter === 'Layout Generations') {
          return name.includes('layout');
        }
        return true;
      });


  // Delete the corresponding files
  const handleHistoryDelete = async (fileId, filename) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/delete-history?file_id=${fileId}&filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete file");

      // Update UI after deletion
      setHistoryData(historyData.filter(item => !(item.id === fileId && item.filename === filename)));
    //   alert("File deleted successfully");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Could not delete file");
    }
  };


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
                            <span className="history-item-name">{item.filename}</span>
                            <span className="history-item-badge">{item.created_at}</span>
                            <div className="history-actions">
                            <button
                                className="icon-btn"
                                onClick={() => handleHistoryDownload(item.filename)}
                            >
                                <Icon name="ArrowDownToDot" size={20} />
                            </button>
                            <button
                                className="icon-btn"
                                onClick={() => handleHistoryDelete(item.id, item.filename)}
                                style={{ marginLeft: '0.5rem', color: '#9A0D1B' }}
                            >
                                <Icon name="Trash2" size={20} />
                            </button>
                            </div>
                        </div>
                        ))
                    ) : (
                        <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                        No history found.
                        </p>
                    )}
                </div>

            </div>
        </div>
      ) : (
        <div className="account-content">
          <div className="settings-section-card">
            <h4 className="settings-section-title">Account</h4>
            
            <div className="password-change-container">
                {/* Row 1: Current Password + Toggle Button */}
                <div className="password-row-current">
                    <div className="password-input-wrapper">
                        <FormField 
                            label="Password" 
                            icon="Lock" 
                            type="password" 
                            value={currentPassword} 
                            onChange={(e) => setCurrentPassword(e.target.value)} 
                            disabled={!isChangingPassword} 
                        />
                    </div>
                    <div className="change-pass-btn-wrapper">
                        <Button 
                            variant={isChangingPassword ? "outline" : "default"} 
                            size="default" 
                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                        >
                            {isChangingPassword ? "Cancel Change" : "Change Password"}
                        </Button>
                    </div>
                </div>

                {/* Rows 2: New Password Fields */}
                <div className={`new-password-fields ${isChangingPassword ? 'active' : 'disabled'}`}>
                    <div className="form-row-2-col">
                        <div className="new-pass-col">
                            <FormField 
                                label="New Password" 
                                icon="Lock" 
                                type="password" 
                                value={newPassword} 
                                onChange={handleNewPasswordChange} 
                                disabled={!isChangingPassword}
                                placeholder="Enter new password"
                            />
                            {/* Strength meter only shows when user types */}
                            {newPassword.length > 0 && (
                                <div className="strength-wrapper">
                                    <PasswordStrength strength={passwordStrength} />
                                </div>
                            )}
                        </div>
                        
                        <div className="confirm-pass-col">
                            <FormField 
                                label="Confirm New Password" 
                                icon="Lock" 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                disabled={!isChangingPassword}
                                placeholder="Confirm new password"
                            />
                        </div>
                    </div>
                </div>
            </div>

          </div>
          
          <div className="page-actions">
            {saveMessage && <span className="save-message">{saveMessage}</span>}
            
            <Button variant="default" size="default" onClick={handleSave}>
                {isChangingPassword ? "Update Password" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;