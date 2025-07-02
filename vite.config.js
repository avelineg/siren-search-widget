import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  // Active le plugin React pour TSX, JSX et module resolution
  plugins: [react()],

  build: {
    outDir: "dist",
  },

  // Copie tout le dossier public (favicon.ico, etc.) vers dist/
  publicDir: "public",
  })
