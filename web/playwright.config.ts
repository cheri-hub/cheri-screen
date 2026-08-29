import { defineConfig } from '@playwright/test'

/**
 * As flags de Chromium trocam a captura de tela real por uma fonte falsa
 * (`--use-fake-*` + `--auto-select-desktop-capture-source`), que é o que torna
 * `getDisplayMedia` resolvível sem interação humana e o fluxo automatizável.
 * Só Chromium: `getDisplayMedia` fake não existe nos outros motores (spec §10).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--auto-select-desktop-capture-source=Entire screen',
        '--auto-accept-this-tab-capture',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        // Aceita o certificado do proxy /rtc num ambiente de teste local.
        '--ignore-certificate-errors',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { channel: undefined } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
