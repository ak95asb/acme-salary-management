// env must be the first import — exits process on misconfiguration
import "./env";
import { env } from "./env";
import { createApp } from "./app";
import { startAuditArchiver } from "./jobs/auditArchiver";
import pino from "pino";

const logger = pino({ level: "info" });

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    "ACME Salary Management API started"
  );
  startAuditArchiver();
});
