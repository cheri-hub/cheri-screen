import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Vitest cobre só os testes unitários em src/. Os specs Playwright em e2e/
    // rodam com `npm run e2e` e usariam APIs que o jsdom não tem.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
