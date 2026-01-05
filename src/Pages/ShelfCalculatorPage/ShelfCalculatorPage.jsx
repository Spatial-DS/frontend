import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx'; 
import ChipProgress from '../../Components/ChipProgress/ChipProgress';
import Loader from '../../Components/Loader/Loader'; 
import Button from '../../Components/Button/Button'; 
import UploadCard from '../../Components/Cards/UploadCard/UploadCard'; 
import InputCard from '../../Components/Cards/InputCard/InputCard';   
import ResultsCard from '../../Components/Cards/ResultsCard/ResultsCard';
import GuideCard from '../../Components/Cards/GuideCard/GuideCard'; 
import Icon from '../../Components/Icon/Icon'; 
import './ShelfCalculatorPage.css';

const API_BASE_URL = "http://localhost:8000";

function ShelfCalculatorPage() {
  const [activeChip, setActiveChip] = useState('labels'); 
  
  // Initialize state from localStorage if available
  const [targetSize, setTargetSize] = useState(() => localStorage.getItem('shelf_target_size') || '');
  const [currentSize, setCurrentSize] = useState(() => localStorage.getItem('shelf_current_size') || '');
  
  // Simple message string state for save confirmation
  const [saveMessage, setSaveMessage] = useState('');

  const [rawFile, setRawFile] = useState(null);
  const [collectionMixFile, setCollectionMixFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("Shelf_Run_Report.docx"); 

  const [isLoading, setIsLoading] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const calculationTimeoutRef = useRef(null);

  // --- LABELS STATE ---
  const [currentLabelFile, setCurrentLabelFile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_label_file_meta')); } catch (e) { return null; }
  });

  useEffect(() => {
    return () => { if (calculationTimeoutRef.current) clearTimeout(calculationTimeoutRef.current); };
  }, []);

  // Persist label settings (Meta only, data is saved on upload)
  useEffect(() => {
    if (currentLabelFile) {
      localStorage.setItem('settings_label_file_meta', JSON.stringify(currentLabelFile));
    }
  }, [currentLabelFile]);


  const dataURLtoFile = (dataurl, filename) => {
    if(!dataurl) return null;
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  }

  const handleRawDataUpload = (files) => {
    if (files && files[0]) setRawFile(files[0]);
  };

  const handleCollectionMixUpload = (files) => {
    if (files && files[0]) setCollectionMixFile(files[0]);
  };

  const generateCollectionMixTemplateData = (jsonData) => {
    const validRows = jsonData.filter(row => {
        const sub = row['Sub category'] ? String(row['Sub category']) : '';
        return (row['Category'] && row['Sub category'] && !sub.includes('(Spine)') && !sub.includes('(Front)'));
    });
    
    const collectionMixData = validRows.map(row => ({
      'Category': row['Category'],
      'Sub category': row['Sub category'],
      'Target end state collection': '', 
      'Retained': ''                     
    }));

    localStorage.setItem('generated_collection_mix_structure', JSON.stringify(collectionMixData));
    console.log(`Generated Collection Mix Template structure with ${collectionMixData.length} rows.`);
  };

  const handleLabelUpload = (files) => {
    if (files.length > 0) {
      const file = files[0];
      const today = new Date().toISOString().split('T')[0];
      
      setCurrentLabelFile({ name: file.name, date: today, size: (file.size / 1024).toFixed(1) + ' KB' });

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const shelfRunSheetName = workbook.SheetNames.find(s => s.toLowerCase().trim() === 'shelf run');
          if (shelfRunSheetName) {
             const ws = workbook.Sheets[shelfRunSheetName];
             const rawJson = XLSX.utils.sheet_to_json(ws);
             generateCollectionMixTemplateData(rawJson);
          }
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Failed to read file structure. Please ensure it is a valid Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);

      const storageReader = new FileReader();
      storageReader.onload = (e) => {
          localStorage.setItem('settings_label_file_data', e.target.result);
      };
      storageReader.readAsDataURL(file);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/Labels.xlsx'; 
    link.setAttribute('download', 'Labels.xlsx'); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrentLabels = () => {
    const labelBase64 = localStorage.getItem('settings_label_file_data');
    const labelMeta = JSON.parse(localStorage.getItem('settings_label_file_meta'));

    if (labelBase64 && labelMeta) {
      const link = document.createElement('a');
      link.href = labelBase64;
      // Requirement: Download as "Existing Labels"
      link.setAttribute('download', 'Existing Labels.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
        alert("No existing labels file found.");
    }
  };

  const handleDownloadCollectionMix = () => {
    try {
      const storedStructure = localStorage.getItem('generated_collection_mix_structure');
      let dataToExport;
      if (storedStructure) {
        dataToExport = JSON.parse(storedStructure);
      } else {
        dataToExport = [
          { 'Category': "Adult's English Fiction", 'Sub category': 'Fiction', 'Target end state collection': '', 'Retained': '' },
          { 'Category': "Children's Singapore Collection", 'Sub category': 'English - Fiction', 'Target end state collection': '', 'Retained': '' }
        ];
        alert("Note: Using default template. Upload Labels in Settings for custom template.");
      }
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 25 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Collection Mix Template");
      XLSX.writeFile(wb, "Collection_Mix_Template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
    }
  };

  const handleSaveInputs = () => {
    localStorage.setItem('shelf_target_size', targetSize);
    localStorage.setItem('shelf_current_size', currentSize);
    setSaveMessage('Inputs saved!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleCalculate = async () => {
    if (!targetSize || !currentSize) {
        alert("Please fill in all parameters.");
        return;
    }
    if (!rawFile || !collectionMixFile) {
        alert("Please upload both Raw Data and Collection Mix files.");
        return;
    }

    const storedLabelMeta = JSON.parse(localStorage.getItem('settings_label_file_meta'));
    const labelBase64 = localStorage.getItem('settings_label_file_data'); 
    if (!labelBase64) {
        alert("Label file not found. Please go to 'Labels Set Up' tab and upload your Labels file first.");
        return;
    }
    const labelFile = dataURLtoFile(labelBase64, storedLabelMeta?.name || "Labels.xlsx");

    setIsLoading(true);

    try {
        const formData = new FormData();
        formData.append('raw_data', rawFile);
        formData.append('collection_mix', collectionMixFile);
        formData.append('labels', labelFile);
        formData.append('target_size', targetSize);
        formData.append('current_size', currentSize);
        formData.append('username', localStorage.getItem('currentUser'));

        const token = localStorage.getItem('currentUser');

        const response = await fetch(`${API_BASE_URL}/calculate-shelf`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Calculation failed on server.");
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let serverFileName = `Shelf_Run_${new Date().toISOString().slice(0,10)}.docx`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length === 2) {
                serverFileName = filenameMatch[1];
            }
        }
        setDownloadName(serverFileName);

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setDownloadUrl(url); 
        
        // const newHistoryItem = {
        //   id: Date.now(),
        //   name: serverFileName,
        //   type: 'Shelf Run Calculations',
        //   date: new Date().toISOString().split('T')[0]
        // };

        // const currentHistory = JSON.parse(localStorage.getItem('library_app_history') || '[]');
        // const updatedHistory = [newHistoryItem, ...currentHistory];
        // localStorage.setItem('library_app_history', JSON.stringify(updatedHistory));

        setResultsReady(true);
        setActiveChip('results');

    } catch (error) {
        console.error("Calculation Error:", error);
        alert(`Error: ${error.message}. Check if backend server is running.`);
    } finally {
        setIsLoading(false);
    }
  };

  const triggerDownload = () => {
      if (downloadUrl) {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.setAttribute('download', downloadName);
          document.body.appendChild(link);
          link.click();
          link.remove();
      }
  };

  const handleCancel = () => {
    setIsLoading(false);
    if (calculationTimeoutRef.current) clearTimeout(calculationTimeoutRef.current);
  };

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
    <div className="shelf-calculator-page">
      <div style={{width: '66%'}}> 
        <ChipProgress 
            activeChip={activeChip} 
            onChipClick={setActiveChip} 
            chipLabels={{ labels: 'Labels Set Up', input: 'Input Files', results: 'Results' }} 
        />
      </div>

      {activeChip === 'labels' && (
        <div className="card-grid">
             <div className="card-row">
                <div style={{flex: 1}}>
                    <GuideCard title="Filters Sheet Instructions" subtitle="Rules for editing the Filters tab:" steps={filtersInstructions} />
                </div>
                <div style={{flex: 1}}>
                    <GuideCard title="Shelf Run Sheet Instructions" subtitle="Rules for editing the Shelf Run tab:" steps={shelfRunInstructions} />
                </div>
             </div>

             <div className="card-row">
                <UploadCard 
                    icon="FileUp" 
                    title="Label File Management" 
                    subtitle={
                        <>
                            1. Click on Download Template to download and amend Labels (Refer to the 2 cards on top for instructions for each sheet in the Label File)<br/>
                            2. Click on Browse Files to upload your Labels<br/>
                            3. Click Next to move on to the new step<br/>
                            4. If you need to view your existing labels, click on the Download Existing Labels button
                        </>
                    } 
                    uploadText={
                            <span style={{ color: currentLabelFile ? '#008a63' : '#333', fontWeight: currentLabelFile ? '600' : 'bold' }}>
                              {currentLabelFile ? `Using: ${currentLabelFile.name}` : 'Upload new labels file'}
                            </span>
                    }
                    formatText={currentLabelFile ? `Uploaded on ${currentLabelFile.date} • ${currentLabelFile.size}` : "Excel (.xlsx)"}
                    buttonText="Browse Files" 
                    onFileSelect={handleLabelUpload} 
                    headerActions={
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                            {currentLabelFile && (
                                <Button variant="outline" size="small" onClick={handleDownloadCurrentLabels}>Download Existing Labels</Button>
                            )}
                            <Button variant="default" size="small" onClick={handleDownloadTemplate}>Download Template</Button>
                        </div>
                    }
                />
             </div>
        </div>
      )}

      {activeChip === 'input' && (
        <div className="card-grid">
            <div className="card-row">
                <GuideCard steps={[
                  "Fill in fields in Parameters",
                  "Upload Raw Data from QlikSense as an excel file",
                  "Upload the completed 'Collection Mix' excel file",
                  "Press the calculate button to receive a downloadable formatted Word document"
                ]} 
                subtitle="Before you get started, make sure you have downloaded and uploaded the amended Labelling Template in the 'Labels Set Up' tab." title="How to Use Guide" />
                <InputCard number="1." title="Parameters">
                <div className="form-content">
                    <p className="form-subtitle">α = target collection size / current collection size</p>
                    <div className="form-group">
                        <div className="input-row">
                            <div className="input-wrapper">
                                <label>Target Collection Size</label>
                                <input type="number" value={targetSize} onChange={(e) => setTargetSize(e.target.value)} placeholder="E.g. 120000" />
                            </div>
                            <div className="input-wrapper">
                                <label>Current Collection Size</label>
                                <input type="number" value={currentSize} onChange={(e) => setCurrentSize(e.target.value)} placeholder="E.g. 150000" />
                            </div>
                        </div>
                    </div>
                </div>
                </InputCard>
            </div>

            <div className="card-row">
                <UploadCard
                    number="2."
                    title="Raw Data from QlikSense"
                    subtitle={<>Steps: <br />
                      1. Go to QlikSense <br />
                      2. Under Streams, select "Everyone" <br />
                      3. Select "Circulation - [ALL]" <br />
                      4. Under Community, select "Collection Mix" <br />
                      5. Under the filter "Txn Calendar Year", choose a year to view data for the full year <br />
                      6. Under the filter "Item Branch Code", select the branch <br />
                      7. Under the filter "Select Item Media", select "BOOK-Book" <br />
                      8. Download the data<br /></>}
                    // uploadText={rawFile ? `Uploaded: ${rawFile.name}` : "Upload your spreadsheet"}
                    uploadText={
                            <span style={{ color: rawFile ? '#008a63' : '#333', fontWeight: rawFile ? '600' : 'bold' }}>
                              {rawFile ? `Uploaded: ${rawFile.name}` : 'Upload your spreadsheet'}
                            </span>
                    }
                    formatText="Excel (.xlsx), CSV"
                    onFileSelect={handleRawDataUpload}
                />

                <UploadCard
                  number="3." 
                  title="Collection Mix"
                  subtitle={<>Steps: <br />
                  1. Download "Collection Mix" template <br />
                  2. Fill in the figures for "Target end state collection" and "Retained collection".
                  </>}
                  // uploadText={collectionMixFile ? `Uploaded: ${collectionMixFile.name}` : "Upload your spreadsheet"}
                  uploadText={
                            <span style={{ color: collectionMixFile ? '#008a63' : '#333', fontWeight: collectionMixFile ? '600' : 'bold' }}>
                              {collectionMixFile ? `Uploaded: ${collectionMixFile.name}` : 'Upload your spreadsheet'}
                            </span>
                    }
                  formatText="Excel (.xlsx), CSV"
                  onFileSelect={handleCollectionMixUpload}
                  headerActions={<Button variant="default" onClick={handleDownloadCollectionMix}>Download Collection Mix Template</Button>}
                />
            </div>
        </div>
      )}
      
      {activeChip === 'results' && (
        <div className="results-area">
          {resultsReady ? (
            <ResultsCard onDownload={triggerDownload} />
          ) : (
            <div className="no-results-message">
              <h3>No Calculation Found</h3>
              <p>Please go back to the "Input Files" tab and run a calculation to see your results.</p>
            </div>
          )}
        </div>
      )}

      {activeChip === 'input' && isLoading && <Loader text="Calculating optimal shelf configuration..." />}

      <div className="page-actions">
        {activeChip === 'input' ? (
          isLoading ? (
            <><Button variant="danger-outline" onClick={handleCancel}>Cancel</Button><Button variant="default" disabled>Calculating...</Button></>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {saveMessage && <span className="save-message">{saveMessage}</span>}
                <Button variant="outline" onClick={handleSaveInputs}>Save Inputs</Button>
                <Button variant="default" onClick={handleCalculate}>Calculate</Button>
            </div>
          )
        ) : activeChip === 'labels' ? (
             <Button variant="default" onClick={() => setActiveChip('input')}>Next: Input Files</Button>
        ) : (
          <Button variant="default" onClick={() => {setActiveChip('input'); setResultsReady(false);}}>Restart Calculation</Button>
        )}
      </div>
    </div>
  );
}

export default ShelfCalculatorPage;