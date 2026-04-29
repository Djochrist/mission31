import { defineConfig } from "vite";

// Configuration Vite — vanilla JS, build statique vers dist/
// Aucun plugin nécessaire : tout est servi tel quel depuis src/ et public/
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
