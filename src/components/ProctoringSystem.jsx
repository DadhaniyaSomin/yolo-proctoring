import React, { useState, useEffect, useRef } from 'react';
import WorkerPool from '../utils/WorkerPool';
import YOLOProcessor from '../utils/YOLOProcessor';
import VideoDisplay from './VideoDisplay';
import ResultsDisplay from './ResultsDisplay';
import DetectionCaptureService from '../utils/DetectionCaptureService';
import DetectionGallery from './DetectionGallery';
const ProctoringSystem = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [detectionResults, setDetectionResults] = useState(null);
  const [workerStatus, setWorkerStatus] = useState([]);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const workerPoolRef = useRef(null);
  const processorRef = useRef(null);
  const captureServiceRef = useRef(null);

  // Number of web workers to create - adjust based on device capabilities
  const numWorkers = navigator.hardwareConcurrency ? 
    Math.min(4, navigator.hardwareConcurrency) : 2;

  useEffect(() => {
    // Initialize the worker pool and YOLO processor
    try {
      workerPoolRef.current = new WorkerPool(numWorkers);
      processorRef.current = new YOLOProcessor(workerPoolRef.current);
          captureServiceRef.current = new DetectionCaptureService();

      // Set up callbacks
      processorRef.current.onResults(results => {
        setDetectionResults(results);
      });
      
      processorRef.current.onWorkerStatus(status => {
        setWorkerStatus(status);
      });
      
      processorRef.current.onError(err => {
        setError(err);
      });
      
    } catch (err) {
      setError(`Failed to initialize: ${err.message}`);
    }

    return () => {
      // Clean up resources when component unmounts
      if (processorRef.current) {
        processorRef.current.stop();
      }
      
      if (workerPoolRef.current) {
        workerPoolRef.current.terminate();
      }
      

      if (captureServiceRef.current) {
        captureServiceRef.current.stop();
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [numWorkers]);


  useEffect(() => {
    if (isRunning && captureServiceRef.current && videoRef.current && detectionResults?.detections) {
      captureServiceRef.current.captureDetections(
        videoRef.current, 
        detectionResults.detections
      );
    }
  }, [isRunning, detectionResults]);
  const startProctoring = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsRunning(true);
          processorRef.current.start(videoRef.current);
        };
      }

      if (captureServiceRef.current) {
        captureServiceRef.current.start();
      }


    } catch (err) {
      setError(`Error accessing webcam: ${err.message}`);
    }
  };

  const stopProctoring = () => {
    if (processorRef.current) {
      processorRef.current.stop();
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (captureServiceRef.current) {
      captureServiceRef.current.stop();
    }
    
    setIsRunning(false);
    setDetectionResults(null);
  };

  return (
    <div className="proctoring-system">
      <h1>YOLO-based Proctoring System</h1>
      <p className="info">Using {numWorkers} web workers for parallel processing</p>
      
      <div className="controls">
        {!isRunning ? (
          <button onClick={startProctoring} className="start-btn">
            Start Proctoring
          </button>
        ) : (
          <button onClick={stopProctoring} className="stop-btn">
            Stop Proctoring
          </button>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      <div className="display-container">
        <VideoDisplay 
            videoRef={videoRef} 
            isRunning={isRunning} 
            detections={detectionResults?.detections || []}
          />
          <ResultsDisplay 
            results={detectionResults} 
            workerStatus={workerStatus} 
            isRunning={isRunning}
        />
        <DetectionGallery 
        captureService={captureServiceRef.current}
        isRunning={isRunning}
      />
      </div>
    </div>
  );
};

export default ProctoringSystem;