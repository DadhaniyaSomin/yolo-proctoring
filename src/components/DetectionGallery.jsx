// components/DetectionGallery.jsx - Simplified version
import React, { useState, useEffect } from 'react';

const DetectionGallery = ({ captureService, isRunning }) => {
  const [detections, setDetections] = useState([]);
  const [selectedDetection, setSelectedDetection] = useState(null);
  
  // Load detections on mount and periodically
  useEffect(() => {
    if (!captureService) return;
    
    // Initial load
    const loadDetections = () => {
      const savedDetections = isRunning 
        ? captureService.getAllDetections() 
        : captureService.loadFromLocalStorage();
        
      setDetections(savedDetections);
    };
    
    loadDetections();
    
    // Refresh periodically while running
    const interval = setInterval(() => {
      if (isRunning) {
        loadDetections();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [captureService, isRunning]);
  
  // Manual refresh
  const refreshDetections = () => {
    if (!captureService) return;
    
    const savedDetections = isRunning 
      ? captureService.getAllDetections() 
      : captureService.loadFromLocalStorage();
      
    setDetections(savedDetections);
  };
  
  // Delete detection
  const deleteDetection = (id, e) => {
    e.stopPropagation();
    if (!captureService) return;
    
    captureService.deleteDetection(id);
    setDetections(detections.filter(d => d.id !== id));
    
    if (selectedDetection && selectedDetection.id === id) {
      setSelectedDetection(null);
    }
  };
  
  // Clear all
  const clearAllDetections = () => {
    if (!captureService) return;
    
    if (window.confirm('Are you sure you want to delete all saved detections?')) {
      captureService.clearAllDetections();
      setDetections([]);
      setSelectedDetection(null);
    }
  };
  
  // Download detection
  const downloadDetection = (detection, e) => {
    e.stopPropagation();
    if (!captureService || !detection.imageData) return;
    
    captureService.downloadImage(
      detection.imageData,
      `detection_${detection.id}_${detection.label}.jpg`
    );
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Render empty state
  if (!detections || detections.length === 0) {
    return (
      <div className="detection-gallery">
        <h2>Detection Gallery</h2>
        <p>No saved detections yet.</p>
        {isRunning && (
          <p>Detections will be saved automatically while the system is running.</p>
        )}
      </div>
    );
  }
  
  // Render selected detection (detail view)
  if (selectedDetection) {
    return (
      <div className="detection-gallery">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <button onClick={() => setSelectedDetection(null)}>
            &larr; Back to gallery
          </button>
          <h2>Detection Details</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Image */}
          <div style={{ marginBottom: '15px' }}>
            {selectedDetection.imageData ? (
              <img 
                src={selectedDetection.imageData} 
                alt={`Detection ${selectedDetection.id}`}
                style={{ maxWidth: '100%', border: '1px solid #ddd' }}
              />
            ) : (
              <div style={{ padding: '20px', background: '#f0f0f0', textAlign: 'center' }}>
                No image available
              </div>
            )}
          </div>
          
          {/* Details */}
          <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>
              {selectedDetection.label}
              <span style={{ 
                marginLeft: '10px', 
                fontSize: '14px', 
                background: '#4caf50', 
                color: 'white',
                padding: '3px 8px',
                borderRadius: '10px'
              }}>
                {(selectedDetection.confidence * 100).toFixed(1)}%
              </span>
            </h3>
            
            <div style={{ marginBottom: '10px' }}>
              <strong>Detection ID:</strong> {selectedDetection.id}
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <strong>Timestamp:</strong> {formatTimestamp(selectedDetection.timestamp)}
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <strong>Coordinates:</strong> {selectedDetection.coordinates ? 
                `X: ${Math.round(selectedDetection.coordinates.x)}, 
                Y: ${Math.round(selectedDetection.coordinates.y)}, 
                W: ${Math.round(selectedDetection.coordinates.width)}, 
                H: ${Math.round(selectedDetection.coordinates.height)}` : 'N/A'}
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={(e) => downloadDetection(selectedDetection, e)}
                style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px' }}
              >
                Download Image
              </button>
              <button 
                onClick={(e) => deleteDetection(selectedDetection.id, e)}
                style={{ background: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render grid view (default)
  return (
    <div className="detection-gallery">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>Detection Gallery</h2>
        <div>
          <button 
            onClick={refreshDetections}
            style={{ marginRight: '5px', padding: '5px 10px' }}
          >
            Refresh
          </button>
          <button 
            onClick={clearAllDetections}
            style={{ padding: '5px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
        gap: '15px' 
      }}>
        {detections.map(detection => (
          <div 
            key={detection.id}
            onClick={() => setSelectedDetection(detection)}
            style={{ 
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative',
              transition: 'transform 0.2s',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {/* Image */}
            <div style={{ height: '120px', backgroundColor: '#f0f0f0' }}>
              {detection.imageData ? (
                <img 
                  src={detection.imageData} 
                  alt={`Detection ${detection.id}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    console.error(`Failed to load image for detection ${detection.id}`);
                    e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='; // 1x1 transparent gif
                  }}
                />
              ) : (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#999'
                }}>
                  No image
                </div>
              )}
            </div>
            
            {/* Info */}
            <div style={{ padding: '8px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ 
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {detection.label}
                </div>
                <div style={{ 
                  fontSize: '12px',
                  background: '#4caf50',
                  color: 'white',
                  padding: '2px 5px',
                  borderRadius: '10px'
                }}>
                  {(detection.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div style={{ 
              position: 'absolute',
              top: '5px',
              right: '5px',
              display: 'flex',
              gap: '5px'
            }}>
              <button
                onClick={(e) => downloadDetection(detection, e)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Download"
              >
                ↓
              </button>
              <button
                onClick={(e) => deleteDetection(detection.id, e)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetectionGallery;