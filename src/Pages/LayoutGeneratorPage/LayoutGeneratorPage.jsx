import React, { useState, useRef, useEffect} from 'react';

// import { useNavigate } from 'react-router-dom';
// import { useEffect } from 'react';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
import StatusModal from '../../Components/StatusModal/StatusModal';

export const INITIAL_ZONES = [
  { short: 'ent', title: 'Entrance', icon: 'DoorOpen', isSelected: true, mode: 'percent', area: 1, color: '#3366cc' },
  { short: 'lob', title: 'Lobby / Transition', icon: 'PersonStanding', isSelected: true, mode: 'auto', area: '', color: '#cc9933' },
  { short: 'bdr', title: 'Bookdrop', icon: 'ArchiveRestore', isSelected: true, mode: 'sqm', area: 10, color: '#ff8800' },
  { short: 'loc', title: 'Reservation Lockers', icon: 'Package', isSelected: true, mode: 'sqm', area: 3, color: '#8844cc' },
  { short: 'met', title: 'Meeting Rooms', icon: 'Users', isSelected: true, mode: 'auto', area: '', color: '#008877' },
  { short: 'sty', title: 'Study Area', icon: 'BookOpen', isSelected: true, mode: 'auto', area: '', color: '#66aadd' },
  { short: 'adl', title: 'Adult Collection', icon: 'Library', isSelected: true, mode: 'percent', area: 35, color: '#2e7d32' },
  { short: 'exh', title: 'Exhibitions', icon: 'Image', isSelected: false, mode: 'percent', area: 5, color: '#cc2288' },
  { short: 'prg', title: 'Programming Space', icon: 'Monitor', isSelected: true, mode: 'percent', area: 5, color: '#ddaa00' },
  { short: 'chd', title: "Children's Collection", icon: 'Baby', isSelected: true, mode: 'percent', area: 10, color: '#ffdd33' },
  { short: 'com', title: 'Community Owned Space', icon: 'UsersRound', isSelected: false, mode: 'percent', area: 5, color: '#8d6e63' },
  { short: 'yth', title: 'Youth Collection', icon: 'User', isSelected: true, mode: 'percent', area: 5, color: '#00bcd4' },
  { short: 'stf', title: 'Staff Areas', icon: 'Briefcase', isSelected: true, mode: 'percent', area: 10, color: '#555555' },
  { short: 'toi', title: 'Toilets', icon: 'Toilet', isSelected: true, mode: 'sqm', area: 15, color: '#bbbbbb' },
  { short: 'caf', title: 'Cafe', icon: 'Coffee', isSelected: false, mode: 'percent', area: 5, color: '#cc3333' },
  { short: 'esc', title: 'Stairs / Lifts / Escalators', icon: 'Footprints', isSelected: true, mode: 'sqm', area: 10, color: '#888888' },
];

const API_BASE_URL = "http://localhost:8000";



import { useNavigate } from "react-router-dom";



