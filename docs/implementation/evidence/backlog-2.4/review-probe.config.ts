import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['docs/implementation/evidence/backlog-2.4/review-*.spec.tsx'],
    setupFiles: ['./apps/desktop/src/app/test-setup.ts'],
  },
});
