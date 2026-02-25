import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '172.23.1.28',
    port: 1001,
  },    
  plugins: [react()],
  define: {
    // Better fix for simple-peer: define 'global' as 'window'
    global: 'window',
  },  
});