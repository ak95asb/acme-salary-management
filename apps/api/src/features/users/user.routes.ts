import { Router, type Router as RouterType } from "express";
import { createUserSchema } from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import { listUsers, createUser, setUserActive } from "./user.service";
import { AppError } from "../../lib/errors";

const router: RouterType = Router();

router.use(authenticate);

router.get("/", requireRole("SYSTEM_ADMIN"), async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireRole("SYSTEM_ADMIN"),
  async (req, res, next) => {
    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, parse.error.flatten())
      );
    }

    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      const user = await createUser(parse.data, actor);
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id/active",
  requireRole("SYSTEM_ADMIN"),
  async (req, res, next) => {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return next(
        new AppError("VALIDATION_ERROR", "isActive must be a boolean", 400)
      );
    }

    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      const user = await setUserActive(String(req.params.id), isActive, actor);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
