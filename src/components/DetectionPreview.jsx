// DetectionPreview.jsx - Enhanced with actual camera images
import React, { useRef, useEffect } from 'react';

const DetectionPreview = ({ detection, videoRef }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !detection || !videoRef || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    // Make sure video is playing and has loaded
    if (video.readyState < 2) return;
    
    // Set up extraction from video
    const { box } = detection;
    const { x, y, width, height } = box;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Extract the region of interest from the video
    try {
      // Draw the video frame portion to our canvas
      ctx.drawImage(
        video,
        // Source rectangle (region in the video)
        Math.max(0, x),
        Math.max(0, y),
        Math.min(width, video.videoWidth - x),
        Math.min(height, video.videoHeight - y),
        // Destination rectangle (fill our canvas)
        0,
        0,
        canvas.width,
        canvas.height
      );
      
      // Draw a colored border around the preview
      const hue = (detection.class * 137) % 360;
      const color = `hsl(${hue}, 90%, 50%)`;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Draw object label
      ctx.fillStyle = color;
      ctx.font = '12px Arial';
      const label = detection.label;
      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      
      // Background for text
      ctx.fillRect(0, 0, textWidth + padding * 2, 20);
      
      // Text
      ctx.fillStyle = 'white';
      ctx.fillText(label, padding, 14);
      
      // Draw confidence
      const confidenceText = `${(detection.confidence * 100).toFixed(1)}%`;
      const confidenceWidth = ctx.measureText(confidenceText).width;
      
      // Background for confidence
      ctx.fillStyle = color;
      ctx.fillRect(canvas.width - confidenceWidth - padding * 2, 0, 
                  confidenceWidth + padding * 2, 20);
      
      // Text
      ctx.fillStyle = 'white';
      ctx.fillText(confidenceText, canvas.width - confidenceWidth - padding, 14);
      
    } catch (err) {
      console.error('Error drawing detection preview:', err);
      
      // Fallback to a colored rectangle
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText('Preview unavailable', canvas.width / 2, canvas.height / 2);
    }
  }, [detection, videoRef]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={160} 
      height={120}
      className="detection-preview-canvas"
    />
  );
};

export default DetectionPreview;