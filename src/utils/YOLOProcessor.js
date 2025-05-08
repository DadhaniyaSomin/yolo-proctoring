class YOLOProcessor {
  constructor(workerPool) {
    this.workerPool = workerPool;
    this.running = false;
    this.videoElement = null;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.frameCount = 0;
    this.resultsCallback = null;
    this.statusCallback = null;
    this.errorCallback = null;
    this.processingTimes = [];
    this.lastFrameTime = 0;
    this.fpsValues = [];

    // Register for worker status updates
    this.workerPool.setStatusUpdateCallback(
      this.handleWorkerStatusUpdate.bind(this)
    );
  }

  async start(videoElement) {
    this.videoElement = videoElement;
    this.running = true;

    // Wait for video to be ready
    if (this.videoElement.readyState < 2) {
      await new Promise((resolve) => {
        this.videoElement.onloadeddata = () => resolve();
      });
    }

    // Set canvas dimensions to match video
    this.canvas.width = this.videoElement.videoWidth;
    this.canvas.height = this.videoElement.videoHeight;

    // Initialize YOLO model in all workers
    try {
      const promises = [];
      for (let i = 0; i < this.workerPool.numWorkers; i++) {
        promises.push(
          this.workerPool.assignTask("init", {
            workerId: i,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
          })
        );
      }

      await Promise.all(promises);
      console.log("All YOLO models initialized in workers");

      // Start processing frames
      this.processFrame();
    } catch (error) {
      console.error("Error initializing YOLO models:", error);
      if (this.errorCallback) {
        this.errorCallback(error.message || "Failed to initialize YOLO model");
      }
    }
  }

  stop() {
    this.running = false;
    this.frameCount = 0;
    this.processingTimes = [];
    this.fpsValues = [];
    this.lastFrameTime = 0;
  }

  async processFrame() {
    if (!this.running) return;

    const now = performance.now();
    let fps = 0;

    if (this.lastFrameTime) {
      fps = 1000 / (now - this.lastFrameTime);
      // Keep the last 30 FPS values for smoothing
      this.fpsValues.push(fps);
      if (this.fpsValues.length > 30) {
        this.fpsValues.shift();
      }
    }

    this.lastFrameTime = now;
    this.frameCount++;

    try {
      // Draw video frame to canvas
      this.ctx.drawImage(this.videoElement, 0, 0);
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      // Divide frame into segments based on number of workers
      const segments = this.divideFrame(imageData);

      // Process segments in parallel using worker pool
      const segmentPromises = segments.map((segment, index) => {
        return this.workerPool.assignTask(
          "process",
          {
            imageData: segment.data.data.buffer,
            width: segment.width,
            height: segment.height,
            offsetX: segment.offsetX,
            offsetY: segment.offsetY,
            frameId: this.frameCount,
            workerId: index,
          },
          [segment.data.data.buffer]
        );
      });

      const segmentResults = await Promise.all(segmentPromises);

      // Merge results from all segments
      const mergedResults = this.mergeResults(segmentResults);

      // Track processing time
      const processingTime = performance.now() - now;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 30) {
        this.processingTimes.shift();
      }

      // Calculate average processing time and FPS
      const avgProcessingTime =
        this.processingTimes.reduce((a, b) => a + b, 0) /
        this.processingTimes.length;
      const avgFps =
        this.fpsValues.reduce((a, b) => a + b, 0) / this.fpsValues.length;

      // Provide results to callback
      if (this.resultsCallback) {
        this.resultsCallback({
          detections: mergedResults,
          fps: avgFps,
          processingTime: avgProcessingTime,
          frameCount: this.frameCount,
        });
      }
    } catch (error) {
      console.error("Error processing frame:", error);
      if (this.errorCallback) {
        this.errorCallback(`Frame processing error: ${error.message}`);
      }
    }

    // Schedule next frame processing if still running
    if (this.running) {
      requestAnimationFrame(() => this.processFrame());
    }
  }

  divideFrame(imageData) {
    const numWorkers = this.workerPool.numWorkers;
    const segments = [];

    // Divide the frame horizontally into equal segments
    const segmentHeight = Math.floor(imageData.height / numWorkers);

    for (let i = 0; i < numWorkers; i++) {
      const startY = i * segmentHeight;
      // Make sure the last segment includes any remainder pixels
      const endY =
        i === numWorkers - 1 ? imageData.height : (i + 1) * segmentHeight;
      const height = endY - startY;

      // Create temporary canvas for this segment
      const segmentCanvas = document.createElement("canvas");
      segmentCanvas.width = imageData.width;
      segmentCanvas.height = height;
      const segmentCtx = segmentCanvas.getContext("2d");

      // Copy the segment data from the original frame
      segmentCtx.putImageData(
        new ImageData(
          new Uint8ClampedArray(imageData.data.buffer).slice(
            startY * imageData.width * 4,
            endY * imageData.width * 4
          ),
          imageData.width,
          height
        ),
        0,
        0
      );

      segments.push({
        data: segmentCtx.getImageData(0, 0, imageData.width, height),
        width: imageData.width,
        height,
        offsetX: 0,
        offsetY: startY,
      });
    }

    return segments;
  }

  mergeResults(segmentResults) {
    // Combine detections from all segments
    let allDetections = [];

    for (const result of segmentResults) {
      if (result && result.detections && Array.isArray(result.detections)) {
        // Adjust coordinates based on segment offset
        const adjustedDetections = result.detections.map((detection) => ({
          ...detection,
          box: {
            ...detection.box,
            y: detection.box.y + result.offsetY,
          },
        }));

        allDetections = [...allDetections, ...adjustedDetections];
      }
    }

    // Apply non-maximum suppression to remove duplicate detections
    const finalDetections = this.applyNMS(allDetections, 0.5); // 0.5 IOU threshold

    return finalDetections;
  }

  applyNMS(detections, iouThreshold) {
    if (!detections.length) return [];

    // Sort by confidence (descending)
    const sortedDetections = [...detections].sort(
      (a, b) => b.confidence - a.confidence
    );
    const selectedDetections = [];

    while (sortedDetections.length > 0) {
      // Pick the detection with highest confidence
      const currentDetection = sortedDetections.shift();
      selectedDetections.push(currentDetection);

      // Filter remaining detections
      let i = 0;
      while (i < sortedDetections.length) {
        // If same class and high overlap, remove it
        if (
          currentDetection.class === sortedDetections[i].class &&
          this.calculateIOU(currentDetection.box, sortedDetections[i].box) >
            iouThreshold
        ) {
          sortedDetections.splice(i, 1);
        } else {
          i++;
        }
      }
    }

    return selectedDetections;
  }

  calculateIOU(box1, box2) {
    // Calculate intersection area
    const xMin = Math.max(box1.x, box2.x);
    const yMin = Math.max(box1.y, box2.y);
    const xMax = Math.min(box1.x + box1.width, box2.x + box2.width);
    const yMax = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (xMin >= xMax || yMin >= yMax) return 0;

    const intersectionArea = (xMax - xMin) * (yMax - yMin);

    // Calculate union area
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }

  handleWorkerStatusUpdate(statuses) {
    if (this.statusCallback) {
      this.statusCallback(statuses);
    }
  }

  onResults(callback) {
    this.resultsCallback = callback;
  }

  onWorkerStatus(callback) {
    this.statusCallback = callback;
  }

  onError(callback) {
    this.errorCallback = callback;
  }
}

export default YOLOProcessor;
