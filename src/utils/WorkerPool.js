class WorkerPool {
  constructor(numWorkers) {
    this.numWorkers = numWorkers;
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
    this.onStatusUpdate = null;
    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(
        new URL("../workers/yolo-worker.js", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event) => {
        const { taskId, result, status, error } = event.data;

        // Handle status updates
        if (status) {
          this.handleStatusUpdate(i, status);
          return;
        }

        // Handle task completion
        const taskIndex = this.taskQueue.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          const task = this.taskQueue[taskIndex];

          // Remove task from queue
          this.taskQueue.splice(taskIndex, 1);

          if (error) {
            if (task.reject) task.reject(new Error(error));
          } else if (task.resolve) {
            task.resolve(result);
          }
        }

        // Mark worker as free
        this.workers[i].busy = false;
        this.activeWorkers--;

        // Update worker status
        this.handleStatusUpdate(i, "idle");

        // Process next task if available
        this.processNextTask();
      };

      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error);

        // Mark worker as having an error
        this.handleStatusUpdate(i, "error");

        // Attempt to restart the worker
        setTimeout(() => this.restartWorker(i), 1000);
      };

      this.workers.push({
        worker,
        busy: false,
        id: i,
        status: "idle",
      });
    }
  }

  handleStatusUpdate(workerId, status) {
    if (workerId >= 0 && workerId < this.workers.length) {
      this.workers[workerId].status = status;

      // Callback to update UI
      if (this.onStatusUpdate) {
        const statuses = this.workers.map((w) => ({
          id: w.id,
          status: w.status,
        }));
        this.onStatusUpdate(statuses);
      }
    }
  }

  restartWorker(index) {
    if (index < 0 || index >= this.workers.length) return;

    console.log(`Restarting worker ${index}`);
    this.handleStatusUpdate(index, "restarting");

    // Terminate the old worker
    const oldWorker = this.workers[index].worker;
    oldWorker.terminate();

    // Create a new worker
    const newWorker = new Worker(
      new URL("../workers/yolo-worker.js", import.meta.url),
      { type: "module" }
    );

    // Set up event handlers
    newWorker.onmessage = (event) => {
      const { taskId, result, status, error } = event.data;

      if (status) {
        this.handleStatusUpdate(index, status);
        return;
      }

      const taskIndex = this.taskQueue.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        const task = this.taskQueue[taskIndex];
        this.taskQueue.splice(taskIndex, 1);

        if (error) {
          if (task.reject) task.reject(new Error(error));
        } else if (task.resolve) {
          task.resolve(result);
        }
      }

      this.workers[index].busy = false;
      this.activeWorkers--;
      this.handleStatusUpdate(index, "idle");
      this.processNextTask();
    };

    newWorker.onerror = (error) => {
      console.error(`Restarted worker ${index} error:`, error);
      this.handleStatusUpdate(index, "error");
      setTimeout(() => this.restartWorker(index), 2000); // Try again after longer delay
    };

    // Update worker in pool
    this.workers[index].worker = newWorker;
    this.workers[index].busy = false;
    this.handleStatusUpdate(index, "idle");

    // Process next task if there are any in the queue
    this.processNextTask();
  }

  assignTask(taskType, data) {
    return new Promise((resolve, reject) => {
      const taskId = Date.now() + Math.random().toString(36).substring(2, 9);

      this.taskQueue.push({
        id: taskId,
        type: taskType,
        data,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.processNextTask();
    });
  }

  processNextTask() {
    if (this.taskQueue.length === 0) return;

    // Find available worker
    const availableWorkerIndex = this.workers.findIndex((w) => !w.busy);
    if (availableWorkerIndex === -1) return; // No available workers

    // Get the next task
    const task = this.taskQueue[0]; // Get first task (FIFO)

    // Mark worker as busy
    const worker = this.workers[availableWorkerIndex];
    worker.busy = true;
    this.activeWorkers++;

    // Update status
    this.handleStatusUpdate(availableWorkerIndex, "processing");

    // Send task to worker
    worker.worker.postMessage({
      taskId: task.id,
      type: task.type,
      data: task.data,
    });
  }

  // Register a callback for worker status updates
  setStatusUpdateCallback(callback) {
    this.onStatusUpdate = callback;
  }

  // Terminate all workers
  terminate() {
    this.workers.forEach((worker) => worker.worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
  }

  // Get current status of all workers
  getStatus() {
    return this.workers.map((w) => ({ id: w.id, status: w.status }));
  }
}

export default WorkerPool;
