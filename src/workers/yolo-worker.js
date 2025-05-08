import * as onnx from "onnxruntime-web";

let model = null;
let session = null;
let initialized = false;
let workerId = -1;

// YOLO model configuration - adjust based on your specific use case
const modelConfig = {
  modelPath: "/models/yolo11n.onnx", // This path is now correct
  inputShape: [1, 3, 640, 640], // Standard YOLO input shape
  confThreshold: 0.5, // Confidence threshold for detections
  iouThreshold: 0.5, // IOU threshold for NMS
  classNames: [
    "person",
    "head",
    "face",
    "phone",
    "book",
    "laptop",
    "tablet",
    "screen",
    "hands",
    "looking away",
    "multiple people",
  ],
};

// Initialize the YOLO model
async function initializeModel(params) {
  try {
    workerId = params.workerId;
    postMessage({ status: "initializing" });

    // Set up ONNX runtime with web assembly backend
    const ortOptions = {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    };

    // Initialize ONNX session with the YOLO model
    try {
      session = await onnx.InferenceSession.create(
        modelConfig.modelPath,
        ortOptions
      );
    } catch (modelError) {
      console.error(
        `Worker ${workerId} - Failed to load model from path:`,
        modelError
      );

      // If local path fails, try to load from URL if provided in params
      if (params.modelUrl) {
        try {
          postMessage({
            status: "retrying",
            message: "Trying to load model from URL",
          });
          session = await onnx.InferenceSession.create(
            params.modelUrl,
            ortOptions
          );
        } catch (urlError) {
          throw new Error(
            `Failed to load model from both path and URL: ${urlError.message}`
          );
        }
      } else {
        throw modelError;
      }
    }

    initialized = true;
    postMessage({ status: "ready" });
    return { success: true, workerId };
  } catch (error) {
    console.error(`Worker ${workerId} - Error initializing YOLO model:`, error);
    postMessage({
      status: "error",
      error: error.message,
      details: "Check if the model file exists and is accessible.",
    });
    return { success: false, error: error.message, workerId };
  }
}

// Preprocess image for YOLO model
function preprocess(imageData, width, height) {
  const [modelWidth, modelHeight] = [
    modelConfig.inputShape[3],
    modelConfig.inputShape[2],
  ];

  // Create canvas for resizing
  const canvas = new OffscreenCanvas(modelWidth, modelHeight);
  const ctx = canvas.getContext("2d");

  // Create ImageData from the input
  const tempCanvas = new OffscreenCanvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");

  // Create ImageData from the transferred buffer
  const imgData = new ImageData(
    new Uint8ClampedArray(imageData),
    width,
    height
  );

  tempCtx.putImageData(imgData, 0, 0);

  // Resize image to model input dimensions
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, modelWidth, modelHeight);
  const resizedImageData = ctx.getImageData(0, 0, modelWidth, modelHeight);

  // Convert to float32 tensor and normalize (0-255 to 0-1)
  const tensor = new Float32Array(
    modelConfig.inputShape.reduce((a, b) => a * b, 1)
  );
  const [N, C, H, W] = modelConfig.inputShape;

  for (let h = 0; h < H; h++) {
    for (let w = 0; w < W; w++) {
      for (let c = 0; c < C; c++) {
        const pixelIndex = (h * W + w) * 4;
        const tensorIndex = c * H * W + h * W + w;

        // RGB order (YOLO expects RGB)
        const pixelValue = resizedImageData.data[pixelIndex + c] / 255.0;
        tensor[tensorIndex] = pixelValue;
      }
    }
  }

  return tensor;
}

