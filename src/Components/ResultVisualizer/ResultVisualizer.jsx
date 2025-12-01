import React, { useRef, useState } from 'react';

// You will need to export INITIAL_ZONES from LayoutGeneratorPage or duplicate the config here.
// For minimal friction, pass getColor/getTitle as props or duplicate the helper locally.
// Assuming simple duplication of the helper for isolation:
const COLORS = {
  gen: '#d4a67d', chd: '#f4b183', yth: '#9dc3e6', dgt: '#ccc0da',
  sty: '#d9d9d9', met: '#c5e0b4', lob: '#b4c7e7', caf: '#f8de7e',
  stf: '#bdd7ee', toi: '#e2f0d9', mag: '#f2f2f2', sgc: '#a9d18e'
};

const ResultVisualizer = ({ imageSrc, zones, dimensions }) => {
  const [hoveredZone, setHoveredZone] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const viewBox = dimensions ? `0 0 ${dimensions.width} ${dimensions.height}` : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#f0f0f0' }}
      onMouseMove={handleMouseMove}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="Floor Plan" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}

      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        {zones && zones.map((zone, idx) => {
          const pointsStr = zone.polygon.map(p => p.join(',')).join(' ');
          return (
            <polygon
              key={idx}
              points={pointsStr}
              fill={COLORS[zone.type] || '#cccccc'}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="1"
              fillOpacity="0.65"
              onMouseEnter={() => setHoveredZone(zone)}
              onMouseLeave={() => setHoveredZone(null)}
            />
          );
        })}
      </svg>
      
      {/* Tooltip omitted for thumbnails to keep it clean, or can be added back if desired */}
    </div>
  );
};

export default ResultVisualizer;
