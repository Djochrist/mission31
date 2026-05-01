import { defineConfig } from "vite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin : remplace __BUILD_ID__ dans dist/sw.js après le build.
// Garantit qu'à chaque déploiement, le service worker change de nom de cache
// et invalide automatiquement les ressources mises en cache par le navigateur.
function swVersionPlugin() {
  return {
    name: "sw-version",
    apply: "build",
    closeBundle() {
      const swPath = join(__dirname, "dist", "sw.js");
      if (!existsSync(swPath)) return;
      try {
        const buildId =
          process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
          process.env.VITE_BUILD_ID ||
          Date.now().toString(36);
        const content = readFileSync(swPath, "utf-8").replace(/__BUILD_ID__/g, buildId);
        writeFileSync(swPath, content);
        console.log(`[sw-version] sw.js patched with build id "${buildId}"`);
      } catch (err) {
        console.warn("[sw-version] could not patch sw.js:", err.message);
      }
    },
  };
}

// Configuration Vite : vanilla JS, build statique vers dist/
export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [swVersionPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    host: true,
    port: 5000,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
