import { Router, type Router as RouterType } from "express";
import { createSalarySchema } from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import { getSalaryHistory, addSalaryRecord, getCurrentSalary } from "./salary.service";
import { AppError } from "../../lib/errors";

const router: RouterType = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  "/",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"),
  async (req, res, next) => {
    try {
      const history = await getSalaryHistory(String(req.params.employeeId));
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/current",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"),
  async (req, res, next) => {
    try {
      const record = await getCurrentSalary(String(req.params.employeeId));
      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN"),
  async (req, res, next) => {
    const parse = createSalarySchema.safeParse(req.body);
    if (!parse.success) {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, parse.error.flatten())
      );
    }

    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      const record = await addSalaryRecord(
        String(req.params.employeeId),
        parse.data,
        actor
      );
      res.status(201).json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
