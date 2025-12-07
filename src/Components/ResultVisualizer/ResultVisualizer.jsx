import React, { useRef, useState } from 'react';
import { INITIAL_ZONES } from '../../Pages/LayoutGeneratorPage/LayoutGeneratorPage'; // adjust path as needed

const ResultVisualizer = ({ imageSrc, zones, dimensions, areaStats }) => {
  const [hoveredZone, setHoveredZone] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  // Build quick lookup for zone info from INITIAL_ZONES
  const ZONE_INFO = INITIAL_ZONES.reduce((acc, z) => {
    acc[z.short] = { title: z.title, color: z.color };
    return acc;
  }, {});

  // Merge area into zones
  const enrichedZones = zones?.map(z => {
    const areaObj = areaStats?.find(s => s.Zone === z.type);
    return {
      ...z,
      title: ZONE_INFO[z.type]?.title || z.type,
      color: ZONE_INFO[z.type]?.color || '#cccccc',
      area: areaObj?.['Calculated GFA'] || 0
    };
  }) || [];

  const viewBox = dimensions ? `0 0 ${dimensions.width} ${dimensions.height}` : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#f0f0f0' }}
      onMouseMove={handleMouseMove}
    >
      {imageSrc && (
        <img src={imageSrc} alt="Floor Plan" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}

      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        {enrichedZones.map((zone, idx) => {
          const pointsStr = zone.polygon.map(p => p.join(',')).join(' ');
          return (
            <polygon
              key={idx}
              points={pointsStr}
              fill={zone.color}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="1"
              fillOpacity="0.65"
              onMouseEnter={() => setHoveredZone(zone)}
              onMouseLeave={() => setHoveredZone(null)}
            />
          );
        })}
      </svg>

      {hoveredZone && (
        <div
          style={{
            position: 'absolute',
            left: mousePos.x + 12,
            top: mousePos.y + 12,
            padding: '6px 8px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontSize: 12,
            borderRadius: 3,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          {hoveredZone.title} — {Math.round(hoveredZone.area)} sqm
        </div>
      )}
    </div>
  );
};

export default ResultVisualizer;
