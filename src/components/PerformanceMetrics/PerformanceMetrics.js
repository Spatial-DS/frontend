import React from 'react';
import './PerformanceMetrics.css';

/**
 * A single metric bar.
 * @param {object} props
 * @param {string} props.name - The name of the metric.
 * @param {number} props.value - The value (0-100).
 */
function MetricBar({ name, value }) {
  return (
    <div className="metric-bar-group">
      <div className="metric-bar-labels">
        <span className="metric-name">{name}</span>
        <span className="metric-value">{value}%</span>
      </div>
      <div className="metric-bar-track">
        <div 
          className="metric-bar-fill" 
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}

/**
 * A card for displaying performance metrics.
 * @param {object} props
 * @param {Array<object>} props.metrics - Array of { name, value } objects.
 */
function PerformanceMetrics({ metrics }) {
  return (
    <div className="performance-metrics-card">
      <h5 className="performance-title">Performance Metrics</h5>
      <div className="metrics-list">
        {metrics.map((metric) => (
          <MetricBar key={metric.name} name={metric.name} value={metric.value} />
        ))}
      </div>
    </div>
  );
}

export default PerformanceMetrics;