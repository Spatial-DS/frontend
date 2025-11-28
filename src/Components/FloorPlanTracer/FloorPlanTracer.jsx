import React, { useRef, useState, useEffect } from 'react';
import Button from '../Button/Button';
import './FloorPlanTracer.css';

// Configuration for the different tools/categories
const TRACE_TOOLS = {
  floorplan: { label: 'Entire Floorplan', type: 'polygon', single: true, color: '#0047BB' }, // Blue
  columns:   { label: 'Columns / Walls',  type: 'polygon', single: false, color: '#E8002A' }, // Red
  entrance:  { label: 'Entrance',         type: 'point',   color: '#00B074' }, // Green
  bookdrops: { label: 'Bookdrops',        type: 'point',   color: '#F39C12' }, // Orange
  lockers:   { label: 'Lockers',          type: 'point',   color: '#8E44AD' }, // Purple
  escalator: { label: 'Escalator / Lifts',type: 'point',   color: '#E91E63' }, // Pink
};

const FloorPlanTracer = ({ imageSrc, onSave, onCancel, savedZone }) => {
  const canvasRef = useRef(null);
  
  const [data, setData] = useState(savedZone || {});
  const [activeTool, setActiveTool] = useState('floorplan');
  const [currentPath, setCurrentPath] = useState([]);
  
  // NEW: State for saving indicator
  const [isSaving, setIsSaving] = useState(false);

  const toolConfig = TRACE_TOOLS[activeTool];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = (image.height / image.width) * canvas.offsetWidth;

      // 1. Draw Background
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // 2. Draw Saved Data
      Object.keys(data).forEach(category => {
        const categoryData = data[category];
        if (!categoryData) return;
        const config = TRACE_TOOLS[category];
        if (!config) return;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;

        if (config.type === 'polygon') {
          const polygons = config.single ? (categoryData.length ? [categoryData] : []) : categoryData;
          
          polygons.forEach(poly => {
            if (poly.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            poly.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(poly[0].x, poly[0].y); 
            ctx.globalAlpha = 0.2;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.stroke();
          });

        } else if (config.type === 'point') {
          categoryData.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText(config.label[0], p.x - 3, p.y + 3);
            ctx.fillStyle = config.color; 
          });
        }
      });

      // 3. Draw Current Path
      if (currentPath.length > 0) {
        ctx.strokeStyle = toolConfig.color;
        ctx.fillStyle = toolConfig.color;
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        currentPath.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.stroke();
        });
      }
    };
  }, [imageSrc, data, currentPath, activeTool, toolConfig]);

  // --- HANDLERS ---

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newPoint = { x, y };

    if (toolConfig.type === 'point') {
      const existingPoints = data[activeTool] || [];
      setData({
        ...data,
        [activeTool]: [...existingPoints, newPoint]
      });
    } else {
      setCurrentPath([...currentPath, newPoint]);
    }
  };

  const handleFinishShape = () => {
    if (currentPath.length < 3) return; 

    const existingData = data[activeTool];
    let newDataForCategory;
    if (toolConfig.single) {
      newDataForCategory = currentPath;
    } else {
      newDataForCategory = [...(existingData || []), currentPath];
    }

    setData({ ...data, [activeTool]: newDataForCategory });
    setCurrentPath([]); 
  };

  const handleUndo = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    } else {
      const catData = data[activeTool];
      if (!catData || catData.length === 0) return;

      if (toolConfig.type === 'point' || !toolConfig.single) {
        setData({ ...data, [activeTool]: catData.slice(0, -1) });
      } else {
        setData({ ...data, [activeTool]: [] });
      }
    }
  };

  const handleResetCategory = () => {
    const newData = { ...data };
    delete newData[activeTool];
    setData(newData);
    setCurrentPath([]);
  };

  // NEW: Wrapper for save to show loading state
  const handleSaveClick = async () => {
    setIsSaving(true);
    // Artificial delay (500ms) to give user visual feedback of "Saving"
    await new Promise(resolve => setTimeout(resolve, 500));
    onSave(data);
    setIsSaving(false);
  };

  return (
    <div className="tracer-container">
      <div className="tracer-toolbar">
        <span className="toolbar-label">Active Tool:</span>
        <div className="toolbar-buttons">
            {Object.entries(TRACE_TOOLS).map(([key, config]) => (
                <button
                    key={key}
                    className={`tool-btn ${activeTool === key ? 'active' : ''}`}
                    onClick={() => { setActiveTool(key); setCurrentPath([]); }}
                    style={{ borderColor: activeTool === key ? config.color : 'transparent', color: activeTool === key ? config.color : '' }}
                >
                    {config.label}
                </button>
            ))}
        </div>
      </div>

      {/* MOVED: Helper text is now here, outside the canvas */}
      {toolConfig.type === 'polygon' && currentPath.length > 0 && (
          <div className="tracer-helper-text">
              Drawing <strong>{toolConfig.label}</strong>. Click points to trace, then click "Finish Shape" to commit.
          </div>
      )}

      <div className="canvas-wrapper">
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          className="tracer-canvas"
        />
      </div>

      <div className="tracer-actions">
        {/* CHANGED: 'Cancel' -> 'Delete Floorplan' with red outline style */}
        <Button variant="danger-outline" onClick={onCancel}>
            Delete Floorplan
        </Button>
        
        <div className="action-group">
            {toolConfig.type === 'polygon' && (
                <Button 
                    variant="default" 
                    size="small"
                    onClick={handleFinishShape} 
                    disabled={currentPath.length < 3}
                    style={{ marginRight: '1rem' }}
                >
                    Finish Shape
                </Button>
            )}
            <Button variant="text" onClick={handleUndo}>Undo</Button>
            <Button variant="text" onClick={handleResetCategory}>Clear {toolConfig.label}</Button>
        </div>

        {/* CHANGED: Save button shows loading state */}
        <Button variant="default" onClick={handleSaveClick} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save All'}
        </Button>
      </div>
    </div>
  );
};

export default FloorPlanTracer;