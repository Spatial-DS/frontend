import React, { useState, useRef, useEffect } from 'react';
import './LayoutGeneratorPage.css';

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
import ResultVisualizer from '../../Components/ResultVisualizer/ResultVisualizer';

export const INITIAL_ZONES = [
  { short: 'ent', title: 'Entrance', icon: 'Library', isSelected: true, mode: 'percent', area: 1, color: '#3366cc' },
  { short: 'lob', title: 'Lobby/Transition', icon: 'PersonStanding', isSelected: true, mode: 'auto', area: '', color: '#cc9933' },
  { short: 'bdr', title: 'Bookdrop', icon: 'Archive', isSelected: true, mode: 'sqm', area: 10, color: '#ff8800' },
  { short: 'loc', title: 'Reservation Lockers', icon: 'Package', isSelected: true, mode: 'sqm', area: 3, color: '#8844cc' },
  { short: 'met', title: 'Meeting Rooms', icon: 'DoorOpen', isSelected: true, mode: 'auto', area: '', color: '#008877' },
  { short: 'sty', title: 'Study Area', icon: 'BookOpen', isSelected: true, mode: 'auto', area: '', color: '#66aadd' },
  { short: 'adl', title: 'Adult Collection', icon: 'Library', isSelected: true, mode: 'percent', area: 35, color: '#2e7d32' },
  { short: 'exh', title: 'Exhibitions', icon: 'Image', isSelected: false, mode: 'percent', area: 5, color: '#cc2288' },
  { short: 'prg', title: 'Programming Space', icon: 'Users', isSelected: true, mode: 'percent', area: 5, color: '#ddaa00' },
  { short: 'chd', title: "Children's Collection", icon: 'Palette', isSelected: true, mode: 'percent', area: 10, color: '#ffdd33' },
  { short: 'com', title: 'Community Owned Space', icon: 'UsersRound', isSelected: false, mode: 'percent', area: 5, color: '#8d6e63' },
  { short: 'yth', title: 'Youth Collection', icon: 'Users', isSelected: true, mode: 'percent', area: 5, color: '#00bcd4' },
  { short: 'stf', title: 'Staff Areas (e.g. Back-of-House)', icon: 'Briefcase', isSelected: true, mode: 'percent', area: 10, color: '#555555' },
  { short: 'toi', title: 'Toilets', icon: 'Toilet', isSelected: true, mode: 'sqm', area: 15, color: '#bbbbbb' },
  { short: 'caf', title: 'Cafe', icon: 'Coffee', isSelected: false, mode: 'percent', area: 5, color: '#cc3333' },
  { short: 'esc', title: 'Stairs/Escalators/Lifts', icon: 'Stairs', isSelected: true, mode: 'sqm', area: 10, color: '#888888' },
];

const API_BASE_URL = "http://localhost:8000";

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

