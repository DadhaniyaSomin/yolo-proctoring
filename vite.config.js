// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  worker: {
    format: "es",
    plugins: [],
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"], // Prevent bundling in dev mode
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          onnx: ["onnxruntime-web"], // Create separate chunk for large dependencies
        },
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
