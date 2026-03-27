import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['pages/api/**'],
      reporter: ['text', 'lcov'],
    },
  },
})
