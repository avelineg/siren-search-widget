import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Active le plugin React pour gérer TSX/JSX et le rechargement à chaud
  plugins: [react()],

  build: {
    outDir: 'dist',
  },

  // Copie tout le contenu de public/ (dont favicon.ico) vers dist/
  publicDir: 'public',
})
