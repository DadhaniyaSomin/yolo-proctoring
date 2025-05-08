// Simplified DetectionCaptureService.js with focus on reliable capture

class DetectionCaptureService {
  constructor() {
    this.captureCounter = 0;
    this.savedDetections = [];
    this.captureEnabled = false;

    // Create persistent canvas elements with hardware acceleration hints
    this.videoCanvas = document.createElement("canvas");
    this.videoCtx = this.videoCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: true,
    });

    this.cropCanvas = document.createElement("canvas");
    this.cropCtx = this.cropCanvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
    });

    // Force smooth rendering
    this.videoCtx.imageSmoothingEnabled = true;
    this.videoCtx.imageSmoothingQuality = "high";
    this.cropCtx.imageSmoothingEnabled = true;
    this.cropCtx.imageSmoothingQuality = "high";

    // Create video snapshot cache
    this.lastVideoSnapshot = null;
    this.lastSnapshotTime = 0;

    console.log("DirectDetectionCapture initialized");
  }

  // Start capturing
  start() {
    this.captureEnabled = true;
    console.log("Capture enabled");
  }

  // Stop capturing
  stop() {
    this.captureEnabled = false;
    console.log("Capture disabled");
  }

  // Capture full video frame to use as source for detections
  captureVideoFrame(videoElement) {
    if (!videoElement || videoElement.readyState < 2) {
      console.warn("Video not ready for snapshot");
      return null;
    }

    // Check if we already have a recent snapshot (within 100ms)
    const now = performance.now();
    if (this.lastVideoSnapshot && now - this.lastSnapshotTime < 100) {
      return this.lastVideoSnapshot;
    }

    try {
      // Get video dimensions
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;

      if (!width || !height) {
        console.warn("Invalid video dimensions", { width, height });
        return null;
      }

      // Set canvas size to match video
      this.videoCanvas.width = width;
      this.videoCanvas.height = height;

      // Clear canvas
      this.videoCtx.clearRect(0, 0, width, height);

      // Draw current video frame
      this.videoCtx.drawImage(videoElement, 0, 0, width, height);

      // Save timestamp
      this.lastSnapshotTime = now;

      // Cache the canvas for reuse
      this.lastVideoSnapshot = this.videoCanvas;

      return this.videoCanvas;
    } catch (error) {
      console.error("Failed to capture video frame:", error);
      return null;
    }
  }

  // Capture a single detection
  captureDetection(videoElement, detection) {
    if (!this.captureEnabled || !videoElement || !detection) {
      return null;
    }

    try {
      // Ensure video element is ready
      if (
        videoElement.readyState < 2 ||
        !videoElement.videoWidth ||
        !videoElement.videoHeight
      ) {
        console.warn("Video not ready for detection capture");
        return null;
      }

      // Use cached video frame if possible
      const videoFrame = this.captureVideoFrame(videoElement);
      if (!videoFrame) {
        console.warn("Failed to capture video frame");
        return null;
      }

      // Get detection box with padding
      const { box } = detection;
      const padding = 20;

      // Video dimensions
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      // Calculate crop area with bounds checking
      const cropX = Math.max(0, Math.round(box.x - padding));
      const cropY = Math.max(0, Math.round(box.y - padding));
      const cropWidth = Math.min(
        Math.round(box.width + padding * 2),
        videoWidth - cropX
      );
      const cropHeight = Math.min(
        Math.round(box.height + padding * 2),
        videoHeight - cropY
      );

      // Skip if dimensions are invalid
      if (cropWidth <= 0 || cropHeight <= 0) {
        console.warn("Invalid crop dimensions", { cropWidth, cropHeight });
        return null;
      }

      // Set crop canvas size
      this.cropCanvas.width = cropWidth;
      this.cropCanvas.height = cropHeight;

      // Clear crop canvas
      this.cropCtx.clearRect(0, 0, cropWidth, cropHeight);

      // Draw the region to crop canvas
      this.cropCtx.drawImage(
        videoFrame,
        cropX,
        cropY,
        cropWidth,
        cropHeight, // Source
        0,
        0,
        cropWidth,
        cropHeight // Destination
      );

      // Draw detection box on cropped image
      const boxX = box.x - cropX;
      const boxY = box.y - cropY;

      // Generate consistent color based on class
      const hue = (detection.class * 137) % 360;
      const color = `hsl(${hue}, 90%, 50%)`;

      // Draw rectangle
      this.cropCtx.strokeStyle = color;
      this.cropCtx.lineWidth = 3;
      this.cropCtx.strokeRect(boxX, boxY, box.width, box.height);

      // Add label with confidence
      const labelText = `${detection.label} ${(
        detection.confidence * 100
      ).toFixed(1)}%`;

      // Measure text for background
      this.cropCtx.font = "bold 14px Arial";
      const textWidth = this.cropCtx.measureText(labelText).width;
      const textHeight = 20;
      const textPadding = 4;

      // Draw background for text
      this.cropCtx.fillStyle = color;
      this.cropCtx.fillRect(
        boxX,
        Math.max(0, boxY - textHeight - textPadding),
        textWidth + textPadding * 2,
        textHeight + textPadding
      );

      // Draw text
      this.cropCtx.fillStyle = "white";
      this.cropCtx.fillText(
        labelText,
        boxX + textPadding,
        Math.max(textHeight - 4, boxY - 4)
      );

      // Convert to high-quality JPEG
      const quality = 0.95;
      const imageDataUrl = this.cropCanvas.toDataURL("image/jpeg", quality);

      // Generate unique ID
      const id = ++this.captureCounter;

      // Create detection record
      const detectionRecord = {
        id,
        timestamp: Date.now(),
        label: detection.label,
        confidence: detection.confidence,
        imageData: imageDataUrl,
        coordinates: { ...box },
      };

      // Add to memory
      this.savedDetections.push(detectionRecord);

      // Save to localStorage
      this.saveToLocalStorage(detectionRecord);

      console.log(
        `✓ Successfully captured detection #${id}: ${detection.label}`
      );
      return detectionRecord;
    } catch (error) {
      console.error("Error capturing detection:", error);
      return null;
    }
  }

  // Process multiple detections
  captureDetections(videoElement, detections) {
    if (
      !this.captureEnabled ||
      !videoElement ||
      !detections ||
      detections.length === 0
    ) {
      return [];
    }

    const results = [];

    // First capture video frame once for all detections
    this.captureVideoFrame(videoElement);

    // Then process each detection
    for (const detection of detections) {
      const result = this.captureDetection(videoElement, detection);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // Save to localStorage
  saveToLocalStorage(detection) {
    try {
      // Get existing detections
      const existingJson = localStorage.getItem("captured_detections");
      let existingData = existingJson ? JSON.parse(existingJson) : [];

      // Create a metadata-only record (without the image data)
      const metadataRecord = {
        id: detection.id,
        timestamp: detection.timestamp,
        label: detection.label,
        confidence: detection.confidence,
        coordinates: detection.coordinates,
        imageKey: `detection_image_${detection.id}`,
      };

      // Add to the list
      existingData.push(metadataRecord);

      // Save the metadata list
      localStorage.setItem("captured_detections", JSON.stringify(existingData));

      // Save the image separately (to avoid oversized localStorage entries)
      localStorage.setItem(metadataRecord.imageKey, detection.imageData);

      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      return false;
    }
  }

  // Load from localStorage
  loadFromLocalStorage() {
    try {
      const existingJson = localStorage.getItem("captured_detections");
      if (!existingJson) return [];

      const metadataList = JSON.parse(existingJson);

      // Rehydrate with images
      return metadataList.map((record) => {
        // Retrieve image data
        const imageData = localStorage.getItem(record.imageKey);

        return {
          ...record,
          imageData: imageData || null,
        };
      });
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return [];
    }
  }

  // Get all detections (from memory)
  getAllDetections() {
    return [...this.savedDetections];
  }

  // Delete a detection
  deleteDetection(id) {
    // Remove from memory
    this.savedDetections = this.savedDetections.filter((d) => d.id !== id);

    // Remove from localStorage
    try {
      const existingJson = localStorage.getItem("captured_detections");
      if (!existingJson) return false;

      let records = JSON.parse(existingJson);
      const recordToDelete = records.find((r) => r.id === id);

      if (recordToDelete) {
        // Remove image data
        localStorage.removeItem(recordToDelete.imageKey);

        // Update list
        records = records.filter((r) => r.id !== id);
        localStorage.setItem("captured_detections", JSON.stringify(records));
      }

      return true;
    } catch (error) {
      console.error("Error deleting detection:", error);
      return false;
    }
  }

  // Clear all detections
  clearAllDetections() {
    // Clear memory
    this.savedDetections = [];

    // Clear localStorage
    try {
      const existingJson = localStorage.getItem("captured_detections");
      if (!existingJson) return;

      const records = JSON.parse(existingJson);

      // Remove all image data
      for (const record of records) {
        localStorage.removeItem(record.imageKey);
      }

      // Remove list
      localStorage.removeItem("captured_detections");
    } catch (error) {
      console.error("Error clearing detections:", error);
    }
  }

  // Download an image
  downloadImage(dataUrl, filename) {
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename || `detection_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default DetectionCaptureService;
