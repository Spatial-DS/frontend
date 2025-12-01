import React, { useRef, useState, useEffect } from 'react';
import Button from '../Button/Button';
import './FloorPlanTracer.css';

// Configuration matches backend short_code logic implicitly via LayoutGenerator mapping
const TRACE_TOOLS = {
  floorplan: { label: 'Entire Floorplan', type: 'polygon', single: true, color: '#0047BB' }, // Blue
  columns: { label: 'Columns / Walls', type: 'polygon', single: false, color: '#E8002A' }, // Red
  entrance: { label: 'Entrance', type: 'point', color: '#00B074' }, // Green
  bookdrops: { label: 'Bookdrops', type: 'point', color: '#F39C12' }, // Orange
  lockers: { label: 'Lockers', type: 'point', color: '#8E44AD' }, // Purple
  escalator: { label: 'Escalator / Lifts', type: 'point', color: '#E91E63' }, // Pink
};

const FloorPlanTracer = ({ imageSrc, onSave, onCancel, savedZone }) => {
  const canvasRef = useRef(null);

  // Initialize with saved data if available
  const [data, setData] = useState(savedZone || {});
  const [activeTool, setActiveTool] = useState('floorplan');
  const [currentPath, setCurrentPath] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const toolConfig = TRACE_TOOLS[activeTool];

  // Redraw Canvas whenever state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      // 1. Resize canvas to fit container width, maintaining aspect ratio
      canvas.width = canvas.offsetWidth;
      canvas.height = (image.height / image.width) * canvas.offsetWidth;

      // 2. Draw Background Image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // 3. Draw Saved Data (Polygons and Points)
      Object.keys(data).forEach(category => {
        const categoryData = data[category];
        if (!categoryData) return;
        const config = TRACE_TOOLS[category];
        if (!config) return;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;

        if (config.type === 'polygon') {
          // Handle single vs multi polygons
          const polygons = config.single ? (categoryData.length ? [categoryData] : []) : categoryData;

          polygons.forEach(poly => {
            if (poly.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            poly.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(poly[0].x, poly[0].y); // Close path
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

            // Draw Label Initial inside point
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.label[0], p.x, p.y);
            ctx.fillStyle = config.color; // Reset for next loop
          });
        }
      });

      // 4. Draw Active Path (Currently drawing)
      if (currentPath.length > 0) {
        ctx.strokeStyle = toolConfig.color;
        ctx.fillStyle = toolConfig.color;

        // Draw lines
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Draw vertices
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
      // Add point immediately
      const existingPoints = data[activeTool] || [];
      setData({
        ...data,
        [activeTool]: [...existingPoints, newPoint]
      });
    } else {
      // Add to path
      setCurrentPath([...currentPath, newPoint]);
    }
  };

  const handleFinishShape = () => {
    if (currentPath.length < 3) return;

    const existingData = data[activeTool];
    let newDataForCategory;

    // If single (like boundary), overwrite. If multi (like columns), append.
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
      // Undo last committed shape/point
      const catData = data[activeTool];
      if (!catData || catData.length === 0) return;

      if (toolConfig.type === 'point' || !toolConfig.single) {
        // Remove last item from array
        setData({ ...data, [activeTool]: catData.slice(0, -1) });
      } else {
        // Clear single polygon
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
      {/* Toolbar */}
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

      {/* Helper Text */}
      <div className="tracer-helper-text">
        {toolConfig.type === 'polygon'
          ? `Click points to trace ${toolConfig.label}. Click 'Finish Shape' to close.`
          : `Click anywhere to place a ${toolConfig.label}.`}
      </div>

      {/* Canvas */}
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="tracer-canvas"
        />
      </div>

      {/* Actions */}
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
