import React, { useState, useRef, useEffect } from 'react';
import './LayoutGeneratorPage.css';

// --- Component Imports ---
import UploadCard from '../../Components/Cards/UploadCard/UploadCard';
import SelectionCard from '../../Components/Cards/SelectionCard/SelectionCard';
import InputCard from '../../Components/Cards/InputCard/InputCard';
import ChipProgress from '../../Components/ChipProgress/ChipProgress'; 
import Button from '../../Components/Button/Button'; 
import Loader from '../../Components/Loader/Loader';
import LayoutSuggestionCard from '../../Components/Cards/LayoutSuggestionCard/LayoutSuggestionCard';
import FloorPlanTracer from '../../Components/FloorPlanTracer/FloorPlanTracer';
import GuideCard from '../../Components/Cards/GuideCard/GuideCard'; 
import Icon from '../../Components/Icon/Icon';

// --- Constants ---
const INITIAL_ZONES = [
    { icon: 'Users', title: "Adult's & Teens Section", isSelected: false, area: '', color: '#0047BB' },
    { icon: 'Monitor', title: 'Reading & Digital Access Areas', isSelected: false, area: '', color: '#E8002A' },
    { icon: 'Toilet', title: 'Toilets', isSelected: false, area: '', color: '#00B074' },
    { icon: 'DoorOpen', title: 'Program Rooms', isSelected: false, area: '', color: '#F39C12' },
    { icon: 'PersonStanding', title: 'Lobby & Transition', isSelected: false, area: '', color: '#8E44AD' },
    { icon: 'Palette', title: "Children's Section", isSelected: false, area: '', color: '#E91E63' },
];

// --- Helper: Convert Image to Base64 for Storage ---
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

