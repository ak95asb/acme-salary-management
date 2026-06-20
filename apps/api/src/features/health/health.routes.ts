import { Router, type Router as RouterType } from "express";

const router: RouterType = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: { status: "ok", ts: new Date().toISOString() },
  });
});

export default router;
