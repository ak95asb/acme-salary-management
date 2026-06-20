import express, { type Express } from "express";
import cors from "cors";
import { env } from "./env";
import healthRouter from "./features/health/health.routes";
import { errorMiddleware } from "./lib/errors";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    })
  );

  // Routes
  app.use("/api", healthRouter);

  // 404 handler for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  // Global error handler — must be last
  app.use(errorMiddleware);

  return app;
}
