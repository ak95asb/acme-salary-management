import { Router, type Router as RouterType } from "express";
import { systemSettingKeySchema, updateSettingSchema } from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import { getAllSettings, setSetting } from "../../lib/settings";
import { AppError } from "../../lib/errors";

const router: RouterType = Router();

router.use(authenticate);

router.get(
  "/",
  requireRole("SYSTEM_ADMIN"),
  async (_req, res, next) => {
    try {
      const settings = await getAllSettings();
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:key",
  requireRole("SYSTEM_ADMIN"),
  async (req, res, next) => {
    const keyParse = systemSettingKeySchema.safeParse(req.params.key);
    if (!keyParse.success) {
      return next(new AppError("VALIDATION_ERROR", "Invalid setting key", 400));
    }

    const bodyParse = updateSettingSchema.safeParse(req.body);
    if (!bodyParse.success) {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, bodyParse.error.flatten())
      );
    }

    try {
      await setSetting(keyParse.data, bodyParse.data.value);
      res.json({ success: true, data: { key: keyParse.data, value: bodyParse.data.value } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
