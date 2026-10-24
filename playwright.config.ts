import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000/health",
    reuseExistingServer: true,
  },
});