import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import healthRouter from "./features/health/health.routes";
import authRouter from "./features/auth/auth.routes";
import userRouter from "./features/users/user.routes";
import employeeRouter from "./features/employees/employee.routes";
import salaryRouter from "./features/salaries/salary.routes";
import settingsRouter from "./features/settings/settings.routes";
import analyticsRouter from "./features/analytics/analytics.routes";
import auditRouter from "./features/audit/audit.routes";
import { errorMiddleware } from "./lib/errors";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    })
  );

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/employees", employeeRouter);
  app.use("/api/employees/:employeeId/salaries", salaryRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/audit-logs", auditRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorMiddleware);

  return app;
}