export function useUnsavedChangesPrompt(isPdfSaved, resultsReady) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPdfSaved && resultsReady) {
      const originalNavigate = navigate;

      // Monkey-patch navigate
      const customNavigate = (to, options) => {
        const confirmLeave = window.confirm(
          "You have unsaved results. Are you sure you want to leave?"
        );
        if (confirmLeave) {
          originalNavigate(to, options);
        }
      };

      // Replace navigate globally (optional)
      navigate.custom = customNavigate;
    }
  }, [isPdfSaved, resultsReady, navigate]);
}



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

  const [progressValue, setProgressValue] = useState(0);
  const [modalState, setModalState] = useState({ show: false, type: 'success', message: '' });

  // State to control visibility of the print template
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const pollIntervalRef = useRef(null);

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

  // Track if user has saved or downloaded the generated results
  const [isPdfSaved, setIsPdfSaved] = useState(false);


  useEffect(() => {
    localStorage.setItem('library_layout_floors', JSON.stringify(floors));
    localStorage.setItem('library_layout_active_tab', JSON.stringify(activeTab));
  }, [floors, activeTab]);
  useEffect(() => {
    localStorage.setItem('library_zone_settings', JSON.stringify(zoneSettings));
  }, [zoneSettings]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Helper to generate dynamic filename
  const getGeneratedFilename = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    return `Layout_Generation_${dateStr}.pdf`;
  };

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
    setProgressValue(0);

    // Check if updating an existing result
    const isUpdate = activeChip === 'results';
    setStatusMessage(isUpdate ? "Updating Layout..." : "Validating inputs...");

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
      if (!isUpdate) setStatusMessage("Uploading data...");

      const floorPlansPayload = floors.map(f => {
        const tData = f.tracerData;
        const boundary = tData.floorplan.map(p => [p.x, p.y]);
        const walls = [];
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

      setStatusMessage(isUpdate ? "Updating Layout..." : "Optimizing Layout...");

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE_URL}/jobs/${job_id}`);
          const statusData = await statusRes.json();

          if (statusData.progress !== undefined) {
            setProgressValue(Math.floor(statusData.progress * 100));
          }

          if (statusData.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setApiResult(statusData.result);
            setResultsReady(true);
            setIsLoading(false);
            setActiveChip('results');

            if (isUpdate) {
              // Extract remarks from the backend response
              const feedbackMsg = statusData.result?.llm_feedback?.remarks || "Layout updated successfully.";

              setModalState({
                show: true,
                type: 'success',
                message: feedbackMsg
              });
            }

            // --- Log to History ---
            // try {
            //   const fileName = getGeneratedFilename();
            //   const newHistoryItem = {
            //     id: Date.now(),
            //     name: fileName,
            //     type: 'Layout Generations',
            //     date: new Date().toISOString().split('T')[0]
            //   };
              
            //   const currentHistory = JSON.parse(localStorage.getItem('library_app_history') || '[]');
            //   const updatedHistory = [newHistoryItem, ...currentHistory];
            //   localStorage.setItem('library_app_history', JSON.stringify(updatedHistory));
            // } catch (histError) {
            //   console.error("Failed to log history:", histError);
            // }
            // ----------------------

          } else if (statusData.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            throw new Error(statusData.error || "Failed");
          }
        } catch (err) {
          clearInterval(pollIntervalRef.current);
          setIsLoading(false);
          setModalState({
            show: true,
            type: 'error',
            message: err.message || "An unknown error occurred."
          });
        }
      }, 1000);
    } catch (error) {
      setModalState({ 
        show: true, 
        type: 'error', 
        message: error.message || "Failed to submit job."
      });
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setIsLoading(false);
    setStatusMessage('');
  };

  const handleRestart = () => { setResultsReady(false); setActiveChip('input'); setApiResult(null); };

  // PDF Download Handler
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    // Short delay to allow the hidden div to render with all variations
    setTimeout(async () => {
      // Select all the page containers we created
      const pageElements = document.querySelectorAll('.pdf-page-to-print');
      if (!pageElements || pageElements.length === 0) {
        setIsGeneratingPdf(false);
        return;
      }

      try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210;
        const pdfHeight = 297;

            // Iterate over each page element and add it to the PDF
            for (let i = 0; i < pageElements.length; i++) {
                const pageEl = pageElements[i];
                
                // Capture this specific page element
                const canvas = await html2canvas(pageEl, { 
                    scale: 2, 
                    useCORS: true,
                    logging: false
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                // Scale to fit width
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                // If not the first page, add a new one
                if (i > 0) {
                    pdf.addPage();
                }
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            }

            setIsPdfSaved(true);
            pdf.save(getGeneratedFilename());

        } catch (err) {
            console.error("PDF Generation failed", err);
            alert("Failed to generate PDF");
        } finally {
            setIsGeneratingPdf(false);
        }
    }, 1000); // 1 second delay to ensure large DOM renders
  };


  // PDF Save to Database
  const handleUploadPDF = async () => {
  setIsGeneratingPdf(true);
  setTimeout(async () => {
    const pageElements = document.querySelectorAll('.pdf-page-to-print');
    if (!pageElements || pageElements.length === 0) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;

      for (let i = 0; i < pageElements.length; i++) {
        const canvas = await html2canvas(pageElements[i], { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      }

      const fileName = getGeneratedFilename();

      // Upload to backend
      const pdfBlob = pdf.output('blob');
      const formData = new FormData();
      formData.append('file', pdfBlob, fileName);
      formData.append('username', localStorage.getItem('currentUser'));

      await fetch(`${API_BASE_URL}/upload-generated-layout`, {
        method: 'POST',
        body: formData
      });

      setIsPdfSaved(true);
      console.log("PDF uploaded successfully!");
    } catch (err) {
      console.error("PDF Generation failed", err);
      alert("Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, 1000);
};

  
// Warn on tab close --> Scuffed pop-up
useEffect(() => {
  const handleClick = (e) => {
    if (!isPdfSaved && resultsReady) {
      const confirmLeave = window.confirm(
        "You have unsaved results. Are you sure you want to leave?"
      );
      if (!confirmLeave) {
        e.preventDefault();
        // e.returnValue = '';
      }
    }
  };

  // Attach to all links
  const links = document.querySelectorAll('a[href]');
  links.forEach(link => link.addEventListener('click', handleClick));

  return () => {
    links.forEach(link => link.removeEventListener('click', handleClick));
  };
}, [isPdfSaved, resultsReady]);



  const currentFloor = floors.find(f => f.id === activeTab);

  // Result Prep
  const variations = apiResult?.variations || [];
  const currentVariation = variations[selectedVariationIndex];
  const currentFloorResult = currentVariation
    ? currentVariation.layouts.find(l => l.floor_name === floors[resultActiveFloorIndex]?.name)
    : null;

  // --- HELPER COMPONENT: ZONE GRID ---
  const ZoneGrid = ({ zones, areaStats }) => {
    const statsMap = {};
    if (areaStats) {
      areaStats.forEach(s => {
        statsMap[s.Zone] = s['Calculated GFA'];
      });
    }
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
      <div style={{ width: '60%' }}>
        <ChipProgress activeChip={activeChip} onChipClick={(chip) => !isLoading && setActiveChip(chip)} chipLabels={{ input: 'Upload Data', results: 'Results' }} />
      </div>

      {activeChip === 'input' && (
        <div className="layout-content-grid">
          <div className="layout-column-left">
            <GuideCard
              steps={[
                "Upload floorplan",
                "Input GFA",
                "Input Zone Requirements",
                "Generate Layout"
              ]}
              title="How to Use Guide"
            />

            <InputCard icon="Building" title="Building Parameters">
              <div style={{ padding: '0 1rem 1rem 1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Total Gross Floor Area (m²)</label>
                <input type="number" className="text-input" value={totalGFA} onChange={(e) => setTotalGFA(e.target.value)} />
              </div>
            </InputCard>

            <InputCard icon="AppWindow" title="Zone Requirements">
              <div className="preferences-subtitle" style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.7)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Enable/Disable each zone by clicking on the card.</p>
                <p style={{ marginBottom: '0.5rem' }}>Modify the approximate area by clicking through different modes:</p>
                <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                  <li><strong>Auto:</strong> Will expand to fill the remaining space</li>
                  <li><strong>%:</strong> Will try to fill that percent of total space (For collection areas)</li>
                  <li><strong>m²:</strong> Will try to fill that floor space (For fixed-sized spaces like toilets, lifts/escalators etc.)</li>
                </ul>
              </div>

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
              <UploadCard
                icon="Map"
                title="Floor Plan Upload"
                subtitle="Upload floor plan image."
                uploadText="Upload Floorplan (.png, .img)"
                onFileSelect={handleFileSelect}
              />
            ) : (
              currentFloor && <FloorPlanTracer key={currentFloor.id} imageSrc={currentFloor.image} savedZone={currentFloor.tracerData} onSave={handleTraceSave} onCancel={handleTraceCancel} />
            )}
          </div>
        </div>
      )}

      {activeChip === 'results' && (
        <div className="results-area">
          {resultsReady && apiResult ? (
            <>
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
                    externalActiveFloorIndex={resultActiveFloorIndex}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="layout-card-tabs" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                        {floors.map((f, idx) => (
                          <span
                            key={idx}
                            className={`card-floor-tab ${resultActiveFloorIndex === idx ? 'active' : ''}`}
                            onClick={() => setResultActiveFloorIndex(idx)}
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <ResultVisualizer
                    imageSrc={floors[resultActiveFloorIndex]?.image}
                    zones={currentFloorResult ? currentFloorResult.zones : []}
                    dimensions={floors[resultActiveFloorIndex]?.tracerData?.dimensions}
                    areaStats={currentVariation?.area_stats}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.5rem', flex: 1 }}>
                    <h5 style={{ fontWeight: 'bold', margin: '0 0 1rem 0' }}>Zone Distribution Stats</h5>
                    <ZoneGrid zones={currentFloorResult ? currentFloorResult.zones : []} areaStats={currentVariation?.area_stats} />
                  </div>

                  <InputCard
                    icon="Settings"
                    title="Refine Layout"
                    subtitle="Adjust preferences and regenerate."
                    headerActions={<Button variant="default" size="small" onClick={handleGenerate}>Update Layout</Button>}
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
            </>
          ) : (
            <div className="no-results-message">
              <h3>No Layout Generated</h3>
              <p>Please go back to the "Upload Data" tab and generate a layout to see your results.</p>
            </div>
          )}
        </div>
      )}

      {/* --- HIDDEN PRINT TEMPLATE FOR PDF GENERATION --- */}
      {isGeneratingPdf && apiResult && (
        <div id="print-template-container" style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '210mm', backgroundColor: 'white'
        }}>
          {/* Iterate over ALL variations */}
          {apiResult.variations.map((variation, vIdx) => (
            <React.Fragment key={vIdx}>
              {/* Iterate over ALL floors for each variation */}
              {floors.map((floor, fIdx) => {
                const layout = variation.layouts.find(l => l.floor_name === floor.name);
                const floorZones = layout ? layout.zones : [];
                const title = vIdx === 0 ? "Recommended Layout" : `Variation ${vIdx + 1}`;

                return (
                  <div className="pdf-page-to-print" key={`${vIdx}-${fIdx}`} style={{
                    width: '210mm', minHeight: '297mm', padding: '15mm',
                    display: 'flex', flexDirection: 'column', gap: '5mm', boxSizing: 'border-box'
                  }}>
                    <h2 style={{ fontFamily: 'sans-serif', margin: 0, color: '#333' }}>Library Layout Report</h2>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '2mm', marginBottom: '5mm' }}>
                      <h3 style={{ margin: 0, fontFamily: 'sans-serif', color: '#555' }}>{title}</h3>
                      <h3 style={{ margin: 0, fontFamily: 'sans-serif', color: '#555' }}>{floor.name}</h3>
                    </div>

                    {/* Floor Plan Image */}
                    <div style={{ width: '100%', height: '120mm', border: '1px solid #ddd', overflow: 'hidden', borderRadius: '4px' }}>
                      <ResultVisualizer
                        imageSrc={floor.image}
                        zones={floorZones}
                        dimensions={floor.tracerData?.dimensions}
                        areaStats={variation.area_stats}
                      />
                    </div>

                    {/* Zone Stats */}
                    <div style={{ marginTop: '10mm', flex: 1 }}>
                      <h4 style={{ margin: '0 0 5mm 0', fontFamily: 'sans-serif' }}>Zone Distribution Breakdown</h4>
                      <ZoneGrid zones={floorZones} areaStats={variation.area_stats} />
                    </div>

                    <div style={{ marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '5mm', textAlign: 'center', fontSize: '0.8rem', color: '#999' }}>
                      Generated by LibraryPlan AI
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* --- LOADER --- */}
      {/* Updated: Now renders regardless of chip, as long as loading is true */}
      {isLoading && <Loader text={statusMessage} progress={progressValue} />}

      <StatusModal
        isOpen={modalState.show}
        type={modalState.type}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, show: false })}
      />

      <div className="page-actions">
        {activeChip === 'input' ? (
          isLoading ? (
            <>
              <div style={{ flex: 1 }}></div>
              <Button variant="danger-outline" onClick={handleCancel}>Cancel</Button>
              <Button variant="default" disabled>{statusMessage || "Optimizing Layout..."}</Button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}></div>
              <Button variant="default" size="default" onClick={handleGenerate} disabled={floors.length === 0}>Generate Layout</Button>
            </>
          )
        ) : activeChip === 'results' ? (
          <>
            <div style={{ flex: 1 }}></div>
            {resultsReady ? (
                <>
                    {/* UPDATED: Button Text */}
                    <Button variant="outline" size="default" onClick={handleRestart}>Restart Generation</Button>
                    <Button variant="outline" size="default" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
                    </Button>
                    <Button variant="default" size="default" onClick={handleUploadPDF} disabled={isPdfSaved}>
                      {!isPdfSaved ? "Save PDF to Database" : "Saved to Database ✓"} 
                    </Button> 
                </>
            ) : (
              <Button variant="default" size="default" onClick={handleRestart}>Restart Generation</Button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default LayoutGeneratorPage;
