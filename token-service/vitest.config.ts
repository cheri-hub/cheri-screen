import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret',
      PUBLIC_HOST: 'test.local',
    },
  },
});
