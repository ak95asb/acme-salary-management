import { execSync } from "child_process";
import path from "path";

export async function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname),
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/test.db",
    },
    stdio: "pipe",
  });
}
