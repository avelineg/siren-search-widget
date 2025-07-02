import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  build: {
    outDir: "dist",
  },
  // Assure la copie de tout ce qui est dans public/, y compris favicon.ico
  publicDir: "public",
})
