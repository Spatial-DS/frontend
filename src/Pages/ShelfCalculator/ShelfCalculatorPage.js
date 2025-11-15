import React, { useState, useRef, useEffect } from 'react';
import ChipProgress from '../../components/ChipProgress/ChipProgress';
import Loader from '../../components/Loader/Loader'; 
import Button from '../../components/Button/Button'; 
import UploadCard from '../../components/Cards/UploadCard/UploadCard'; 
import InputCard from '../../components/Cards/InputCard/InputCard';   
import ResultsCard from '../../components/Cards/ResultsCard/ResultsCard';
import './ShelfCalculatorPage.css';

function ShelfCalculatorPage() {
  const [activeChip, setActiveChip] = useState('input');
  const [alphaValue, setAlphaValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  
  const calculationTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
  }, []);

  const handleFileSelected = (files) => {
    if (files.length > 0) {
      console.log("Files selected:", files[0].name);
      // You can add your file upload logic here
    }
  };

  const handleCalculate = () => {
    setIsLoading(true);
    calculationTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setActiveChip('results');
      setResultsReady(true);
      calculationTimeoutRef.current = null;
    }, 3000); 
  };

  const handleCancel = () => {
    setIsLoading(false);
    
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
      calculationTimeoutRef.current = null;
    }
    
    console.log("Calculation cancelled");
  };

  return (
    <div className="shelf-calculator-page">
      <ChipProgress 
        activeChip={activeChip} 
        onChipClick={setActiveChip} 
      />

      {activeChip === 'input' && (
        <div className="input-area">
          <UploadCard
            icon="Library" 
            title="Meter Run Collection Mix"
            subtitle="Upload your Excel file with detailed book inventory information."
            uploadText="Upload your meter run collection spreadsheet"
            formatText="Excel (.xlsx), CSV, or Google Sheets format"
            onFileSelect={handleFileSelected}
          />
          <UploadCard
            icon="Target" 
            title="Target End State and Retained Collection"
            subtitle="Upload your Excel file with detailed book inventory information."
            uploadText="Upload your target end state and retained collection spreadsheet"
            formatText="Excel (.xlsx), CSV, or Google Sheets format"
            onFileSelect={handleFileSelected}
          />

          <InputCard
            icon="Ruler" 
            title="Volume on Shelf"
            headerActions={
              <Button 
                variant="default" 
                size="small" 
                onClick={() => console.log('Download template clicked')}
              >
                Download Holdings Template
              </Button>
            }
          >
            <div className="form-content">
              <p className="form-subtitle"> 
                Please fill in the alpha value for the following formula:
                Holding = (Loans and Renewals x α/12) + (Returns x α/12)
              </p>
              
              <div className="form-group">
                <label htmlFor="alpha-value">α value:</label>
                <input 
                  id="alpha-value"
                  type="text"
                  value={alphaValue} 
                  onChange={(e) => setAlphaValue(e.target.value)} 
                  placeholder="E.g. 0.5"
                />
              </div>
            </div>
          </InputCard> 

          <UploadCard 
            icon="FileUp" 
            title="Holdings File"
            subtitle="Upload your Excel file with your filled out holdings."
            uploadText="Upload your filled out Holdings File"
            formatText="Excel (.xlsx), CSV, or Google Sheets format"
            onFileSelect={handleFileSelected}
          />
        </div>
      )}
      
      {activeChip === 'results' && (
        <div className="results-area">
          {resultsReady ? (
            <ResultsCard />
          ) : (
            <div className="no-results-message">
              <h3>No Calculation Found</h3>
              <p>Please go back to the "Input Files" tab and run a calculation to see your results.</p>
            </div>
          )}
        </div>
      )}

      {activeChip === 'input' && isLoading && (
        <Loader text="Calculating optimal shelf configuration..." />
      )}

      <div className="page-actions">
        {activeChip === 'input' ? (
          isLoading ? (
            <>
              <Button variant="danger-outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="default" disabled>
                Calculating...
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={handleCalculate}>
              Calculate
            </Button>
          )
        ) : (
          // Default state on Results tab
          <Button 
            variant="default" 
            onClick={() => {
              setActiveChip('input');
              setResultsReady(false);
            }}
          >
            Restart Calculation
          </Button>
        )}
      </div>
    </div>
  );
}

export default ShelfCalculatorPage;