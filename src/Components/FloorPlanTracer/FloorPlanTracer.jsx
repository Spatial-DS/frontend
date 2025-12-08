import React, { useRef, useState, useEffect } from 'react';
import Button from '../Button/Button';
import './FloorPlanTracer.css';

const TRACE_TOOLS = {
  floorplan: { label: 'Entire Floorplan', type: 'polygon', single: true, color: '#0047BB' },
  entrance: { label: 'Entrance', type: 'point', color: '#00B074' },
  bookdrops: { label: 'Bookdrops', type: 'point', color: '#F39C12' },
  lockers: { label: 'Lockers', type: 'point', color: '#8E44AD' },
  escalator: { label: 'Escalator / Lifts', type: 'point', color: '#E91E63' },
};

const FloorPlanTracer = ({ imageSrc, onSave, onCancel, savedZone }) => {
  const canvasRef = useRef(null);
  const [data, setData] = useState(savedZone || {});
  const [activeTool, setActiveTool] = useState('floorplan');
  const [currentPath, setCurrentPath] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const toolConfig = TRACE_TOOLS[activeTool];

  // ... (useEffect for canvas drawing remains unchanged) ...
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = (image.height / image.width) * canvas.offsetWidth;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.label[0], p.x, p.y);
            ctx.fillStyle = config.color;
          });
        }
      });

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

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newPoint = { x, y };

    if (toolConfig.type === 'point') {
      const existingPoints = data[activeTool] || [];
      setData({ ...data, [activeTool]: [...existingPoints, newPoint] });
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

  const handleSaveClick = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const payload = {
      ...data,
      dimensions: {
        width: canvasRef.current.width,
        height: canvasRef.current.height
      }
    };
    onSave(payload);
    setIsSaving(false);
  };

  return (
    <div className="tracer-container">
      {/* Added Instruction Block Here */}
      <div className="tracer-instructions">
        <strong>Tracing Steps:</strong>
        <ol>
          <li>Under "Entire Floorplan", trace the boundary by clicking points around the perimeter. Click "Finish Shape".</li>
          <li>For the rest of the tabs, identify the respective spaces/services/facilities with an indication of a dot.</li>
          <li>Click on "Save All Changes" button when done.</li>
          <li>Click on "+" to add more levels if required. Make sure to save the changes for each level.</li>
          <li>Click on "Generate Layout" to start layout generation.</li>
        </ol>
      </div>

      <div className="tracer-toolbar">
        <span className="toolbar-label">Active Tool:</span>
        <div className="toolbar-buttons">
          {Object.entries(TRACE_TOOLS).map(([key, config]) => (
            <button
              key={key}
              className={`tool-btn ${activeTool === key ? 'active' : ''}`}
              onClick={() => { setActiveTool(key); setCurrentPath([]); }}
              style={{
                borderColor: activeTool === key ? config.color : 'transparent',
                color: activeTool === key ? config.color : '#666',
                fontWeight: activeTool === key ? 'bold' : 'normal'
              }}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tracer-helper-text">
        {toolConfig.type === 'polygon'
          ? `Click points to trace ${toolConfig.label}. Click 'Finish Shape' to close.`
          : `Click anywhere to place a ${toolConfig.label}.`}
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="tracer-canvas"
        />
      </div>

      <div className="tracer-actions">
        <Button variant="danger-outline" onClick={onCancel}>Delete Floor</Button>
        <div className="action-group">
          {toolConfig.type === 'polygon' && (
            <Button
              variant="default"
              size="small"
              onClick={handleFinishShape}
              disabled={currentPath.length < 3}
              style={{ marginRight: '0.5rem' }}
            >
              Finish Shape
            </Button>
          )}
          <Button variant="text" onClick={handleUndo}>Undo</Button>
          <Button variant="text" onClick={handleResetCategory}>Clear {toolConfig.label}</Button>
        </div>
        <Button variant="default" onClick={handleSaveClick} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
};

export default FloorPlanTracer;