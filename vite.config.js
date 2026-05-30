import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/poultry-ledger/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('jspdf') || id.includes('html2canvas')) return 'print-vendors';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('atropos')) return 'atropos-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';

          return 'vendor';
        }
      }
    },
  }
});
