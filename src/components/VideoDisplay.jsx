// VideoDisplay.jsx - Updated with detections
import React, { useRef, useEffect } from 'react';

const VideoDisplay = ({ videoRef, isRunning, detections = [] }) => {
  const canvasRef = useRef(null);
  
  // Draw bounding boxes on canvas when detections change
  useEffect(() => {
    if (!isRunning || !canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw bounding boxes for each detection
    detections.forEach(detection => {
      const { box, label, confidence } = detection;
      const { x, y, width, height } = box;
      
      // Generate a color based on class (for consistency)
      const hue = (detection.class * 137) % 360; // Use prime number for better distribution
      const color = `hsl(${hue}, 90%, 50%)`;
      
      // Draw rectangle
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Draw background for label
      ctx.fillStyle = color;
      const padding = 4;
      const fontSize = 12;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(`${label} ${(confidence * 100).toFixed(1)}%`).width;
      ctx.fillRect(x, y - fontSize - padding * 2, textWidth + padding * 2, fontSize + padding * 2);
      
      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(`${label} ${(confidence * 100).toFixed(1)}%`, x + padding, y - padding);
    });
  }, [isRunning, detections, videoRef]);
  
  return (
    <div className="video-container">
      <h2>Camera Feed</h2>
      <div className="video-wrapper">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          muted
          className="video-feed"
        />
        {isRunning && (
          <canvas 
            ref={canvasRef}
            className="detection-overlay"
          />
        )}
        {!isRunning && (
          <div className="video-placeholder">
            <div>Camera feed will appear here</div>
          </div>
        )}
      </div>
      
      {/* Mini Detection Results within Camera Feed */}
      {isRunning && detections.length > 0 && (
        <div className="mini-detections">
          <h3>Detected: {detections.length} objects</h3>
          <div className="mini-detection-list">
            {detections.slice(0, 3).map((detection, index) => (
              <div 
                key={index} 
                className="mini-detection-item"
                style={{
                  borderLeftColor: `hsl(${(detection.class * 137) % 360}, 90%, 50%)`
                }}
              >
                <strong>{detection.label}</strong>
                <span className="mini-confidence">
                  {(detection.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
            {detections.length > 3 && (
              <div className="mini-detection-more">
                +{detections.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDisplay;