import { Router, type Router as RouterType } from "express";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeFilterSchema,
  paginationQuerySchema,
} from "@acme/types";
import { authenticate, requireRole } from "../../lib/middleware/auth";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "./employee.service";
import { AppError } from "../../lib/errors";

const router: RouterType = Router();

router.use(authenticate);

router.get(
  "/",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"),
  async (req, res, next) => {
    const filterParse = employeeFilterSchema.safeParse(req.query);
    const pageParse = paginationQuerySchema.safeParse(req.query);

    if (!filterParse.success || !pageParse.success) {
      return next(new AppError("VALIDATION_ERROR", "Invalid query parameters", 400));
    }

    try {
      const result = await listEmployees(filterParse.data, pageParse.data);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN", "HR_VIEWER"),
  async (req, res, next) => {
    try {
      const emp = await getEmployee(String(req.params.id));
      res.json({ success: true, data: emp });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN"),
  async (req, res, next) => {
    const parse = createEmployeeSchema.safeParse(req.body);
    if (!parse.success) {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, parse.error.flatten())
      );
    }

    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      const emp = await createEmployee(parse.data, actor);
      res.status(201).json({ success: true, data: emp });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN"),
  async (req, res, next) => {
    const parse = updateEmployeeSchema.safeParse(req.body);
    if (!parse.success) {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, parse.error.flatten())
      );
    }

    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      const emp = await updateEmployee(String(req.params.id), parse.data, actor);
      res.json({ success: true, data: emp });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  requireRole("SYSTEM_ADMIN", "HR_ADMIN"),
  async (req, res, next) => {
    try {
      const actor = { id: req.user!.sub, email: req.user!.email };
      await deactivateEmployee(String(req.params.id), actor);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