// Process YOLO output and return detections
function postprocess(output, originalWidth, originalHeight, offsetX, offsetY) {
  const detections = [];

  // Get the output tensor - first, try to determine the correct output key
  let outputTensor = null;
  let outputKeys = Object.keys(output);

  if (outputKeys.length === 0) {
    console.error("Model output is empty");
    return [];
  }

  // Try to find the output tensor - models can have different output names
  if (output.output) {
    outputTensor = output.output;
  } else if (output.outputs) {
    outputTensor = output.outputs;
  } else if (output.detections) {
    outputTensor = output.detections;
  } else {
    // Just use the first output if we can't find a known name
    outputTensor = output[outputKeys[0]];
  }

  if (!outputTensor || !outputTensor.data) {
    console.error("Invalid model output format", output);
    return [];
  }

  const outputData = outputTensor.data;
  const outputShape = outputTensor.dims;

  // Adapt parsing based on model output shape
  // This is a flexible approach that tries to handle different YOLO versions

  // Determine if this is likely YOLOv5/v8 output format
  // YOLOv5/v8 typically outputs [batch, num_detections, num_classes + 5]
  if (outputShape.length === 3 && outputShape[2] >= 5) {
    const numDetections = outputShape[1];
    const stride = outputShape[2];

    for (let i = 0; i < numDetections; i++) {
      const baseIndex = i * stride;

      // Extract confidence score
      const confidence = outputData[baseIndex + 4];

      // Skip low confidence detections
      if (confidence < modelConfig.confThreshold) {
        continue;
      }

      // Find class with highest score
      let maxClassScore = 0;
      let classId = -1;

      for (let j = 0; j < stride - 5; j++) {
        const classScore = outputData[baseIndex + 5 + j];
        if (classScore > maxClassScore) {
          maxClassScore = classScore;
          classId = j;
        }
      }

      // Skip if class score is too low
      if (maxClassScore * confidence < modelConfig.confThreshold) {
        continue;
      }

      // Extract bounding box coordinates (normalized 0-1)
      const x = outputData[baseIndex];
      const y = outputData[baseIndex + 1];
      const w = outputData[baseIndex + 2];
      const h = outputData[baseIndex + 3];

      // Convert normalized coordinates to pixel coordinates
      const scaledBox = {
        x: (x - w / 2) * originalWidth + offsetX,
        y: (y - h / 2) * originalHeight + offsetY,
        width: w * originalWidth,
        height: h * originalHeight,
      };

      // Add detection
      detections.push({
        box: scaledBox,
        confidence: confidence * maxClassScore,
        class: classId,
        label: modelConfig.classNames[classId] || `class-${classId}`,
      });
    }
  }
  // Handle UltraFace output format which is different from YOLO
  // UltraFace typically outputs two tensors: boxes and scores
  else if (output.boxes && output.scores) {
    const boxes = output.boxes.data;
    const scores = output.scores.data;
    const numClasses = output.scores.dims[1];
    const numBoxes = output.boxes.dims[1];

    for (let i = 0; i < numBoxes; i++) {
      // Find the class with the highest confidence
      let maxConfidence = 0;
      let classId = 0;

      for (let c = 0; c < numClasses; c++) {
        const score = scores[i * numClasses + c];
        if (score > maxConfidence) {
          maxConfidence = score;
          classId = c;
        }
      }

      // Skip low confidence detections
      if (maxConfidence < modelConfig.confThreshold) {
        continue;
      }

      // Extract box coordinates (UltraFace typically outputs [x1, y1, x2, y2])
      const x1 = boxes[i * 4] * originalWidth + offsetX;
      const y1 = boxes[i * 4 + 1] * originalHeight + offsetY;
      const x2 = boxes[i * 4 + 2] * originalWidth + offsetX;
      const y2 = boxes[i * 4 + 3] * originalHeight + offsetY;

      detections.push({
        box: {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
        },
        confidence: maxConfidence,
        class: classId,
        label: modelConfig.classNames[classId] || `class-${classId}`,
      });
    }
  } else {
    console.warn(
      "Unknown model output format - returning empty detections",
      outputShape
    );
  }

  return detections;
}

// Process a video frame segment
async function processFrame(params) {
  if (!initialized || !session) {
    throw new Error("YOLO model not initialized");
  }

  const { imageData, width, height, offsetX, offsetY, frameId, workerId } =
    params;

  try {
    postMessage({ status: "processing" });

    // Preprocess the image
    const inputTensor = preprocess(imageData, width, height);

    // Create ONNX tensor
    const tensor = new onnx.Tensor(
      "float32",
      inputTensor,
      modelConfig.inputShape
    );

    // Run inference with dynamic input name detection
    let inputName = "images"; // Default name

    // Get model inputs to determine correct input name
    const inputs = session.inputNames;
    if (inputs && inputs.length > 0) {
      inputName = inputs[0]; // Use the first input name from the model
    }

    const feeds = {};
    feeds[inputName] = tensor;

    const start = performance.now();
    const results = await session.run(feeds);
    const inferenceTime = performance.now() - start;

    // Process results
    const detections = postprocess(results, width, height, offsetX, offsetY);

    postMessage({ status: "idle" });

    return {
      detections,
      inferenceTime,
      offsetX,
      offsetY,
      workerId,
      frameId,
    };
  } catch (error) {
    console.error(`Worker ${workerId} - Error processing frame:`, error);
    postMessage({ status: "error", error: error.message });
    throw error;
  }
}

// Handle messages from the main thread
self.onmessage = async function (event) {
  const { taskId, type, data } = event.data;

  try {
    let result;

    switch (type) {
      case "init":
        result = await initializeModel(data);
        break;

      case "process":
        result = await processFrame(data);
        break;

      case "status":
        result = {
          initialized,
          workerId,
          modelConfig,
        };
        break;

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    postMessage({ taskId, result });
  } catch (error) {
    console.error(`Worker error (${type}):`, error);
    postMessage({
      taskId,
      error: error.message || "Unknown error",
      status: "error",
    });
  }
};
