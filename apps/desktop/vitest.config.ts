import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.tsx', 'electron/**/*.spec.ts'],
    setupFiles: ['./src/app/test-setup.ts'],
  },
});
