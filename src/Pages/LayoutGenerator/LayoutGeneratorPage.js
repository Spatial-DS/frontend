import React, { useState, useRef, useEffect } from 'react';
import './LayoutGeneratorPage.css';
import UploadCard from '../../components/Cards/UploadCard/UploadCard';
import SelectionCard from '../../components/Cards/SelectionCard/SelectionCard';
import InputCard from '../../components/Cards/InputCard/InputCard';
import ChipProgress from '../../components/ChipProgress/ChipProgress'; 
import Button from '../../components/Button/Button'; 
import Loader from '../../components/Loader/Loader';
import LayoutSuggestionCard from '../../components/Cards/LayoutSuggestionCard/LayoutSuggestionCard';
import PerformanceMetrics from '../../components/PerformanceMetrics/PerformanceMetrics';
import ZoneDistribution from '../../components/ZoneDistribution/ZoneDistribution';

// Mock data for the selection cards - UPDATED with Lucide names
const preferences = [
  { icon: 'Users', title: "Adult's & Teens Section" },
  { icon: 'Monitor', title: 'Reading & Digital Access Areas' },
  { icon: 'Toilet', title: 'Toilets' },
  { icon: 'DoorOpen', title: 'Program Rooms' },
  { icon: 'PersonStanding', title: 'Lobby & Transition' },
  { icon: 'Palette', title: "Children's Section" },
  { icon: 'Move', title: 'Entrances' },
  { icon: 'ArchiveRestore', title: 'Book Drop' }, 
];

// --- Mock Data for Results Page ---
const suggestedLayouts = [
  { 
    title: 'Efficient Flow Layout', 
    efficiency: 92, 
    flow: 89, 
    imageSrc: 'https://placehold.co/400x200/525864/FFF?text=Layout+1',
    description: 'Optimized for high traffic flow with central circulation desk and logical zone progression.'
  },
  { 
    title: 'Zone-Based Layout', 
    efficiency: 87, 
    flow: 94, 
    imageSrc: 'https://placehold.co/400x200/525864/FFF?text=Layout+2',
    description: 'Dedicated zones with clear boundaries and enhanced accessibility features.'
  },
  { 
    title: 'Zone-Based Layout', 
    efficiency: 87, 
    flow: 94, 
    imageSrc: 'https://placehold.co/400x200/525864/FFF?text=Layout+3',
    description: 'Dedicated zones with clear boundaries and enhanced accessibility features.'
  },
];

const performanceData = [
  { name: 'Space Efficiency', value: 92 },
  { name: 'Accessibility', value: 98 },
  { name: 'Traffic Flow', value: 89 },
];

const zoneData = [
  { name: "Adult's & Teens Section", area: 150, color: '#D6EAF8' },
  { name: "Children's Section", area: 120, color: '#FADBD8' },
  { name: 'Lobby & Transactions', area: 100, color: '#E8DAEF' },
  { name: 'Collaboration and Creativity', area: 100, color: '#D1F2EB' },
  { name: 'Reading & Digital Access Areas', area: 100, color: '#FDEDEC' },
  { name: 'Programs and Exhibitions', area: 300, color: '#FEF9E7' },
];
// ------------------------------------


