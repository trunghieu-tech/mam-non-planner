import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    watch: {
      ignored: ['**/data/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'editor-tiptap';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'ui-icons';
          }
          if (id.includes('node_modules/react')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
