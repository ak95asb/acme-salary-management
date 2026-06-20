import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@acme/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
  test: {
    pool: "forks",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      JWT_SECRET: "test-secret-minimum-32-characters-abc123",
      PORT: "3001",
      WEB_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
