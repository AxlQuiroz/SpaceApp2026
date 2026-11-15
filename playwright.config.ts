import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure",
    actionTimeout: 15_000, navigationTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: "node scripts/e2e-backend.mjs", url: "http://127.0.0.1:8700/health/ready", timeout: 60_000, reuseExistingServer: false },
    { command: "npm run start -- --hostname 0.0.0.0 --port 3100", url: "http://localhost:3100", timeout: 60_000, reuseExistingServer: false,
      env: { ORBITA_PROXY_TOKEN: "TEST-ONLY_e2e-proxy-p5rA8Nv2Wz6Lq0Uc1mT9Bf4Gd7Yh3", ORBITA_API_URL: "http://127.0.0.1:8700", APP_ORIGIN: "http://localhost:3100", NEXT_TELEMETRY_DISABLED: "1" } },
  ],
});
