import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx'; 
import ChipProgress from '../../Components/ChipProgress/ChipProgress';
import Loader from '../../Components/Loader/Loader'; 
import Button from '../../Components/Button/Button'; 
import UploadCard from '../../Components/Cards/UploadCard/UploadCard'; 
import InputCard from '../../Components/Cards/InputCard/InputCard';   
import ResultsCard from '../../Components/Cards/ResultsCard/ResultsCard';
import GuideCard from '../../Components/Cards/GuideCard/GuideCard'; 
import './ShelfCalculatorPage.css';

function ShelfCalculatorPage() {
  const [activeChip, setActiveChip] = useState('input');
  const [numMonths, setNumMonths] = useState('');
  const [targetSize, setTargetSize] = useState('');
  const [currentSize, setCurrentSize] = useState('');
  
  const [rawFile, setRawFile] = useState(null);
  const [holdingsFile, setHoldingsFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("Shelf_Run_Report.docx"); // Store name for download button

  const [isLoading, setIsLoading] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const calculationTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (calculationTimeoutRef.current) clearTimeout(calculationTimeoutRef.current); };
  }, []);

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

  const handleHoldingsUpload = (files) => {
    if (files && files[0]) setHoldingsFile(files[0]);
  };

  const handleDownloadHoldings = () => {
    try {
      const storedStructure = localStorage.getItem('generated_holdings_structure');
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
      XLSX.utils.book_append_sheet(wb, ws, "Holdings Template");
      XLSX.writeFile(wb, "Holdings_Template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
    }
  };

  const handleCalculate = async () => {
    if (!numMonths || !targetSize || !currentSize) {
        alert("Please fill in all parameters.");
        return;
    }
    if (!rawFile || !holdingsFile) {
        alert("Please upload both Raw Data and Holdings files.");
        return;
    }

    const storedLabelMeta = JSON.parse(localStorage.getItem('settings_label_file_meta'));
    const labelBase64 = localStorage.getItem('settings_label_file_data'); 
    if (!labelBase64) {
        alert("Label file not found. Please go to Settings and upload your Labels file first.");
        return;
    }
    const labelFile = dataURLtoFile(labelBase64, storedLabelMeta?.name || "Labels.xlsx");

    setIsLoading(true);

    try {
        const formData = new FormData();
        formData.append('raw_data', rawFile);
        formData.append('holdings', holdingsFile);
        formData.append('labels', labelFile);
        formData.append('target_size', targetSize);
        formData.append('current_size', currentSize);
        formData.append('months', numMonths);

        const response = await fetch('http://localhost:5000/calculate-shelf', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Calculation failed on server.");
        }

        // Get Filename from headers for history
        const contentDisposition = response.headers.get('Content-Disposition');
        let serverFileName = `Shelf_Run_${new Date().toISOString().slice(0,10)}.docx`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length === 2) {
                serverFileName = filenameMatch[1];
            }
        }
        setDownloadName(serverFileName);

        // Get file blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setDownloadUrl(url); 
        
        // --- SAVE TO HISTORY ---
        const newHistoryItem = {
          id: Date.now(),
          name: serverFileName,
          type: 'Shelf Run Calculations',
          date: new Date().toISOString().split('T')[0]
        };

        const currentHistory = JSON.parse(localStorage.getItem('library_app_history') || '[]');
        const updatedHistory = [newHistoryItem, ...currentHistory];
        localStorage.setItem('library_app_history', JSON.stringify(updatedHistory));

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

  const guideSteps = [
    "Fill in the fields in Parameters.",
    "Upload Raw Data from NLB Database as an Excel file with loans and return collection data.",
    "Click 'Download Holdings Template'.", 
    "Open the template and fill in the 'Target end state collection' and 'Retained' columns.",
    "Upload the completed Holdings file.",
    "Press the calculate button to receive a downloadable formatted Word document."
  ];

  const guideSubtitle = "Before you get started, make sure you have downloaded and uploaded the amended Labelling Template in the Settings Page.";

  return (
    <div className="shelf-calculator-page">
      <ChipProgress activeChip={activeChip} onChipClick={setActiveChip} />

      {activeChip === 'input' && (
        <div className="card-grid">
            <div className="card-row">
                <GuideCard steps={guideSteps} subtitle={guideSubtitle} />
                <InputCard icon="Ruler" title="Parameters">
                <div className="form-content">
                    <p className="form-subtitle">α = target collection size / current collection size</p>
                    <div className="form-group">
                        <div className="input-wrapper">
                            <label>Number of Months</label>
                            <input type="number" value={numMonths} onChange={(e) => setNumMonths(e.target.value)} placeholder="E.g. 12" />
                        </div>
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
                    icon="Library" 
                    title="Raw Data from NLB Database"
                    subtitle={<>Upload your Excel file with loans and return collection data.<br /><span style={{ visibility: 'hidden', lineHeight: '1.5em' }}>&nbsp;</span></>}
                    uploadText={rawFile ? `Uploaded: ${rawFile.name}` : "Upload the Raw Data spreadsheet"}
                    formatText="Excel (.xlsx), CSV"
                    onFileSelect={handleRawDataUpload}
                />

                <UploadCard
                  icon="Target" 
                  title="Holdings"
                  subtitle="Upload your Excel file with Target End State and Retained Collection."
                  uploadText={holdingsFile ? `Uploaded: ${holdingsFile.name}` : "Upload your target end state spreadsheet"}
                  formatText="Excel (.xlsx), CSV"
                  onFileSelect={handleHoldingsUpload}
                  headerActions={<Button variant="default" onClick={handleDownloadHoldings}>Download Holdings Template</Button>}
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
            <Button variant="default" onClick={handleCalculate}>Calculate</Button>
          )
        ) : (
          <Button variant="default" onClick={() => {setActiveChip('input'); setResultsReady(false);}}>Restart Calculation</Button>
        )}
      </div>
    </div>
  );
}

export default ShelfCalculatorPage;