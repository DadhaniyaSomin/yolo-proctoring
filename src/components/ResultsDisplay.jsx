// ResultsDisplay.jsx - Updated with DetectionPreview component
import React from 'react';
import DetectionPreview from './DetectionPreview';

const ResultsDisplay = ({ results, workerStatus, isRunning }) => {
  if (!isRunning) {
    return (
      <div className="results-container">
        <h2>Detection Results</h2>
        <div className="waiting-message">
          Start proctoring to see results
        </div>
      </div>
    );
  }
  
  if (!results) {
    return (
      <div className="results-container">
        <h2>Detection Results</h2>
        <div className="waiting-message">
          Initializing YOLO model...
        </div>
        <WorkerStatusDisplay workerStatus={workerStatus} />
      </div>
    );
  }
  
  const { detections, fps, processingTime, frameCount } = results;
  
  return (
    <div className="results-container">
      <h2>Detection Results</h2>
      
      <div className="metrics">
        <div className="metric">
          <span className="metric-label">FPS:</span>
          <span className="metric-value">{fps.toFixed(1)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Processing:</span>
          <span className="metric-value">{processingTime.toFixed(1)} ms</span>
        </div>
        <div className="metric">
          <span className="metric-label">Frame:</span>
          <span className="metric-value">{frameCount}</span>
        </div>
      </div>
      
      <h3>Detected Objects: {detections.length}</h3>
      
      <div className="detections-list">
        {detections.length === 0 ? (
          <p className="no-detections">No objects detected</p>
        ) : (
          <ul>
            {detections.map((detection, index) => {
              // Generate consistent color
              const hue = (detection.class * 137) % 360;
              const color = `hsl(${hue}, 90%, 50%)`;
              
              return (
                <li 
                  key={index} 
                  className="detection-item"
                  style={{
                    borderLeftColor: color
                  }}
                >
                  <div className="detection-header">
                    <strong>{detection.label}</strong>
                    <span 
                      className="confidence"
                      style={{
                        backgroundColor: color
                      }}
                    >
                      {(detection.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="box-info">
                    Position: X: {Math.round(detection.box.x)}, Y: {Math.round(detection.box.y)}
                    <br />
                    Size: W: {Math.round(detection.box.width)}, H: {Math.round(detection.box.height)}
                  </div>
                  
                  {/* Detection preview */}
                  <div className="detection-preview">
                    <DetectionPreview 
                      detection={detection} 
                      width={180} 
                      height={80} 
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <WorkerStatusDisplay workerStatus={workerStatus} />
    </div>
  );
};

const WorkerStatusDisplay = ({ workerStatus }) => {
  if (!workerStatus || workerStatus.length === 0) {
    return null;
  }
  
  return (
    <div className="worker-status">
      <h4>Web Worker Status</h4>
      <div className="workers-grid">
        {workerStatus.map(worker => (
          <div 
            key={worker.id} 
            className={`worker-item worker-${worker.status}`}
          >
            Worker {worker.id}: {worker.status}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;