import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx'; 
import './SettingsPage.css';
import ChipProgress from '../../Components/ChipProgress/ChipProgress';
import InputCard from '../../Components/Cards/InputCard/InputCard';
import UploadCard from '../../Components/Cards/UploadCard/UploadCard';
import Button from '../../Components/Button/Button';
import InventoryItem from '../../Components/InventoryItem/InventoryItem'; // Kept if needed for other features, otherwise optional
import Icon from '../../Components/Icon/Icon';
import FormField from '../../Components/FormField/FormField'
import PasswordStrength from '../../Components/PasswordStrength/PasswordStrength';
import GuideCard from '../../Components/Cards/GuideCard/GuideCard';

// --- DEFAULT PREVIEW DATA (Fallback) ---
const DEFAULT_HEADERS = [
  "Category", "Sub category", "Item Language", "Item Age Lvl", "Item Fiction Tag", "Item Subject Suffix", "Item DDC Class", "Item Collection Code"
];

const DEFAULT_ROWS = [
  ["Adult's English Fiction", "Fiction", "English", "A", "Yes", "NOT IN: FAM", "", "NSIN or OTH"],
  ["Adult's English Non-Fiction", "General Non-Fiction - 000", "English", "A", "No", "NOT IN: ART, BIZ...", "0", "NSIN or OTH"],
];

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

  // --- PERSISTENT LABEL FILE STATE ---
  const [currentLabelFile, setCurrentLabelFile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_label_file_meta')); } catch (e) { return null; }
  });
  const [previewHeaders, setPreviewHeaders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_label_file_headers')) || DEFAULT_HEADERS; } catch (e) { return DEFAULT_HEADERS; }
  });
  const [previewRows, setPreviewRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_label_file_rows')) || DEFAULT_ROWS; } catch (e) { return DEFAULT_ROWS; }
  });
  const [sheetNames, setSheetNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_label_sheet_names')) || ['Sheet1']; } catch (e) { return ['Sheet1']; }
  });

  const [isViewingLabelFile, setIsViewingLabelFile] = useState(() => !!localStorage.getItem('settings_label_file_meta'));
  const [showPreview, setShowPreview] = useState(false);
  const [activeSheet, setActiveSheet] = useState(sheetNames[0] || 'Sheet1');
  const workbookRef = useRef(null); 

  useEffect(() => {
    if (currentLabelFile) {
      localStorage.setItem('settings_label_file_meta', JSON.stringify(currentLabelFile));
      localStorage.setItem('settings_label_file_headers', JSON.stringify(previewHeaders));
      localStorage.setItem('settings_label_file_rows', JSON.stringify(previewRows));
      localStorage.setItem('settings_label_sheet_names', JSON.stringify(sheetNames));
    }
  }, [currentLabelFile, previewHeaders, previewRows, sheetNames]);

  // --- LOGIC: Generate Holdings Template ---
  const generateHoldingsTemplateData = (jsonData) => {
    const validRows = jsonData.filter(row => {
        const sub = row['Sub category'] ? String(row['Sub category']) : '';
        // Exclude Spine/Front hardcoded rows from template generation
        return (row['Category'] && row['Sub category'] && !sub.includes('(Spine)') && !sub.includes('(Front)'));
    });
    
    const holdingsData = validRows.map(row => ({
      'Category': row['Category'],
      'Sub category': row['Sub category'],
      'Target end state collection': '', 
      'Retained': ''                     
    }));

    localStorage.setItem('generated_holdings_structure', JSON.stringify(holdingsData));
    console.log(`Generated Holdings Template structure with ${holdingsData.length} rows.`);
  };

  // --- PARSE SHEET ---
  const parseSheet = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (jsonArray.length > 0) {
        setPreviewHeaders(jsonArray[0]); 
        setPreviewRows(jsonArray.slice(1));
    }
  };

  // --- HANDLE UPLOAD ---
  const handleLabelUpload = (files) => {
    if (files.length > 0) {
      const file = files[0];
      const today = new Date().toISOString().split('T')[0];
      
      setCurrentLabelFile({ name: file.name, date: today, size: (file.size / 1024).toFixed(1) + ' KB' });

      // 1. Read for Parsing (Structure)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          workbookRef.current = workbook;
          setSheetNames(workbook.SheetNames);
          
          // Check for "Shelf Run" sheet to generate template
          const shelfRunSheetName = workbook.SheetNames.find(s => s.toLowerCase().trim() === 'shelf run');
          if (shelfRunSheetName) {
             const ws = workbook.Sheets[shelfRunSheetName];
             const rawJson = XLSX.utils.sheet_to_json(ws);
             generateHoldingsTemplateData(rawJson);
          }

          const firstSheet = workbook.SheetNames[0];
          setActiveSheet(firstSheet);
          parseSheet(workbook, firstSheet);
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Failed to read file.");
        }
      };
      reader.readAsArrayBuffer(file);

      // 2. Read for Storage (Base64 for Calculator Page)
      const storageReader = new FileReader();
      storageReader.onload = (e) => {
          localStorage.setItem('settings_label_file_data', e.target.result);
      };
      storageReader.readAsDataURL(file);

      setIsViewingLabelFile(true);
      setShowPreview(false); 
    }
  };

  const handleSheetChange = (sheetName) => {
      setActiveSheet(sheetName);
      if (workbookRef.current) parseSheet(workbookRef.current, sheetName);
      else alert("Please re-upload the file to switch sheets.");
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/Labels.xlsx'; // Points to public folder
    link.setAttribute('download', 'Labels.xlsx'); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const filtersInstructions = [
    "You may edit the file, but maintain the existing format.",
    "Use 'NOT IN:' to exclude rows.",
    "Use 'or' to include rows matching either option.",
    "Do not modify 'Spine' or 'Front Facing' rows."
  ];

  const shelfRunInstructions = [
    "Fill in 'Avg Vol per m' and 'No. of Tiers'.",
    "Columns A and B are automatically populated."
  ];

  return (
    <div className="settings-page">
      <ChipProgress
        activeChip={activeChip}
        onChipClick={setActiveChip}
        chipLabels={{ input: 'Account & Set Up', results: 'History' }}
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

          <div className="settings-section-card">
             <h4 className="settings-section-title">Labelling</h4>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <GuideCard title="Filters Sheet Instructions" subtitle="Rules for editing the Filters tab:" steps={filtersInstructions} />
                <GuideCard title="Shelf Run Sheet Instructions" subtitle="Rules for editing the Shelf Run tab:" steps={shelfRunInstructions} />
             </div>

             <div className="labelling-header-actions">
                <Button variant="outline" size="small" onClick={handleDownloadTemplate}>Download Labelling Template</Button>
                <Button variant={isViewingLabelFile ? "default" : "outline"} size="small" onClick={() => setIsViewingLabelFile(!isViewingLabelFile)}>{isViewingLabelFile ? "Close View" : "View File In Use"}</Button>
             </div>

             {isViewingLabelFile ? (
                 <div className="file-viewer-container">
                    <div className="file-viewer-placeholder">
                        <div className="file-icon-large"><Icon name="FileUp" size={48} /></div>
                        {currentLabelFile ? (
                            <><h5 style={{margin: '0.5rem 0 0 0'}}>{currentLabelFile.name}</h5><p style={{fontSize: '0.85rem', margin: 0}}>Uploaded on {currentLabelFile.date} • {currentLabelFile.size}</p></>
                        ) : (
                            <><h5 style={{margin: '0.5rem 0 0 0'}}>Default System Template</h5><p style={{fontSize: '0.85rem', margin: 0}}>Viewing the standard configuration currently in use.</p></>
                        )}
                        <div style={{display:'flex', gap:'1rem', marginTop:'1rem'}}>
                            <Button variant={showPreview ? "default" : "outline"} size="small" onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Hide Data" : "Preview Data"}</Button>
                            <Button variant="outline" size="small">Download</Button>
                        </div>
                    </div>
                    {showPreview && (
                        <>
                            {sheetNames.length > 1 && (
                                <div className="sheet-tabs-container">
                                    {sheetNames.map(sheet => (<button key={sheet} className={`sheet-tab ${activeSheet === sheet ? 'active' : ''}`} onClick={() => handleSheetChange(sheet)}>{sheet}</button>))}
                                </div>
                            )}
                            <div className="preview-table-wrapper">
                                <table className="preview-table">
                                    <thead><tr>{previewHeaders.map((head, idx) => <th key={idx}>{head}</th>)}</tr></thead>
                                    <tbody>{previewRows.map((row, idx) => (<tr key={idx}>{row.map((cell, i) => <td key={i}>{cell !== undefined ? cell : ''}</td>)}</tr>))}</tbody>
                                </table>
                            </div>
                        </>
                    )}
                 </div>
             ) : (
                 <div style={{ marginTop: '1rem' }}>
                    <UploadCard icon="FileUp" title="Upload Completed Labels" subtitle="Upload the filled labelling template here." uploadText="Drag and drop or browse" formatText="Excel (.xlsx)" buttonText="Browse Files" onFileSelect={handleLabelUpload} />
                 </div>
             )}
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