function LayoutGeneratorPage() {
  const [activeChip, setActiveChip] = useState('input');
  const [isLoading, setIsLoading] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('Efficient Flow Layout');
  
  const generationTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    };
  }, []);

  const handleFileSelect = (files) => {
    console.log("Files selected:", files);
  };

  const handlePreferenceSelect = (title, isSelected) => {
    console.log("Preference changed:", title, isSelected);
  };

  const handleGenerate = () => {
    setIsLoading(true);
    generationTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setResultsReady(true);
      setActiveChip('results');
      generationTimeoutRef.current = null;
    }, 3000);
  };

  const handleCancel = () => {
    setIsLoading(false);
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
    console.log("Generation cancelled");
  };

  const handleRestart = () => {
    setResultsReady(false);
    setActiveChip('input');
    setSelectedLayout('Efficient Flow Layout'); // Reset selection
  };

  return (
    <div className="layout-generator-page">
      
      <ChipProgress 
        activeChip={activeChip} 
        onChipClick={setActiveChip} 
        chipLabels={{ input: 'Upload Data', results: 'Results' }}
      />

      {activeChip === 'input' && (
        <>
          <div className="layout-content-grid">
            <div className="layout-column-left">
              <InputCard icon="ListChecks" title="Furnishing Requirements">
                <div className="form-content">
                  <label htmlFor="inventory-collection">Inventory Collection</label>
                  <select id="inventory-collection" name="inventory-collection">
                    <option value="new">New Inventory</option>
                    <option value="existing">Existing Inventory</option>
                  </select>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="front-facing">Number of Front Facing Shelves</label>
                      <input type="text" id="front-facing" placeholder="Eg. 2200" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="spine-facing">Number of Spine Facing Shelves</label>
                      <input type="text" id="spine-facing" placeholder="Eg. 300" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="floor-area">Total Floor Area (m2)</label>
                      <input type="text" id="floor-area" placeholder="Eg. 1000" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tiers">Tiers per Shelf</label>
                      <input type="text" id="tiers" placeholder="Eg. 4" />
                    </div>
                  </div>
                </div>
              </InputCard>
            </div>
            <div className="layout-column-right">
              <UploadCard
                icon="Map"
                title="Floor Plan Upload"
                subtitle="Upload your building's floor plan for accurate layout generation."
                uploadText="Drag and drop your floor plan or click to browse"
                formatText="Supports PDF, PNG, JPG, DWG formats"
                buttonText="Browse Files"
                onFileSelect={handleFileSelect}
              />
            </div>
          </div>
          <InputCard icon="AppWindow" title="Additional Preferences">
            <p className="preferences-subtitle">
              Specify any additional requirements or constraints for the layout.
            </p>
            <div className="preferences-grid">
              {preferences.map((pref) => (
                <SelectionCard
                  key={pref.title}
                  icon={pref.icon}
                  title={pref.title}
                  onSelect={handlePreferenceSelect}
                />
              ))}
            </div>
          </InputCard>
        </>
      )}
      
      {activeChip === 'results' && (
        <div className="results-area">
          {resultsReady ? (
            <>
              <div className="results-grid-top">
                {suggestedLayouts.map((layout, index) => (
                  <LayoutSuggestionCard
                    key={index}
                    title={layout.title}
                    efficiency={layout.efficiency}
                    flow={layout.flow}
                    imageSrc={layout.imageSrc}
                    description={layout.description}
                    isSelected={selectedLayout === layout.title}
                    onClick={() => setSelectedLayout(layout.title)}
                  />
                ))}
              </div>
              <div className="results-grid-bottom">
                <ZoneDistribution zones={zoneData} />
                <PerformanceMetrics metrics={performanceData} />
              </div>
            </>
          ) : (
            <div className="no-results-message">
              <h3>No Generation Found</h3>
              <p>Please go back to the "Upload Data" tab and run a generation to see your results.</p>
            </div>
          )}
        </div>
      )}

      {activeChip === 'input' && isLoading && (
        <Loader text="Generating optimal layout..." />
      )}

      <div className="page-actions">
        {activeChip === 'input' ? (
          // --- Input Tab ---
          isLoading ? (
            // Loading state
            <>
              <Button variant="danger-outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="default" disabled>
                Generating...
              </Button>
            </>
          ) : (
            // Default input state
            <>
              <Button variant="outline" size="default">
                Save
              </Button>
              <Button variant="default" size="default" onClick={handleGenerate}>
                Generate
              </Button>
            </>
          )
        ) : (
          // --- Results Tab ---
          resultsReady ? (
            // Results are ready
            <>
              <Button variant="outline" size="default">Customise</Button>
              <Button variant="outline" size="default">3D Preview</Button>
              <div style={{ flex: 1 }}></div> {/* Spacer */}
              <Button variant="outline" size="default" onClick={handleRestart}>
                Restart
              </Button>
              <Button variant="outline" size="default">Regenerate</Button>
              <Button variant="default" size="default">
                Download Layout File
              </Button>
            </>
          ) : (
            // No results ready
            <Button variant="default" size="default" onClick={handleRestart}>
              Restart
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export default LayoutGeneratorPage;