function LayoutGeneratorPage() {
  const [activeChip, setActiveChip] = useState('input');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultsReady, setResultsReady] = useState(false);

  const [totalGFA, setTotalGFA] = useState(10000);
  const [preferencesText, setPreferencesText] = useState("");

  const [resultActiveFloorIndex, setResultActiveFloorIndex] = useState(0);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [apiResult, setApiResult] = useState(null);

  // Persistence
  const [zoneSettings, setZoneSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('library_zone_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && !parsed[0].short) return INITIAL_ZONES;
        return parsed;
      }
      return INITIAL_ZONES;
    } catch (e) { return INITIAL_ZONES; }
  });
  const [floors, setFloors] = useState(() => {
    try {
      const saved = localStorage.getItem('library_layout_floors');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('library_layout_active_tab');
      return saved ? JSON.parse(saved) : 'add';
    } catch (e) { return 'add'; }
  });

  useEffect(() => {
    localStorage.setItem('library_layout_floors', JSON.stringify(floors));
    localStorage.setItem('library_layout_active_tab', JSON.stringify(activeTab));
  }, [floors, activeTab]);
  useEffect(() => {
    localStorage.setItem('library_zone_settings', JSON.stringify(zoneSettings));
  }, [zoneSettings]);

  // Handlers
  const handleZoneToggle = (index) => {
    const newZones = [...zoneSettings];
    const isNowSelected = !newZones[index].isSelected;
    newZones[index].isSelected = isNowSelected;
    if (isNowSelected) {
      newZones[index].mode = 'auto';
      newZones[index].area = '';
    }
    setZoneSettings(newZones);
  };
  const handleModeCycle = (index, e) => {
    e.stopPropagation();
    const newZones = [...zoneSettings];
    const modes = ['auto', 'sqm', 'percent'];
    const currentMode = newZones[index].mode || 'auto';
    const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
    newZones[index].mode = nextMode;
    if (nextMode === 'auto') newZones[index].area = '';
    setZoneSettings(newZones);
  };
  const handleZoneAreaChange = (index, value) => {
    const newZones = [...zoneSettings];
    newZones[index].area = value;
    setZoneSettings(newZones);
  };

  const handleFileSelect = async (files) => {
    if (files && files[0]) {
      try {
        const base64Image = await fileToBase64(files[0]);
        const newFloorId = Date.now();
        setFloors([...floors, {
          id: newFloorId,
          name: `Level ${floors.length + 1}`,
          image: base64Image,
          zones: null
        }]);
        setActiveTab(newFloorId);
      } catch (error) { console.error(error); }
    }
  };
  const handleTraceSave = (data) => {
    const updatedFloors = floors.map(f => {
      if (f.id === activeTab) return { ...f, tracerData: data };
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

  const handleGenerate = async () => {
    setIsLoading(true);
    setStatusMessage("Validating inputs...");

    // Validation
    const activeZones = zoneSettings.filter(z => z.isSelected);
    if (activeZones.length === 0 || floors.length === 0) {
      alert("Please select zones and upload a floorplan.");
      setIsLoading(false);
      return;
    }
    const untracedFloor = floors.find(f => !f.tracerData || !f.tracerData.floorplan);
    if (untracedFloor) {
      alert(`Please complete tracing for ${untracedFloor.name}.`);
      setIsLoading(false);
      return;
    }

    try {
      setStatusMessage("Uploading data...");
      const floorPlansPayload = floors.map(f => {
        const tData = f.tracerData;
        const boundary = tData.floorplan.map(p => [p.x, p.y]);
        const walls = tData.columns ? tData.columns.map(poly => poly.map(p => [p.x, p.y])) : [];
        const fixedElements = {};
        if (tData.entrance) fixedElements.ent = tData.entrance.map(p => [p.x, p.y]);
        if (tData.bookdrops) fixedElements.bdr = tData.bookdrops.map(p => [p.x, p.y]);
        if (tData.lockers) fixedElements.loc = tData.lockers.map(p => [p.x, p.y]);
        const connections = [];
        if (tData.escalator) {
          tData.escalator.forEach((p, idx) => {
            connections.push({
              coord: [p.x, p.y],
              connection_id: `esc_${idx}`,
              type_name: 'esc'
            });
          });
        }
        return { name: f.name, boundary, walls, fixed_elements: fixedElements, connections };
      });

      const constraintsPayload = activeZones.map(z => ({
        short_code: z.short,
        area_value: z.mode === 'auto' ? null : (parseFloat(z.area) || 0),
        unit: z.mode === 'auto' ? '' : z.mode
      }));

      const payload = {
        floor_plans: floorPlansPayload,
        constraints: constraintsPayload,
        global_parameters: {
          total_gfa: parseFloat(totalGFA) || 0,
          text_prompt: preferencesText,
          target_node_counts: [50, 300, 500],
          generations: [100, 100, 100],
          pop_sizes: [100, 50, 50]
        }
      };

      const response = await fetch(`${API_BASE_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to submit job");
      const { job_id } = await response.json();

      setStatusMessage("Optimizing layout...");
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE_URL}/jobs/${job_id}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setApiResult(statusData.result);
            setResultsReady(true);
            setIsLoading(false);
            setActiveChip('results');
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            throw new Error(statusData.error || "Failed");
          }
        } catch (err) {
          clearInterval(pollInterval);
          alert("Error: " + err.message);
          setIsLoading(false);
        }
      }, 2000);
    } catch (error) {
      alert(error.message);
      setIsLoading(false);
    }
  };

  const handleRestart = () => { setResultsReady(false); setActiveChip('input'); setApiResult(null); };
  const currentFloor = floors.find(f => f.id === activeTab);



  // Result Prep
  const variations = apiResult?.variations || [];

  const currentVariation = variations[selectedVariationIndex];

  const currentFloorResult = currentVariation
    ? currentVariation.layouts.find(l => l.floor_name === floors[resultActiveFloorIndex]?.name)
    : null;

  // --- HELPER COMPONENT: ZONE GRID ---
  const ZoneGrid = ({ zones }) => {
    const statsMap = {};

    // Read stats directly from the selected variation
    if (currentVariation && currentVariation.area_stats) {
      currentVariation.area_stats.forEach(s => {
        statsMap[s.Zone] = s['Calculated GFA'];
      });
    }

    // Identify unique zones on this specific floor layout
    const uniqueZonesOnFloor = zones ? [...new Set(zones.map(z => z.type))] : [];

    return (
      <div className="zone-distribution-container">
        <div className="zone-grid">
          {uniqueZonesOnFloor.map((shortCode, idx) => {
            const zoneConfig = INITIAL_ZONES.find(z => z.short === shortCode) || { title: shortCode, color: '#ccc' };
            const area = statsMap[shortCode] ? Math.round(statsMap[shortCode]) : 0;

            return (
              <div key={idx} className="zone-chip">
                <div className="zone-color" style={{ backgroundColor: zoneConfig.color }}></div>
                <div className="zone-info">
                  <span className="zone-name">{zoneConfig.title}</span>
                  <span className="zone-area">{area} sqm (Total)</span>
                </div>
              </div>
            );
          })}

          {uniqueZonesOnFloor.length === 0 && (
            <p style={{ color: '#999', padding: '0.5rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
              No zones allocated to this floor.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="layout-generator-page">
      <ChipProgress activeChip={activeChip} onChipClick={(chip) => !isLoading && setActiveChip(chip)} chipLabels={{ input: 'Upload Data', results: 'Results' }} />

      {activeChip === 'input' && (
        <div className="layout-content-grid">
          <div className="layout-column-left">
            <GuideCard steps={["Upload floorplan", "Trace boundary & fixed items", "Set GFA & Zones", "Generate"]} title="Process Guide" />
            <InputCard icon="Building" title="Building Parameters">
              <div style={{ padding: '0 1rem 1rem 1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Total Gross Floor Area (sqm)</label>
                <input type="number" className="text-input" value={totalGFA} onChange={(e) => setTotalGFA(e.target.value)} />
              </div>
            </InputCard>
            <InputCard icon="AppWindow" title="Zone Requirements">
              <p className="preferences-subtitle">Select zones. Click the badge to toggle Auto / m² / %.</p>
              <div className="preferences-grid">
                {zoneSettings.map((zone, index) => (
                  <div key={zone.short}>
                    <SelectionCard
                      icon={zone.icon} title={zone.title} isSelected={zone.isSelected}
                      onToggle={() => handleZoneToggle(index)} areaValue={zone.area}
                      onAreaChange={(val) => handleZoneAreaChange(index, val)}
                      isDisabled={zone.mode === 'auto'}
                    >
                      {zone.isSelected && (
                        <button onClick={(e) => handleModeCycle(index, e)} className={`unit-toggle-btn ${zone.mode === 'auto' ? 'mode-auto' : 'mode-unit'}`} title="Toggle Unit">
                          {zone.mode === 'auto' ? 'Auto' : (zone.mode === 'sqm' ? 'm²' : '%')}
                        </button>
                      )}
                    </SelectionCard>
                  </div>
                ))}
              </div>
            </InputCard>
          </div>
          <div className="layout-column-right">
            <div className="floor-tabs-container">
              {floors.map(floor => (
                <button key={floor.id} className={`floor-tab ${activeTab === floor.id ? 'active' : ''}`} onClick={() => setActiveTab(floor.id)}>{floor.name}</button>
              ))}
              <button className={`floor-tab add-tab ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}><Icon name="Plus" size={16} /></button>
            </div>
            {activeTab === 'add' ? (
              <UploadCard icon="Map" title="Floor Plan Upload" subtitle="Upload floor plan image." onFileSelect={handleFileSelect} />
            ) : (
              currentFloor && <FloorPlanTracer key={currentFloor.id} imageSrc={currentFloor.image} savedZone={currentFloor.tracerData} onSave={handleTraceSave} onCancel={handleTraceCancel} />
            )}
          </div>
        </div>
      )}

      {activeChip === 'results' && resultsReady && apiResult && (
        <div className="results-area">
          <div className="results-grid-top">
            {variations.map((variation, idx) => (
              <LayoutSuggestionCard
                key={idx}
                title={idx === 0 ? "Recommended Layout" : `Variation ${idx + 1}`}
                floorNames={floors.map(f => f.name)}
                floorImages={floors.map(f => f.image)}
                layouts={variation.layouts}
                dimensions={floors[0]?.tracerData?.dimensions}
                isSelected={selectedVariationIndex === idx}
                onClick={() => setSelectedVariationIndex(idx)}
              />
            ))}
          </div>

          <div className="results-grid-bottom">
            <div className="card" style={{ padding: '0', overflow: 'hidden', minHeight: '500px' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="Layers" size={18} />
                  <h4 style={{ margin: 0 }}>
                    {selectedVariationIndex === 0 ? "Recommended Layout" : `Variation ${selectedVariationIndex + 1}`}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                    (Fitness: {currentVariation?.fitness?.toFixed(2) || 'N/A'})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {floors.map((f, idx) => (
                    <button
                      key={idx}
                      className={`results-floor-tab ${resultActiveFloorIndex === idx ? 'active' : ''}`}
                      onClick={() => setResultActiveFloorIndex(idx)}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <ResultVisualizer
                imageSrc={floors[resultActiveFloorIndex]?.image}
                zones={currentFloorResult ? currentFloorResult.zones : []}
                dimensions={floors[resultActiveFloorIndex]?.tracerData?.dimensions}
                areaStats={currentVariation?.area_stats} // <-- pass the area data here
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '1.5rem', flex: 1 }}>
                <h5 style={{ fontWeight: 'bold', margin: '0 0 1rem 0' }}>Zone Distribution Stats</h5>
                <ZoneGrid zones={currentFloorResult ? currentFloorResult.zones : []} />
              </div>

              <InputCard
                icon="Settings"
                title="Refine Layout"
                subtitle="Adjust preferences and regenerate."
                headerActions={<Button variant="default" size="small" onClick={handleGenerate}>Regenerate</Button>}
              >
                <textarea
                  className="preferences-textarea"
                  placeholder="E.g., 'Make the children's area larger' or 'Move toilets near entrance'..."
                  value={preferencesText}
                  onChange={(e) => setPreferencesText(e.target.value)}
                ></textarea>
              </InputCard>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="loader-overlay"><Loader text={statusMessage} /></div>}

      <div className="page-actions">
        {activeChip === 'input' && !isLoading && (
          <>
            <div style={{ flex: 1 }}></div>
            <Button variant="default" size="default" onClick={handleGenerate} disabled={floors.length === 0}>Generate Layout</Button>
          </>
        )}
        {activeChip === 'results' && (
          <>
            <div style={{ flex: 1 }}></div>
            <Button variant="outline" size="default" onClick={handleRestart}>Start Over</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default LayoutGeneratorPage;