function LayoutGeneratorPage() {
  // --- Main UI State ---
  const [activeChip, setActiveChip] = useState('input');
  const [isLoading, setIsLoading] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  
  // --- Results View State ---
  const [selectedLayout, setSelectedLayout] = useState('Efficient Flow Layout');
  const [resultActiveFloorIndex, setResultActiveFloorIndex] = useState(0);
  const [resultFloorImages, setResultFloorImages] = useState([]);
  const [layoutResults, setLayoutResults] = useState({});
  const [floorNames, setFloorNames] = useState([]);

  // --- Persistence: Zones ---
  const [zoneSettings, setZoneSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('library_zone_settings');
      return saved ? JSON.parse(saved) : INITIAL_ZONES;
    } catch (e) { return INITIAL_ZONES; }
  });

  // --- Persistence: Floors ---
  const [floors, setFloors] = useState(() => {
    try {
      const saved = localStorage.getItem('library_layout_floors');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // --- Persistence: Active Tab ---
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('library_layout_active_tab');
      return saved ? JSON.parse(saved) : 'add';
    } catch (e) { return 'add'; }
  });

  // --- Effects: Save to LocalStorage ---
  useEffect(() => {
    localStorage.setItem('library_layout_floors', JSON.stringify(floors));
    localStorage.setItem('library_layout_active_tab', JSON.stringify(activeTab));
  }, [floors, activeTab]);

  useEffect(() => {
    localStorage.setItem('library_zone_settings', JSON.stringify(zoneSettings));
  }, [zoneSettings]);

  const generationTimeoutRef = useRef(null);
  useEffect(() => {
    return () => { if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current); };
  }, []);

  // --- Handlers: Zone Input ---
  const handleZoneToggle = (index) => {
    const newZones = [...zoneSettings];
    newZones[index].isSelected = !newZones[index].isSelected;
    setZoneSettings(newZones);
  };

  const handleZoneAreaChange = (index, value) => {
    const newZones = [...zoneSettings];
    newZones[index].area = value;
    setZoneSettings(newZones);
  };

  // --- Handlers: File Upload & Tracing ---
  const handleFileSelect = async (files) => {
    if (files && files[0]) {
      try {
        const base64Image = await fileToBase64(files[0]);
        const newFloorId = Date.now();
        const newFloor = {
          id: newFloorId,
          name: `Floor ${floors.length + 1}`,
          image: base64Image,
          zones: null
        };
        setFloors([...floors, newFloor]);
        setActiveTab(newFloorId);
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
  };
  
  const handleTraceSave = (points) => {
    const updatedFloors = floors.map(f => {
      if (f.id === activeTab) return { ...f, zones: points };
      return f;
    });
    setFloors(updatedFloors);
  };

  const handleTraceCancel = () => {
    const remainingFloors = floors.filter(f => f.id !== activeTab);
    setFloors(remainingFloors);
    if (remainingFloors.length > 0) setActiveTab(remainingFloors[remainingFloors.length - 1].id);
    else setActiveTab('add');
  };

  // --- Handlers: Generation Logic ---
  const handleGenerate = () => {
    setIsLoading(true);
    
    const activeZones = zoneSettings.filter(z => z.isSelected);
    const currentFloors = floors.length > 0 ? floors : [{ name: "Floor 1" }]; 
    const currentImages = floors.map(f => f.image);

    // Mock Distribution Algorithm
    const generateMockDistribution = (layoutType) => {
      const floorDistributions = currentFloors.map(() => []);
      
      activeZones.forEach(zone => {
        const totalArea = parseInt(zone.area) || 0;
        
        if (currentFloors.length === 1) {
           floorDistributions[0].push({ ...zone, area: totalArea });
        } else {
           if (layoutType === 'Efficient Flow Layout') {
             const areaPerFloor = Math.floor(totalArea / currentFloors.length);
             currentFloors.forEach((_, idx) => {
               if (areaPerFloor > 0) floorDistributions[idx].push({ ...zone, area: areaPerFloor });
             });
           } else if (layoutType === 'Zone-Based Layout') {
             const randomFloor = Math.floor(Math.random() * currentFloors.length);
             floorDistributions[randomFloor].push({ ...zone, area: totalArea });
           } else {
             const firstFloorArea = Math.floor(totalArea * 0.7);
             const restArea = totalArea - firstFloorArea;
             floorDistributions[0].push({ ...zone, area: firstFloorArea });
             if (restArea > 0 && currentFloors.length > 1) {
                 floorDistributions[1].push({ ...zone, area: restArea });
             }
           }
        }
      });
      return floorDistributions;
    };

    const mockResults = {
      'Efficient Flow Layout': generateMockDistribution('Efficient Flow Layout'),
      'Zone-Based Layout': generateMockDistribution('Zone-Based Layout'),
      'Accessible Layout': generateMockDistribution('Accessible Layout'),
    };

    generationTimeoutRef.current = setTimeout(() => {
      setLayoutResults(mockResults);
      setFloorNames(currentFloors.map(f => f.name));
      setResultFloorImages(currentImages);
      
      setIsLoading(false);
      setResultsReady(true);
      setActiveChip('results');
      generationTimeoutRef.current = null;
    }, 2500);
  };

  const handleCancel = () => {
    setIsLoading(false);
    if (generationTimeoutRef.current) clearTimeout(generationTimeoutRef.current);
  };

  const handleRestart = () => {
    setResultsReady(false);
    setActiveChip('input');
    setFloors([]);
    setActiveTab('add');
    setZoneSettings(INITIAL_ZONES);
    localStorage.removeItem('library_layout_floors');
    localStorage.removeItem('library_layout_active_tab');
    localStorage.removeItem('library_zone_settings');
    setSelectedLayout('Efficient Flow Layout');
  };

  const handleCustomise = () => {
    setResultsReady(false);
    setActiveChip('input');
  };

  const currentFloor = floors.find(f => f.id === activeTab);

  // --- Helper: Results Zone Grid (Figma Style) ---
  const ZoneGrid = ({ zones }) => (
    <div className="zone-distribution-container">
        <div className="zone-grid">
            {zones.map((zone, idx) => (
                <div key={idx} className="zone-chip">
                    <div className="zone-color" style={{ backgroundColor: zone.color }}></div>
                    <div className="zone-info">
                        <span className="zone-name">{zone.title}</span>
                        <span className="zone-area">{zone.area ? `${zone.area} m²` : '0 m²'}</span>
                    </div>
                </div>
            ))}
            {(!zones || zones.length === 0) && (
                <p style={{color: '#999', fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem'}}>
                    No zones allocated to this floor.
                </p>
            )}
        </div>
    </div>
  );

  // Get data for display
  const currentLayoutData = layoutResults[selectedLayout] || [];
  const currentFloorZones = currentLayoutData[resultActiveFloorIndex] || [];

  return (
    <div className="layout-generator-page">
      <ChipProgress 
        activeChip={activeChip} 
        onChipClick={setActiveChip} 
        chipLabels={{ input: 'Upload Data', results: 'Results' }} 
      />

      {/* --- INPUT VIEW --- */}
      {activeChip === 'input' && (
        <div className="layout-content-grid">
            <div className="layout-column-left">
                <GuideCard 
                    steps={["Upload your floorplan", "Trace your floorplan", "Choose your zones", "Add more floors with +"]} 
                    title="Process Guide" 
                />
                <InputCard icon="AppWindow" title="Zones Required">
                    <p className="preferences-subtitle">Specify any additional requirements.</p>
                    <div className="preferences-grid">
                    {zoneSettings.map((zone, index) => (
                        <SelectionCard
                            key={zone.title}
                            icon={zone.icon}
                            title={zone.title}
                            isSelected={zone.isSelected}
                            onToggle={() => handleZoneToggle(index)}
                            areaValue={zone.area}
                            onAreaChange={(val) => handleZoneAreaChange(index, val)}
                        />
                    ))}
                    </div>
                </InputCard>
            </div>
            
            <div className="layout-column-right">
              <div className="floor-tabs-container">
                {floors.map(floor => (
                    <button 
                        key={floor.id} 
                        className={`floor-tab ${activeTab === floor.id ? 'active' : ''}`} 
                        onClick={() => setActiveTab(floor.id)}
                    >
                        {floor.name}
                    </button>
                ))}
                <button 
                    className={`floor-tab add-tab ${activeTab === 'add' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('add')}
                >
                    <Icon name="Plus" size={16} />
                </button>
              </div>

              {activeTab === 'add' ? (
                <UploadCard 
                    icon="Map" 
                    title="Floor Plan Upload" 
                    subtitle="Upload floor plan." 
                    uploadText="Drag and drop or browse" 
                    formatText="PDF, PNG, JPG, DWG" 
                    buttonText="Browse Files" 
                    onFileSelect={handleFileSelect} 
                />
              ) : (
                currentFloor && (
                    <FloorPlanTracer 
                        key={currentFloor.id} 
                        imageSrc={currentFloor.image} 
                        savedZone={currentFloor.zones} 
                        onSave={handleTraceSave} 
                        onCancel={handleTraceCancel} 
                    />
                )
              )}
            </div>
        </div>
      )}
      
      {/* --- RESULTS VIEW --- */}
      {activeChip === 'results' && (
        <div className="results-area">
          {resultsReady ? (
            <>
              {/* Top: Layout Candidates */}
              <div className="results-grid-top">
                {['Efficient Flow Layout', 'Zone-Based Layout', 'Accessible Layout'].map((title, index) => (
                  <LayoutSuggestionCard
                    key={index}
                    title={title}
                    floorNames={floorNames}
                    floorImages={resultFloorImages}
                    isSelected={selectedLayout === title}
                    onClick={() => setSelectedLayout(title)}
                  />
                ))}
              </div>

              {/* Selected Layout Header */}
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="BarChart3" size={20} /> 
                <h4 style={{ margin: 0 }}>{selectedLayout}</h4>
              </div>

              {/* Bottom: Details */}
              <div className="results-grid-bottom">
                
                {/* Zone Distribution Card */}
                <div className="card" style={{ padding: '1.5rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h5 style={{ fontWeight: 'bold', margin: 0 }}>Zone Distribution Breakdown</h5>
                        
                        {/* Results Floor Switcher */}
                        <div className="results-floor-tabs">
                            {floorNames.map((name, idx) => (
                                <button 
                                    key={idx} 
                                    className={`results-floor-tab ${resultActiveFloorIndex === idx ? 'active' : ''}`} 
                                    onClick={() => setResultActiveFloorIndex(idx)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ZoneGrid zones={currentFloorZones} />
                </div>

                {/* Preferences Input Card (REPLACED with InputCard) */}
                <InputCard
                    icon="Settings"
                    title="Additional Preferences"
                    subtitle="Specify any additional requirements or constraints for all the layouts."
                    headerActions={<Button variant="default" size="small">Submit</Button>}
                >
                    <textarea 
                        className="preferences-textarea"
                        placeholder="Please describe any requirements, accessibility needs or constraints..."
                    ></textarea>
                </InputCard>
              </div>
            </>
          ) : (
            <div className="no-results-message"><h3>No Generation Found</h3></div>
          )}
        </div>
      )}

      {/* --- Footer Actions --- */}
      {activeChip === 'input' && isLoading && <Loader text="Generating optimal layout..." />}

      <div className="page-actions">
        {activeChip === 'input' ? (
          isLoading ? (
            <>
                <Button variant="danger-outline" onClick={handleCancel}>Cancel</Button>
                <Button variant="default" disabled>Generating...</Button>
            </>
          ) : (
            <>
                <Button variant="outline" size="default">Save</Button>
                <Button variant="default" size="default" onClick={handleGenerate} disabled={floors.length === 0}>Generate</Button>
            </>
          )
        ) : (
          resultsReady ? (
            <>
              <div style={{ flex: 1 }}></div>
              <Button variant="outline" size="default" onClick={handleRestart}>Restart</Button>
              <Button variant="outline" size="default" onClick={handleCustomise}>Regenerate</Button>
              <Button variant="default" size="default">Download Layout File</Button>
            </>
          ) : (
            <Button variant="default" size="default" onClick={handleRestart}>Restart</Button>
          )
        )}
      </div>
    </div>
  );
}

export default LayoutGeneratorPage;